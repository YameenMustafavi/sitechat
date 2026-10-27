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
| `getmanasik` | getmanasik.com (EN + UR + AR pages) |

## API
POST /api/chat `{ site, message, history?, lang? }` → `{ answer, sources[] }`

Retrieval is exact-token BM25 over the indexed chunks. If a query scores
zero hits (common when a question is written in a language the index does
not contain), the API translates the question to English with Gemini and
retries retrieval once before returning the no-result reply.

## Add a site
1. `python3 pipeline/crawl.py <sitekey> <urls.txt>`
2. Deploy (data/*.json is bundled)

## getmanasik rebuild
`python3 pipeline/crawl.py getmanasik pipeline/getmanasik-urls.txt`
(EN + UR + AR URLs). `pipeline/getmanasik-curated.json` is appended automatically
by crawl.py — it holds four hand-checked chunks (Urdu and Arabic contact page,
and Urdu and Arabic how-it-works steps) whose facts are copied verbatim from
the site's own pages/messages; the crawl alone cannot connect the natural
Urdu/Arabic phrasings of those questions to the page text.
