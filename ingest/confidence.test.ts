import { describe, it, expect } from 'vitest';
import {
  computeDataConfidence, sourceTrustScore, extractionMethodScore, fieldCompletenessScore,
  crossSourceAgreementScore, recencyScore, findabilityScore, confidenceReasons, CONFIDENCE_WEIGHTS,
  type ThingForConfidence, type SourceMeta,
} from './confidence';

const NOW = new Date('2026-07-16T12:00:00-07:00');

function thing(over: Partial<ThingForConfidence>): ThingForConfidence {
  return {
    happening_tier: 1,
    starts_at: '2026-07-20T19:00:00-07:00',
    address: '1221 State St, Santa Barbara, CA',
    blurb: 'A great night out.',
    photo_url: 'https://images.example.com/x.jpg',
    photo_source: 'wikimedia',
    nearby_zone: 'downtown',
    activities: ['live_music'],
    last_confirmed: '2026-07-16',
    source_count: 1,
    ...over,
  };
}

const trustedSource: SourceMeta = { authority: 0.98, reliability: 1.0, lane: 'structured' };

describe('CONFIDENCE_WEIGHTS', () => {
  it('sums to 1.0 (the whole dial in one place)', () => {
    const total = Object.values(CONFIDENCE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

describe('sourceTrustScore', () => {
  it('blends authority and reliability', () => {
    expect(sourceTrustScore({ authority: 1.0, reliability: 1.0, lane: 'structured' })).toBe(1.0);
    expect(sourceTrustScore({ authority: 0.5, reliability: 0.5, lane: 'structured' })).toBe(0.5);
  });
  it('never reads sponsor status — the input shape has no such field, so an unmatched source sorts last', () => {
    expect(sourceTrustScore(undefined)).toBe(0);
  });
});

describe('extractionMethodScore', () => {
  it('scores structured lane at 1.0 regardless of source_count', () => {
    expect(extractionMethodScore({ authority: 0.5, reliability: 0.5, lane: 'structured' }, 1)).toBe(1.0);
  });
  it('scores AI-extracted (generic lane) lower, and corroborated above single-source', () => {
    const ai: SourceMeta = { authority: 0.5, reliability: 0.5, lane: 'generic' };
    expect(extractionMethodScore(ai, 1)).toBe(0.4);
    expect(extractionMethodScore(ai, 2)).toBe(0.6);
  });
  it('treats an unmatched source as conservatively as a single-source AI extraction', () => {
    expect(extractionMethodScore(undefined, 1)).toBe(0.4);
  });
});

describe('fieldCompletenessScore', () => {
  it('is 1.0 for a fully-filled Tier-1 event', () => {
    expect(fieldCompletenessScore(thing({}))).toBe(1.0);
  });
  it('drops for a Tier-1 event missing a start time', () => {
    expect(fieldCompletenessScore(thing({ starts_at: null }))).toBe(0.75);
  });
  it('does not penalize Tier-3 (evergreen) for having no start time', () => {
    expect(fieldCompletenessScore(thing({ happening_tier: 3, starts_at: null }))).toBe(1.0);
  });
  it('Tier-2 date/time is satisfied by a confirmed schedule even with no starts_at', () => {
    expect(fieldCompletenessScore(thing({ happening_tier: 2, starts_at: null, scheduleConfirmed: true }))).toBe(1.0);
  });
  it('Tier-2 with a time-TBD schedule (unconfirmed) is missing its date/time slot', () => {
    expect(fieldCompletenessScore(thing({ happening_tier: 2, starts_at: null, scheduleConfirmed: false }))).toBe(0.75);
  });
  it('a placeholder photo does not count as an image', () => {
    expect(fieldCompletenessScore(thing({ photo_source: 'placeholder' }))).toBe(0.75);
  });
});

describe('crossSourceAgreementScore', () => {
  it('is neutral (not penalized) for the default single-source case', () => {
    expect(crossSourceAgreementScore(1)).toBe(0.5);
  });
  it('rewards corroboration', () => {
    expect(crossSourceAgreementScore(2)).toBe(0.8);
    expect(crossSourceAgreementScore(3)).toBe(1.0);
  });
});

describe('recencyScore', () => {
  it('scores a same-day confirmation highest', () => {
    expect(recencyScore('2026-07-16', NOW)).toBe(1.0);
  });
  it('decays with staleness', () => {
    expect(recencyScore('2026-07-10', NOW)).toBe(0.8);  // 6 days
    expect(recencyScore('2026-06-20', NOW)).toBe(0.5);  // 26 days
    expect(recencyScore('2026-05-01', NOW)).toBe(0.25); // ~76 days
    expect(recencyScore('2026-01-01', NOW)).toBe(0.1);
  });
  it('is 0 with no last_confirmed at all', () => {
    expect(recencyScore(null, NOW)).toBe(0);
  });
});

describe('findabilityScore', () => {
  it('is 1.0 with a resolved zone and an activity tag', () => {
    expect(findabilityScore(thing({}))).toBe(1.0);
  });
  it('lowers but the caller decides whether it blocks — this is just the number', () => {
    expect(findabilityScore(thing({ nearby_zone: null, activities: [] }))).toBe(0);
    expect(findabilityScore(thing({ nearby_zone: null }))).toBe(0.5);
  });
});

describe('computeDataConfidence', () => {
  it('scores a fully-corroborated, high-authority, fresh, complete Tier-1 event near 1.0', () => {
    const { score } = computeDataConfidence(
      thing({ source_count: 3 }),
      trustedSource,
      NOW,
    );
    expect(score).toBeGreaterThanOrEqual(0.9);
  });
  it('scores a bare-minimum, unmatched-source, stale row near 0', () => {
    const { score } = computeDataConfidence(
      thing({
        address: null, blurb: null, photo_source: 'placeholder', nearby_zone: null,
        activities: [], last_confirmed: '2025-01-01', starts_at: null,
      }),
      undefined,
      NOW,
    );
    expect(score).toBeLessThan(0.2);
  });
  it('never reads sponsor_id or is_featured — the input types carry no such field', () => {
    // Type-level guarantee: ThingForConfidence has no sponsor/featured field, so
    // there is no way for this function to read one. This test documents that intent.
    const { breakdown } = computeDataConfidence(thing({}), trustedSource, NOW);
    expect(Object.keys(breakdown).sort()).toEqual(
      ['crossSourceAgreement', 'extractionMethod', 'fieldCompleteness', 'findability', 'recency', 'sourceTrust'],
    );
  });
});

describe('confidenceReasons', () => {
  it('returns nothing for a strong, fully-corroborated item — nothing meaningful to explain', () => {
    expect(confidenceReasons(thing({ source_count: 3 }), trustedSource, NOW)).toEqual([]);
  });
  it('names the specific missing fields, not the weight name', () => {
    const reasons = confidenceReasons(thing({ address: null, photo_source: 'placeholder' }), trustedSource, NOW);
    expect(reasons).toContain('no address');
    expect(reasons).toContain('no photo yet');
  });
  it('flags a single-source item', () => {
    expect(confidenceReasons(thing({ source_count: 1 }), trustedSource, NOW)).toContain('single source');
  });
  it('flags an unmatched source distinctly from a merely lower-trust one', () => {
    expect(confidenceReasons(thing({}), undefined, NOW)).toContain('source not yet rated');
    const lowTrust: SourceMeta = { authority: 0.4, reliability: 0.5, lane: 'structured' };
    expect(confidenceReasons(thing({}), lowTrust, NOW)).toContain('lower-trust source');
  });
  it('caps at 3 reasons, worst first', () => {
    const reasons = confidenceReasons(
      thing({
        address: null, blurb: null, photo_source: 'placeholder', nearby_zone: null,
        activities: [], last_confirmed: '2025-01-01', starts_at: null,
      }),
      undefined,
      NOW,
    );
    expect(reasons.length).toBeLessThanOrEqual(3);
  });
});
