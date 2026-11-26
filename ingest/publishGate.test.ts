import { describe, it, expect } from 'vitest';
import { classifyBand, meetsGreenChipRule, isGreenChip, AUTO_PUBLISH_GATE, HOLD_FLOOR, GREEN_CHIP_AUTO_PUBLISH } from './publishGate';
import { chipFor } from '../lib/review';

describe('classifyBand', () => {
  it('auto-publishes only when confidence, source authority, AND structured lane all clear the bar', () => {
    expect(classifyBand({ confidence: 0.95, sourceAuthority: 0.98, lane: 'structured' })).toBe('auto_publish');
  });
  it('falls to review when confidence is high but source authority is not (e.g. a civic aggregator)', () => {
    expect(classifyBand({ confidence: 0.95, sourceAuthority: 0.69, lane: 'structured' })).toBe('review');
  });
  it('falls to review when everything else clears but the lane is not structured (spec 25 AI-extracted)', () => {
    expect(classifyBand({ confidence: 0.99, sourceAuthority: 1.0, lane: 'generic' })).toBe('review');
  });
  it('falls to review when confidence itself is short of the floor, even from a trusted structured source', () => {
    expect(classifyBand({ confidence: 0.80, sourceAuthority: 0.98, lane: 'structured' })).toBe('review');
  });
  it('never auto-publishes an unmatched/unknown source', () => {
    expect(classifyBand({ confidence: 0.95, sourceAuthority: undefined, lane: undefined })).toBe('review');
  });
  it('holds anything below the hold floor regardless of source', () => {
    expect(classifyBand({ confidence: HOLD_FLOOR - 0.01, sourceAuthority: 0.98, lane: 'structured' })).toBe('hold');
  });
  it('is review, not hold, exactly at the hold floor', () => {
    expect(classifyBand({ confidence: HOLD_FLOOR, sourceAuthority: 0.5, lane: 'structured' })).toBe('review');
  });
  it('is auto_publish, not review, exactly at the auto-publish floors', () => {
    expect(classifyBand({
      confidence: AUTO_PUBLISH_GATE.minConfidence,
      sourceAuthority: AUTO_PUBLISH_GATE.minSourceAuthority,
      lane: 'structured',
    })).toBe('auto_publish');
  });
});

describe('green-chip auto-publish (2026-11-26)', () => {
  const low = { confidence: 0.2, sourceAuthority: 0.5, lane: 'generic' };

  it('auto-publishes a dated event with a start time, whatever its confidence or source trust', () => {
    expect(classifyBand({ ...low, tier: 1, startsAt: '2026-12-05T20:00:00-08:00', source: 'https://www.santabarbaraca.gov/x' })).toBe('auto_publish');
  });
  it('auto-publishes a recurring thing that carries a start time', () => {
    expect(classifyBand({ ...low, confidence: 0.6, tier: 2, startsAt: '2026-12-02T18:00:00-08:00', source: 'https://example.com' })).toBe('auto_publish');
  });
  it('leaves amber (no start time) to the confidence rule', () => {
    expect(classifyBand({ ...low, confidence: 0.6, tier: 2, startsAt: null, source: 'https://example.com' })).toBe('review');
    expect(classifyBand({ ...low, tier: 2, startsAt: null, source: 'https://example.com' })).toBe('hold');
  });
  it('leaves evergreen to the confidence rule, even with a start value', () => {
    expect(classifyBand({ ...low, confidence: 0.6, tier: 3, startsAt: '2026-12-05T20:00:00-08:00', source: 'https://example.com' })).toBe('review');
  });
  it('never auto-publishes a public submission on the green-chip rule', () => {
    const sub = { ...low, confidence: 0.6, tier: 1, startsAt: '2026-12-05T20:00:00-08:00', source: 'submission:abc' };
    expect(meetsGreenChipRule(sub)).toBe(false);
    expect(classifyBand(sub)).toBe('review');
  });
  it('matches the cockpit chip exactly', () => {
    expect(isGreenChip(1, '2026-12-05T20:00:00-08:00')).toBe(chipFor(1, '2026-12-05T20:00:00-08:00') === 'green');
    expect(isGreenChip(2, null)).toBe(false);
    expect(isGreenChip(3, '2026-12-05T20:00:00-08:00')).toBe(false);
    expect(GREEN_CHIP_AUTO_PUBLISH.enabled).toBe(true);
  });
});
