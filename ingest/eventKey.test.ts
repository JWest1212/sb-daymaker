import { describe, it, expect } from 'vitest';
import { normalizeTitle, canonicalVenue, cadenceKey, computeEventKey, type VenueDictEntry } from './eventKey';

const SOHO_DICT: VenueDictEntry[] = [
  { name_norm: 'soho restaurant music club', place_id: 'ChIJ-soho-place-id', aliases: ['soho', 'soho music club'] },
];

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation, drops noise words, collapses whitespace', () => {
    expect(normalizeTitle('Molly Miller Trio (Live)')).toBe('molly miller trio');
    expect(normalizeTitle('The Molly Miller Trio Presents:  Special Guests')).toBe('molly miller trio special guests');
  });
});

describe('canonicalVenue', () => {
  it('matches on place_id first, regardless of title/address wording', () => {
    const v = canonicalVenue({ title: 'Some Show', address: null, place_id: 'ChIJ-soho-place-id' }, SOHO_DICT);
    expect(v).toBe('soho restaurant music club');
  });

  it('matches a short alias ("SOhO") against the canonical name via title text', () => {
    const v = canonicalVenue({ title: 'Live at SOhO tonight', address: null }, SOHO_DICT);
    expect(v).toBe('soho restaurant music club');
  });

  it('matches the long form via address text', () => {
    const v = canonicalVenue({ title: 'Molly Miller Trio', address: '1221 State St, SOhO Restaurant & Music Club' }, SOHO_DICT);
    expect(v).toBe('soho restaurant music club');
  });

  it('falls back to normalized address when no dictionary entry matches', () => {
    const v = canonicalVenue({ title: 'Comedy Night', address: '4916 Carpinteria Ave, Carpinteria, CA' }, []);
    expect(v).toBe('4916 carpinteria ave carpinteria ca');
  });

  it('returns null (unknown venue) with no address and no match', () => {
    expect(canonicalVenue({ title: 'Mystery Event', address: null }, SOHO_DICT)).toBeNull();
  });

  it('treats a generic city-level placeholder address (no street number) as unknown, not a venue identity', () => {
    // Found via the Phase 2 shadow report: "Santa Barbara, Santa Barbara, CA"
    // is a civic-source fallback with zero distinguishing power. Without this
    // guard it was causing two DIFFERENT events that both lack a real venue
    // to look like they "agree", and one event's real-venue listing to look
    // like it "disagrees" with its own other listing that just lacks a venue.
    const v = canonicalVenue({ title: 'Some Meeting', address: 'Santa Barbara, Santa Barbara, CA' }, []);
    expect(v).toBeNull();
  });
});

describe('cadenceKey', () => {
  it('is order-independent', () => {
    const a = cadenceKey([{ day_of_week: 3, frequency: 'weekly' }, { day_of_week: 0, frequency: 'monthly' }]);
    const b = cadenceKey([{ day_of_week: 0, frequency: 'monthly' }, { day_of_week: 3, frequency: 'weekly' }]);
    expect(a).toBe(b);
  });

  it('returns null for an empty schedule', () => {
    expect(cadenceKey([])).toBeNull();
  });
});

describe('computeEventKey', () => {
  it('gives the same key to the same dated event from two sources with differently-worded titles at the same venue', () => {
    const tm = computeEventKey({
      title: 'Molly Miller Trio', address: null, place_id: 'ChIJ-soho-place-id',
      happening_tier: 1, starts_at: '2026-07-09T20:00:00-07:00',
    }, SOHO_DICT);
    const soho = computeEventKey({
      title: 'Molly Miller Trio (Live)', address: '1221 State St, SOhO', place_id: null,
      happening_tier: 1, starts_at: '2026-07-09T21:00:00-07:00',
    }, SOHO_DICT);
    expect(tm).not.toBeNull();
    expect(tm).toBe(soho);
  });

  it('gives different keys to two similarly-titled events at DIFFERENT venues (kills the false-merge)', () => {
    const a = computeEventKey({
      title: 'Live Music Night', address: 'Some Bar, 1 Main St', place_id: null,
      happening_tier: 1, starts_at: '2026-07-09T20:00:00-07:00',
    }, []);
    const b = computeEventKey({
      title: 'Live Music Night', address: 'Other Bar, 2 Main St', place_id: null,
      happening_tier: 1, starts_at: '2026-07-09T20:00:00-07:00',
    }, []);
    expect(a).not.toBe(b);
  });

  it('gives different keys to the same title/venue on different days', () => {
    const a = computeEventKey({
      title: 'Open Mic Night', address: '1 Main St', place_id: null,
      happening_tier: 1, starts_at: '2026-07-09T20:00:00-07:00',
    }, []);
    const b = computeEventKey({
      title: 'Open Mic Night', address: '1 Main St', place_id: null,
      happening_tier: 1, starts_at: '2026-07-16T20:00:00-07:00',
    }, []);
    expect(a).not.toBe(b);
  });

  it('keys a recurring (Tier 2) instance on venue+title+cadence, not a date', () => {
    const k = computeEventKey({
      title: 'Wine Down Wednesday', address: '1 Main St', place_id: null,
      happening_tier: 2, starts_at: null,
      recurring: [{ day_of_week: 3, frequency: 'weekly' }],
    }, []);
    expect(k).not.toBeNull();
  });

  it('returns null for Tier 3 evergreen (no event identity to key on)', () => {
    const k = computeEventKey({
      title: 'Some Coffee Shop', address: '1 Main St', place_id: null,
      happening_tier: 3, starts_at: null,
    }, []);
    expect(k).toBeNull();
  });

  it('returns null for a Tier 1 row with no starts_at (defensive; should not happen post-gate)', () => {
    const k = computeEventKey({
      title: 'Broken Row', address: '1 Main St', place_id: null,
      happening_tier: 1, starts_at: null,
    }, []);
    expect(k).toBeNull();
  });
});
