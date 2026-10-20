# SiteChat — Free AI Chatbot API

RAG chatbot backend serving multiple sites. Zero-cost design:
- Keyword retrieval (BM25-lite) over crawled site content — no embedding API
- Google Gemini free tier for answer generation
- Vercel serverless (free tier)

## Sites
| Site key | Source |
|---|---|
| `thedesignpk` | thedesignpk.com (pilot) |
| `newthedesignpk` | new.thedesignpk.com — alias of `thedesignpk` (same business, shares its data file) |
| `globalmortgagecalc` | globalmortgagecalc.com |
| `punjabkhussahouse` | punjabkhussahouse.com |
| `goldratestoday` | goldratestoday.ae (EN pages) |
| `goldpricestoday` | goldpricestoday.ca (EN pages) |
| `mathsolverfree` | mathsolverfree.com (EN pages) |
| `snowdayplanner` | snowdayplanner.com (EN pages) |

## API
POST /api/chat `{ site, message, history? }` → `{ answer, sources[] }`

## Add a site
1. `python3 pipeline/crawl.py <sitekey> <urls.txt>`
2. Deploy (data/*.json is bundled)
