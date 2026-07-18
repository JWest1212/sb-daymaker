import { describe, it, expect } from 'vitest';
import { parseSubmissionWhen } from './submissions';

describe('parseSubmissionWhen, only accepts an explicit date + clock time', () => {
  it('parses a well-formed submitter time', () => {
    expect(parseSubmissionWhen('July 4, 2026 at 7:00 PM')).toBe('2026-07-04T19:00:00-07:00');
    expect(parseSubmissionWhen('Dec 9, 2026 8:30pm')).toBe('2026-12-09T20:30:00-08:00');
  });
  it('refuses vague prose (gate then drops the event)', () => {
    expect(parseSubmissionWhen('Saturday at 8-ish')).toBeNull();
    expect(parseSubmissionWhen('this weekend')).toBeNull();
    expect(parseSubmissionWhen('July 4th, 7pm')).toBeNull(); // no explicit year
    expect(parseSubmissionWhen('')).toBeNull();
    expect(parseSubmissionWhen(undefined)).toBeNull();
  });
});
