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
