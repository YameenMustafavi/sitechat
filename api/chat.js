// SiteChat RAG API — Vercel serverless function (Node.js).
// POST /api/chat  { site, message, history?: [{role, text}] }
// Free-tier design: keyword retrieval (no embedding API), Gemini free tier for generation.

const fs = require('fs');
const path = require('path');

const GEMINI_MODEL = 'gemini-3-flash-preview';
const TOP_K = 4;
const MAX_HISTORY = 6;

// ---- chunk store (loaded once per cold start) ----
const storeCache = {};
function loadSite(site) {
  if (storeCache[site]) return storeCache[site];
  const safe = String(site).replace(/[^a-z0-9-]/gi, '');
  const p = path.join(__dirname, '..', 'data', `${safe}.json`);
  if (!fs.existsSync(p)) return null;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const chunks = data.chunks || [];
  // Precompute document frequencies for IDF
  const df = {};
  const docs = chunks.map((c) => {
    const terms = tokenize(c.text + ' ' + c.title);
    const uniq = new Set(terms);
    uniq.forEach((t) => { df[t] = (df[t] || 0) + 1; });
    return { terms, len: terms.length };
  });
  const N = chunks.length;
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, N);
  storeCache[site] = { chunks, docs, df, N, avgLen };
  return storeCache[site];
}

function tokenize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF\u0900-\u097F\s]/g, ' ')
    .split(/\s+/).filter((t) => t.length > 2);
}

// BM25-lite retrieval
function retrieve(store, query) {
  const qterms = tokenize(query);
  if (!qterms.length) return [];
  const k1 = 1.2, b = 0.75;
  const scored = store.chunks.map((c, i) => {
    const doc = store.docs[i];
    const tf = {};
    doc.terms.forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
    let score = 0;
    qterms.forEach((q) => {
      const f = tf[q] || 0;
      if (!f) return;
      const idf = Math.log(1 + (store.N - (store.df[q] || 0) + 0.5) / ((store.df[q] || 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (doc.len / store.avgLen))));
    });
    // Small title boost
    const titleTerms = new Set(tokenize(c.title));
    qterms.forEach((q) => { if (titleTerms.has(q)) score += 0.5; });
    return { c, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, TOP_K);
}

// ---- simple per-IP rate limit (best-effort on serverless) ----
const hits = {};
function rateLimited(ip) {
  const now = Date.now(), win = 60 * 1000, max = 12;
  const arr = (hits[ip] || []).filter((t) => now - t < win);
  arr.push(now); hits[ip] = arr;
  return arr.length > max;
}

async function askGemini(context, message, history) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('missing_key');
  const sys = `You are a helpful assistant for a website. Answer the user's question using ONLY the context below. ` +
    `Reply in the same language the user writes in. Be concise (2-5 sentences unless detail is asked). ` +
    `If the context does not contain the answer, say so briefly and suggest contacting the site owner. ` +
    `Do not invent prices, services, or facts not in the context.`;
  const contents = [];
  history.slice(-MAX_HISTORY).forEach((h) => {
    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: `Context:\n${context}\n\nQuestion: ${message}` }] });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents,
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`gemini_${res.status}: ${t.slice(0, 120)}`);
  }
  const j = await res.json();
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return text.trim();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests — please wait a minute.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { site, message, history = [] } = body || {};
  if (!site || !message || typeof message !== 'string' || message.length > 1000) {
    return res.status(400).json({ error: 'site and message (max 1000 chars) required' });
  }

  const store = loadSite(site);
  if (!store) return res.status(404).json({ error: `No content indexed for site: ${site}` });

  const top = retrieve(store, message);
  if (!top.length) {
    return res.status(200).json({
      answer: "I couldn't find anything about that on this site. Try asking about our services, pricing, or contact info — or reach out via the contact page.",
      sources: [],
    });
  }
  const context = top.map((s, i) => `[${i + 1}] ${s.c.title} (${s.c.url})\n${s.c.text}`).join('\n\n');
  try {
    const answer = await askGemini(context, message, Array.isArray(history) ? history : []);
    const sources = [...new Set(top.map((s) => s.c.url))].slice(0, 3);
    return res.status(200).json({ answer, sources });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('missing_key')) return res.status(503).json({ error: 'Chat is not configured yet. Please try again later.' });
    if (msg.includes('gemini_429')) return res.status(503).json({ error: 'The free AI quota is busy right now — please try again in a minute.' });
    return res.status(502).json({ error: 'AI service error. Please try again.' });
  }
};
