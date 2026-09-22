import { describe, it, expect } from 'vitest';
import { cleanText, hasEmDash, stripEmDash } from './stripEmDash';

// The em dash (U+2014) is referenced only via String.fromCharCode so this test
// file stays literally em-dash free and the CI gate needs no exception for it.
const EM = String.fromCharCode(0x2014);

describe('stripEmDash (G0.9 / A0.9c)', () => {
  it('turns a numeric range into " to "', () => {
    expect(stripEmDash('5' + EM + '8pm')).toBe('5 to 8pm');
    expect(stripEmDash('5' + EM + '8pm')).not.toContain(EM);
  });
  it('turns a spaced prose dash into a comma', () => {
    expect(stripEmDash('The Lark ' + EM + ' a Funk Zone spot')).toBe('The Lark, a Funk Zone spot');
  });
  it('leaves clean text untouched', () => {
    expect(stripEmDash('nothing to do here')).toBe('nothing to do here');
  });
  it('hasEmDash detects the character', () => {
    expect(hasEmDash('a' + EM + 'b')).toBe(true);
    expect(hasEmDash('a, b')).toBe(false);
  });
  it('cleanText is null-safe and only rewrites dirty strings', () => {
    expect(cleanText(null)).toBeNull();
    expect(cleanText(undefined)).toBeUndefined();
    expect(cleanText('clean')).toBe('clean');
    expect(cleanText('x' + EM + 'y')).toBe('x, y');
  });
});

// R1 W8.4 (D9). En dashes, referenced by code point like the em dash above.
const EN = String.fromCharCode(0x2013);
describe('en dashes (D9)', () => {
  it('a digit range keeps a hyphen', () => {
    expect(stripEmDash('5' + EN + '7 PM')).toBe('5-7 PM');
    expect(stripEmDash('Season 2026' + EN + '27')).toBe('Season 2026-27');
  });
  it('a range between named days or months reads "to"', () => {
    expect(stripEmDash('Monday ' + EN + ' Friday')).toBe('Monday to Friday');
    expect(stripEmDash('Open Sept' + EN + 'Oct')).toBe('Open Sept to Oct');
  });
  it('the live separator case becomes a comma, not "to"', () => {
    const title = '\u201cThe Lost Weekend\u201d ' + EN + ' The Photography of May Pang';
    expect(stripEmDash(title)).toBe('\u201cThe Lost Weekend\u201d, The Photography of May Pang');
  });
  it('a clock range reads "to", and the live mixed case works', () => {
    expect(stripEmDash('10am' + EN + '2pm')).toBe('10am to 2pm');
    expect(stripEmDash('Open Tue' + EN + 'Sun 11' + EN + '5 (closed Mondays).')).toBe('Open Tue to Sun 11-5 (closed Mondays).');
  });
  it('cleanText rewrites en dashes and hasEmDash sees them', () => {
    expect(cleanText('a ' + EN + ' b')).toBe('a, b');
    expect(hasEmDash('a' + EN + 'b')).toBe(true);
  });
});
