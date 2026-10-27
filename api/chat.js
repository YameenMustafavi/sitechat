// SiteChat RAG API — Vercel serverless function (Node.js).
// POST /api/chat  { site, message, history?: [{role, text}] }
// Free-tier design: keyword retrieval (no embedding API), Gemini free tier for generation.

const fs = require('fs');
const path = require('path');

const GEMINI_MODEL = 'gemini-3-flash-preview';
const TOP_K = 4;
const MAX_HISTORY = 6;

// ---- chunk store (loaded once per cold start) ----
// Site-key aliases: keys that reuse another site's content file
// (new.thedesignpk.com is the same business as thedesignpk.com).
const SITE_ALIASES = { newthedesignpk: 'thedesignpk' };
const storeCache = {};
function loadSite(site) {
  if (storeCache[site]) return storeCache[site];
  const safe = String(site).replace(/[^a-z0-9-]/gi, '');
  const fileKey = SITE_ALIASES[safe] || safe;
  const p = path.join(__dirname, '..', 'data', `${fileKey}.json`);
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

// ---- multilingual support ----
// The widget sends `lang` when the visitor picks a language; the bot then
// answers in that language even though the indexed context is English.
const LANG_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  hi: 'Hindi', ur: 'Urdu', ar: 'Arabic', zh: 'Chinese', ru: 'Russian',
  ja: 'Japanese', id: 'Indonesian',
};
const NO_RESULT = {
  en: "I couldn't find anything about that on this site. Try asking about our services, pricing, or contact info — or reach out via the contact page.",
  es: 'No encontré información sobre eso en este sitio. Pruebe a preguntar por nuestros servicios, precios o información de contacto, o escríbanos desde la página de contacto.',
  fr: "Je n'ai rien trouvé à ce sujet sur ce site. Essayez de poser une question sur nos services, nos tarifs ou nos coordonnées, ou contactez-nous via la page de contact.",
  de: 'Dazu habe ich auf dieser Website nichts gefunden. Fragen Sie gern nach unseren Leistungen, Preisen oder Kontaktinformationen — oder schreiben Sie uns über die Kontaktseite.',
  pt: 'Não encontrei informações sobre isso neste site. Tente perguntar sobre nossos serviços, preços ou informações de contato, ou fale conosco pela página de contato.',
  hi: 'मुझे इस वेबसाइट पर इसके बारे में कुछ नहीं मिला। हमारी सेवाओं, कीमतों या संपर्क जानकारी के बारे में पूछकर देखें — या संपर्क पेज से हमसे जुड़ें।',
  ur: 'مجھے اس ویب سائٹ پر اس بارے میں کچھ نہیں ملا۔ ہماری خدمات، قیمتوں یا رابطے کی معلومات کے بارے میں پوچھ کر دیکھیں — یا رابطہ صفحے سے ہم سے رابطہ کریں۔',
  ar: 'لم أجد معلومات حول ذلك في هذا الموقع. جرّب أن تسأل عن خدماتنا أو أسعارنا أو معلومات التواصل، أو راسلنا عبر صفحة التواصل.',
  zh: '我在本网站上没有找到相关信息。您可以询问我们的服务、价格或联系方式，或通过联系页面与我们联系。',
  ru: 'Я не нашёл информации об этом на сайте. Попробуйте спросить о наших услугах, ценах или контактной информации — или напишите нам через страницу контактов.',
  ja: 'このサイトではその件に関する情報が見つかりませんでした。サービス、料金、連絡先情報についてご質問いただくか、お問い合わせページからご連絡ください。',
  id: 'Saya tidak menemukan informasi tentang itu di situs ini. Coba tanyakan tentang layanan, harga, atau info kontak kami — atau hubungi kami melalui halaman kontak.',
};

async function askGemini(context, message, history, lang) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('missing_key');
  const langRule = lang
    ? `Always reply in ${LANG_NAMES[lang]}, no matter what language the question or the context is written in. `
    : `Reply in the same language the user writes in. `;
  const sys = `You are a helpful assistant for a website. Answer the user's question using ONLY the context below. ` +
    langRule +
    `Be concise (2-5 sentences unless detail is asked). ` +
    `If the context does not contain the answer, say so briefly and suggest contacting the site owner. ` +
    `Do not invent prices, services, or facts not in the context.`;
  const contents = [];
  history.slice(-MAX_HISTORY).forEach((h) => {
    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] });
  });
  contents.push({ role: 'user', parts: [{ text: `Context:\n${context}\n\nQuestion: ${message}` }] });
  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: sys }] },
    contents,
    generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
  });
  const callOnce = async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`gemini_${res.status}: ${t.slice(0, 120)}`);
    }
    const j = await res.json();
    return (j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '').trim();
  };
  /* The free tier drops requests intermittently (observed for all languages,
     including English) — one retry after a short pause rescues most of them. */
  try {
    return await callOnce();
  } catch (e) {
    if (String(e.message || e).includes('gemini_429')) throw e;
    await new Promise((r) => setTimeout(r, 1200));
    return callOnce();
  }
}

// Cross-lingual fallback: retrieval is exact-token BM25 over mostly-English
// chunks, so a question written in another language (e.g. Urdu) can score
// zero even when the site answers it. Only on a zero-hit do we translate the
// question to English with Gemini and retry retrieval once. Queries that
// already match are never touched, and any translation failure falls through
// to the normal NO_RESULT reply.
async function translateToEnglish(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const payload = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [{ text: `Translate the following question into English. Output ONLY the translation, with no quotes or explanation.\n\n${text}` }],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 120 },
  });
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }
  );
  if (!res.ok) return null;
  const j = await res.json();
  const t = (j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '').trim();
  return t && t.toLowerCase() !== text.toLowerCase() ? t : null;
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
  const { site, message, history = [], lang: rawLang } = body || {};
  if (!site || !message || typeof message !== 'string' || message.length > 1000) {
    return res.status(400).json({ error: 'site and message (max 1000 chars) required' });
  }
  const lang = typeof rawLang === 'string' && LANG_NAMES[rawLang.toLowerCase()]
    ? rawLang.toLowerCase() : null;

  const store = loadSite(site);
  if (!store) return res.status(404).json({ error: `No content indexed for site: ${site}` });

  let top = retrieve(store, message);
  if (!top.length) {
    try {
      const en = await translateToEnglish(message);
      if (en) top = retrieve(store, en);
    } catch { /* translation is best-effort; NO_RESULT below is the fallback */ }
  }
  if (!top.length) {
    return res.status(200).json({
      answer: NO_RESULT[lang] || NO_RESULT.en,
      sources: [],
    });
  }
  const context = top.map((s, i) => `[${i + 1}] ${s.c.title} (${s.c.url})\n${s.c.text}`).join('\n\n');
  try {
    const answer = await askGemini(context, message, Array.isArray(history) ? history : [], lang);
    const sources = [...new Set(top.map((s) => s.c.url))].slice(0, 3);
    return res.status(200).json({ answer, sources });
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('missing_key')) return res.status(503).json({ error: 'Chat is not configured yet. Please try again later.' });
    if (msg.includes('gemini_429')) return res.status(503).json({ error: 'The free AI quota is busy right now — please try again in a minute.' });
    return res.status(502).json({ error: 'AI service error. Please try again.' });
  }
};
