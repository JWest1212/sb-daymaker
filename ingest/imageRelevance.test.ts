import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkImageRelevance } from './imageRelevance';

// Mirrors enrich.test.ts's scope: exercise the deterministic guard behavior (empty
// input, missing key) without making a live Claude call. The chunking/prompt/schema
// plumbing is exercised end-to-end via the real nightly pipeline, not here.

describe('checkImageRelevance — fail-soft guard behavior', () => {
  const savedKey = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedKey;
  });

  it('returns an empty map for empty input (no call attempted)', async () => {
    const result = await checkImageRelevance([]);
    expect(result.size).toBe(0);
  });

  it('returns an empty map when ANTHROPIC_API_KEY is unset — every candidate defaults to relevant', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await checkImageRelevance([
      { id: 'a', title: 'Library Exhibit', category: 'culture_spot', imageUrl: 'https://example.com/a.jpg' },
    ]);
    expect(result.size).toBe(0);
    // caller contract: an id absent from the map must be treated as relevant
    expect(result.get('a')).toBeUndefined();
  });
});
