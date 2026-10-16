# SiteChat — Free AI Chatbot API

RAG chatbot backend serving multiple sites. Zero-cost design:
- Keyword retrieval (BM25-lite) over crawled site content — no embedding API
- Google Gemini free tier for answer generation
- Vercel serverless (free tier)

## Sites
| Site key | Source |
|---|---|
| `thedesignpk` | thedesignpk.com (pilot) |

## API
POST /api/chat `{ site, message, history? }` → `{ answer, sources[] }`

## Add a site
1. `python3 pipeline/crawl.py <sitekey> <urls.txt>`
2. Deploy (data/*.json is bundled)
