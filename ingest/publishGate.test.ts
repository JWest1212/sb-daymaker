import { describe, it, expect } from 'vitest';
import { classifyBand, AUTO_PUBLISH_GATE, HOLD_FLOOR } from './publishGate';

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
