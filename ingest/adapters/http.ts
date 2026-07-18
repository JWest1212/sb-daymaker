// ingest/adapters/http.ts
//
// Shared HTML fetch for the scrape adapters + the per-source MANAGED-SCRAPE switch
// (Doc 11 §11 Phase 14, the Option-C reserve). By default a source is fetched with
// a plain UA'd request. A single blocked source can be routed through a managed
// scraper (Scrapfly here; Apify is a one-function swap) WITHOUT a code change, // just add its key to the MANAGED_SCRAPE env list (or set useManagedScrape on the
// adapter). OFF by default: no env + no flag => plain fetch, no third-party calls.

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';

/** Is this source opted in to managed scraping? (env list or the adapter flag.) */
export function isManaged(sourceKey: string, flag?: boolean): boolean {
  if (flag) return true;
  const list = (process.env.MANAGED_SCRAPE ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(sourceKey);
}

/** Build the Scrapfly request URL (anti-bot + JS render) for a target page. */
function scrapflyUrl(target: string): string {
  const key = process.env.SCRAPFLY_KEY ?? '';
  const q = new URLSearchParams({ key, url: target, render_js: 'true', asp: 'true', country: 'us' });
  return `https://api.scrapfly.io/scrape?${q}`;
}

async function plainGet(url: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.text();
    } catch (err) { if (attempt === 1) throw err; }
  }
  throw new Error('unreachable');
}

async function managedGet(url: string): Promise<string> {
  if (!process.env.SCRAPFLY_KEY) throw new Error('MANAGED_SCRAPE on but SCRAPFLY_KEY not set');
  const res = await fetch(scrapflyUrl(url));
  if (!res.ok) throw new Error(`Scrapfly ${res.status}`);
  const json: { result?: { content?: string } } = await res.json();
  const html = json?.result?.content;
  if (!html) throw new Error('Scrapfly returned no content');
  return html;
}

/** Fetch a page's HTML, plain by default, managed when the source is opted in. */
export function fetchHtml(url: string, sourceKey: string, flag?: boolean): Promise<string> {
  return isManaged(sourceKey, flag) ? managedGet(url) : plainGet(url);
}
