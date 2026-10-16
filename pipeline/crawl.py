"""Crawl a site's sitemap URLs, extract main text, chunk, save JSON."""
import urllib.request, re, json, sys, html

def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; SiteChatBot/1.0)'})
    return urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8', 'ignore')

def extract_text(page_html):
    # Drop scripts, styles, nav, footer, header
    h = re.sub(r'<(script|style|nav|footer|header)[^>]*>.*?</\1>', ' ', page_html, flags=re.S|re.I)
    # Grab <main> or <article> if present, else body
    m = re.search(r'<main[^>]*>(.*?)</main>', h, flags=re.S|re.I) or \
        re.search(r'<article[^>]*>(.*?)</article>', h, flags=re.S|re.I) or \
        re.search(r'<body[^>]*>(.*?)</body>', h, flags=re.S|re.I)
    body = m.group(1) if m else h
    # Headings + paragraphs + list items
    parts = re.findall(r'<(h1|h2|h3|p|li)[^>]*>(.*?)</\1>', body, flags=re.S|re.I)
    out = []
    for tag, inner in parts:
        t = re.sub(r'<[^>]+>', ' ', inner)
        t = html.unescape(t)
        t = re.sub(r'\s+', ' ', t).strip()
        if len(t) > 20:
            out.append(('# ' if tag.startswith('h') else '') + t)
    # Dedupe while keeping order
    seen, uniq = set(), []
    for t in out:
        if t not in seen:
            seen.add(t); uniq.append(t)
    return uniq

def chunk_text(blocks, url, title, max_chars=1200):
    chunks, cur = [], ''
    for b in blocks:
        if len(cur) + len(b) + 1 > max_chars and cur:
            chunks.append(cur.strip()); cur = ''
        cur += ('\n' if cur else '') + b
    if cur.strip(): chunks.append(cur.strip())
    return [{'url': url, 'title': title, 'text': c} for c in chunks]

def main(site, url_file):
    urls = [u.strip() for u in open(url_file) if u.strip()]
    all_chunks = []
    for i, url in enumerate(urls):
        try:
            page_html = fetch(url)
            title = re.search(r'<title[^>]*>(.*?)</title>', page_html, flags=re.S|re.I)
            title = html.unescape(re.sub(r'\s+', ' ', title.group(1)).strip()) if title else url
            blocks = extract_text(page_html)
            if not blocks:
                print(f'[{i+1}/{len(urls)}] EMPTY {url}'); continue
            chunks = chunk_text(blocks, url, title)
            all_chunks.extend(chunks)
            print(f'[{i+1}/{len(urls)}] {len(chunks)} chunks — {title[:60]}')
        except Exception as e:
            print(f'[{i+1}/{len(urls)}] FAIL {url}: {e}')
    out = {'site': site, 'chunks': all_chunks}
    path = f'/home/hatch/workspace/sitechat/data/{site}.json'
    json.dump(out, open(path, 'w'), ensure_ascii=False)
    print(f'\nSaved {len(all_chunks)} chunks → {path}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
