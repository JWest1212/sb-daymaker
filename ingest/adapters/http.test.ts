import { describe, it, expect, afterEach } from 'vitest';
import { isManaged } from './http';

const orig = process.env.MANAGED_SCRAPE;
afterEach(() => { process.env.MANAGED_SCRAPE = orig; });

describe('isManaged — the per-source reserve switch (off by default)', () => {
  it('is OFF when nothing is set', () => {
    delete process.env.MANAGED_SCRAPE;
    expect(isManaged('soho')).toBe(false);
  });
  it('opts in only the listed source key', () => {
    process.env.MANAGED_SCRAPE = 'soho, livenotes';
    expect(isManaged('soho')).toBe(true);
    expect(isManaged('livenotes')).toBe(true);
    expect(isManaged('independent')).toBe(false);
  });
  it('the adapter flag forces it on regardless of the env', () => {
    delete process.env.MANAGED_SCRAPE;
    expect(isManaged('citysb', true)).toBe(true);
  });
});
