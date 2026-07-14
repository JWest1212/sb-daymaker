import { describe, it, expect } from 'vitest';
import { resolveNeighborhood, autoWrites, type VenueDictEntry, type ResolvableThing } from './resolveNeighborhood';

const DICTIONARY: VenueDictEntry[] = [
  { name: 'SOhO Restaurant & Music Club', name_norm: 'soho restaurant music club', neighborhood: 'downtown', place_id: 'place-soho', aliases: ['SOhO'] },
  { name: 'Santa Barbara Bowl', name_norm: 'santa barbara bowl', neighborhood: 'riviera', place_id: null, aliases: ['SB Bowl'] },
  { name: 'MOXI, The Wolf Museum of Exploration + Innovation', name_norm: 'moxi the wolf museum of exploration innovation', neighborhood: 'funk_zone', place_id: null, aliases: ['MOXI'] },
];

function thing(over: Partial<ResolvableThing> = {}): ResolvableThing {
  return {
    title: 'Some Event',
    address: null,
    place_id: null,
    source_url: null,
    lat: null,
    lng: null,
    neighborhood: null,
    ...over,
  };
}

describe('resolveNeighborhood — Doc 19 §4.1 waterfall', () => {
  it('1. place_id match wins over everything else, confidence 0.98', () => {
    const r = resolveNeighborhood(
      thing({ place_id: 'place-soho', title: 'Karaoke Night', address: '999 Not Real Ave', lat: 34.44, lng: -119.63 }),
      DICTIONARY,
    );
    expect(r).toEqual({ neighborhood: 'downtown', method: 'place_id', confidence: 0.98 });
  });

  it('2. venue-name match via alias in the title, confidence 0.9', () => {
    const r = resolveNeighborhood(thing({ title: 'First Fridays at MOXI' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'funk_zone', method: 'venue_name', confidence: 0.9 });
  });

  it('2. venue-name match via full name in the address', () => {
    const r = resolveNeighborhood(thing({ title: 'Whale Talk', address: 'Santa Barbara Bowl, 1122 N Milpas St' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'riviera', method: 'venue_name', confidence: 0.9 });
  });

  it('3. source-implied venue via sourceKeyOf, confidence 0.85', () => {
    const r = resolveNeighborhood(thing({ source_url: 'https://sohosb.com/events/some-show' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'downtown', method: 'source', confidence: 0.85 });
  });

  it('3. aggregator sources never imply a single neighborhood', () => {
    const r = resolveNeighborhood(thing({ source_url: 'https://eventbrite.com/e/some-event' }), DICTIONARY);
    expect(r.method).not.toBe('source');
  });

  it('4. point-in-polygon over stored lat/lng, confidence 0.75', () => {
    const r = resolveNeighborhood(thing({ lat: 34.4142, lng: -119.6889 }), DICTIONARY); // funk zone centroid
    expect(r).toEqual({ neighborhood: 'funk_zone', method: 'point_in_polygon', confidence: 0.75 });
  });

  it('5. street match on State St block number, confidence 0.6 (downtown range)', () => {
    const r = resolveNeighborhood(thing({ address: '1214 State St, Santa Barbara, CA' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'downtown', method: 'street', confidence: 0.6 });
  });

  it('5. street match on low State St block number resolves funk_zone', () => {
    const r = resolveNeighborhood(thing({ address: '137 State St, Santa Barbara, CA' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'funk_zone', method: 'street', confidence: 0.6 });
  });

  it('5. street match on a named corridor', () => {
    const r = resolveNeighborhood(thing({ address: '900 Coast Village Rd, Montecito, CA' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'montecito', method: 'street', confidence: 0.6 });
  });

  it('6. keeps an existing real neighborhood when nothing stronger fires', () => {
    const r = resolveNeighborhood(thing({ neighborhood: 'goleta' }), DICTIONARY);
    expect(r).toEqual({ neighborhood: 'goleta', method: 'existing', confidence: 1 });
  });

  it("6. is a no-op for the sweep's residue (existing is other/null by construction)", () => {
    const r = resolveNeighborhood(thing({ neighborhood: 'other' }), DICTIONARY);
    expect(r.method).toBe('unresolved');
  });

  it('7. unresolved when nothing matches at all', () => {
    const r = resolveNeighborhood(thing(), DICTIONARY);
    expect(r).toEqual({ neighborhood: null, method: 'unresolved', confidence: 0 });
  });

  it('is pure: identical input always returns an identical result', () => {
    const t = thing({ title: 'Show at MOXI' });
    expect(resolveNeighborhood(t, DICTIONARY)).toEqual(resolveNeighborhood(t, DICTIONARY));
  });
});

describe('autoWrites — Doc 19 §4.2 write policy', () => {
  it('auto-writes at or above 0.75 (methods 1-4)', () => {
    expect(autoWrites({ neighborhood: 'downtown', method: 'place_id', confidence: 0.98 })).toBe(true);
    expect(autoWrites({ neighborhood: 'downtown', method: 'venue_name', confidence: 0.9 })).toBe(true);
    expect(autoWrites({ neighborhood: 'downtown', method: 'source', confidence: 0.85 })).toBe(true);
    expect(autoWrites({ neighborhood: 'downtown', method: 'point_in_polygon', confidence: 0.75 })).toBe(true);
  });

  it('never auto-writes the street tier (0.6) — soft suggestion only', () => {
    expect(autoWrites({ neighborhood: 'downtown', method: 'street', confidence: 0.6 })).toBe(false);
  });

  it('never auto-writes unresolved', () => {
    expect(autoWrites({ neighborhood: null, method: 'unresolved', confidence: 0 })).toBe(false);
  });
});
