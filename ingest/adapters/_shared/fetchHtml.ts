// ingest/adapters/_shared/fetchHtml.ts
//
// Polite HTML fetcher for Wave 1+ scrape adapters. Wraps the base http.ts with:
//   • 15-second request timeout
//   • Per-source min-interval (500ms default) to avoid hammering small venues
//   • robots.txt checking: cached once per host per run; disallowed path → throw
//     with code 'robots_disallow' so run.ts can log and skip the adapter
//   • Break-glass path: passes useManagedScrape to the underlying http.ts
// Existing adapters (soho, independent, citysb) import from ./http directly and
// are NOT changed. New adapters import from here. (§2.9)

import { fetchHtml as baseFetch } from '../http';

const UA = 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)';
const TIMEOUT_MS = 15_000;
const DEFAULT_MIN_INTERVAL_MS = 500;

// robots.txt cache: host -> { allow: RegExp[]; deny: RegExp[] }
const robotsCache = new Map<string, { allow: RegExp[]; deny: RegExp[] }>();

// Per-source last-request timestamp for rate limiting
const lastRequest = new Map<string, number>();

class RobotsDisallowedError extends Error {
  readonly code = 'robots_disallow';
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

export { RobotsDisallowedError };

function parseRobots(txt: string, ua: string): { allow: RegExp[]; deny: RegExp[] } {
  const allow: RegExp[] = [];
  const deny: RegExp[] = [];
  let relevant = false;
  for (const rawLine of txt.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const [key, ...rest] = line.split(':');
    const val = rest.join(':').trim();
    if (key.toLowerCase() === 'user-agent') {
      relevant = val === '*' || ua.toLowerCase().includes(val.toLowerCase());
      continue;
    }
    if (!relevant) continue;
    if (key.toLowerCase() === 'disallow' && val) {
      deny.push(new RegExp('^' + val.replace(/[.*+?^${}()|[\]\\]/g, (c) => c === '*' ? '.*' : '\\' + c)));
    }
    if (key.toLowerCase() === 'allow' && val) {
      allow.push(new RegExp('^' + val.replace(/[.*+?^${}()|[\]\\]/g, (c) => c === '*' ? '.*' : '\\' + c)));
    }
  }
  return { allow, deny };
}

async function fetchRobots(host: string): Promise<{ allow: RegExp[]; deny: RegExp[] }> {
  if (robotsCache.has(host)) return robotsCache.get(host)!;
  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 5_000);
    const res = await fetch(`https://${host}/robots.txt`, {
      headers: { 'user-agent': UA },
      signal: ac.signal,
    });
    clearTimeout(tid);
    const txt = res.ok ? await res.text() : '';
    const parsed = parseRobots(txt, UA);
    robotsCache.set(host, parsed);
    return parsed;
  } catch {
    // Network error fetching robots.txt → assume allowed (fail open)
    const permissive = { allow: [], deny: [] };
    robotsCache.set(host, permissive);
    return permissive;
  }
}

function isAllowed(path: string, robots: { allow: RegExp[]; deny: RegExp[] }): boolean {
  const denied = robots.deny.some((rx) => rx.test(path));
  if (!denied) return true;
  // An explicit Allow overrides a Deny
  return robots.allow.some((rx) => rx.test(path));
}

async function rateLimit(sourceKey: string, minMs = DEFAULT_MIN_INTERVAL_MS): Promise<void> {
  const last = lastRequest.get(sourceKey) ?? 0;
  const wait = minMs - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest.set(sourceKey, Date.now());
}

/**
 * Polite HTML fetch for Wave 1+ adapters.
 * @param url          Target URL to fetch
 * @param sourceKey    Adapter key (for rate limiting + managed-scrape opt-in)
 * @param opts.skipRobots  Skip robots.txt check (for known-safe hosts)
 * @param opts.managed     Force managed-scrape path (break-glass only)
 */
export async function fetchHtmlPolite(
  url: string,
  sourceKey: string,
  opts: { skipRobots?: boolean; managed?: boolean } = {},
): Promise<string> {
  // Robots check
  if (!opts.skipRobots) {
    let host: string;
    let path: string;
    try {
      const u = new URL(url);
      host = u.host;
      path = u.pathname + u.search;
    } catch {
      throw new Error(`fetchHtmlPolite: invalid URL: ${url}`);
    }
    const robots = await fetchRobots(host);
    if (!isAllowed(path, robots)) {
      throw new RobotsDisallowedError(url);
    }
  }

  // Rate limit
  await rateLimit(sourceKey);

  // Fetch with timeout
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA },
      signal: ac.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return await res.text();
  } catch (err) {
    clearTimeout(tid);
    // On timeout/error, try the base fetcher as a second attempt (it has its own retry)
    if (!opts.managed) {
      return baseFetch(url, sourceKey, false);
    }
    throw err;
  }
}

/** Clear per-run caches (call at the start of a run in tests). */
export function clearFetchCaches(): void {
  robotsCache.clear();
  lastRequest.clear();
}
