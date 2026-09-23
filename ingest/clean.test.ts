import { describe, it, expect } from 'vitest';
import { cleanTitle, expandAcronyms, normalizeCasing, cleanBlurb } from './clean';

describe('expandAcronyms (R1 W5.1)', () => {
  it('expands LOTG, the bookmobile abbreviation nobody outside the library knows', () => {
    // 78 published rows were titled this way (TP-A8-04).
    expect(expandAcronyms('LOTG | Shoreline Park')).toBe('Library on the Go | Shoreline Park');
  });

  it('expands the other library and museum initialisms', () => {
    expect(expandAcronyms('SBPL Works! Typing Course')).toContain('Santa Barbara Public Library');
    expect(expandAcronyms('SBMA Teen Art Party')).toContain('Santa Barbara Museum of Art');
  });

  it('leaves genuine initialisms alone', () => {
    expect(expandAcronyms('SBCC West Campus')).toBe('SBCC West Campus');
    expect(expandAcronyms('UCSB Arts & Lectures')).toBe('UCSB Arts & Lectures');
  });

  it('matches on word boundaries only', () => {
    expect(expandAcronyms('LOTGX Session')).toBe('LOTGX Session');
  });
});

describe('normalizeCasing (R1 W5.1)', () => {
  it('calms a shouting title', () => {
    expect(normalizeCasing('CONTRA DANCE WITH THE CHOPPED LIVER BAND'))
      .toBe('Contra Dance with the Chopped Liver Band');
  });

  it('keeps a genuine initialism capitalised while calming the rest', () => {
    // SBCC is marked "keep" in acronyms.json. SBMA is marked "expand", so by the
    // time casing runs in cleanTitle() it is already spelled out.
    expect(normalizeCasing('OPEN HOUSE AT SBCC WEST CAMPUS')).toBe('Open House at SBCC West Campus');
  });

  it('leaves a properly cased title completely alone', () => {
    const good = 'Live Jazz at SOhO with the Molly Miller Trio';
    expect(normalizeCasing(good)).toBe(good);
  });

  it('capitalises a title that opens lowercase', () => {
    expect(normalizeCasing('the genuine Article')).toBe('The genuine Article');
  });

  it('does not touch a title with a few capitals in it', () => {
    expect(normalizeCasing('Beck: Ride Lonesome Tour')).toBe('Beck: Ride Lonesome Tour');
  });
});

describe('cleanTitle (R1 W5.1)', () => {
  it('splits Title | Venue and expands the acronym in one pass', () => {
    expect(cleanTitle('LOTG | Shoreline Park')).toEqual({
      title: 'Library on the Go',
      venueName: 'Shoreline Park',
    });
  });

  it('keeps a title with no pipe unchanged', () => {
    expect(cleanTitle('Beck: Ride Lonesome Tour')).toEqual({
      title: 'Beck: Ride Lonesome Tour',
      venueName: null,
    });
  });

  it('takes the first segment as the name and the last as the venue', () => {
    expect(cleanTitle('Chess Club | Weekly | Louise Lowry Davis Center')).toEqual({
      title: 'Chess Club',
      venueName: 'Louise Lowry Davis Center',
    });
  });

  it('does not treat a repeated title as a venue', () => {
    expect(cleanTitle('Creek Week | Creek Week').venueName).toBeNull();
  });

  it('handles a stray trailing pipe', () => {
    expect(cleanTitle('Volunteer Gardening |')).toEqual({
      title: 'Volunteer Gardening',
      venueName: null,
    });
  });
});

describe('cleanBlurb (R1 W5.1)', () => {
  it('lifts a street address out of a blurb', () => {
    const r = cleanBlurb('1112 State St. Live music every Friday in the back room.');
    expect(r.blurb).toBe('Live music every Friday in the back room.');
    expect(r.address).toBe('1112 State St');
  });

  it('lifts an address with a city after it', () => {
    const r = cleanBlurb('414 N Salsipuedes St, Santa Barbara, CA 93103. Tastings all afternoon.');
    expect(r.blurb).toBe('Tastings all afternoon.');
    expect(r.address).toContain('Salsipuedes');
  });

  it('leaves a blurb with no address alone', () => {
    const text = 'A weekly bookmobile stop with picture books and a story hour.';
    expect(cleanBlurb(text)).toEqual({ blurb: text, address: null });
  });

  it('never returns an empty blurb, even when the address was the whole thing', () => {
    // An empty blurb is worse than a redundant one: the card would show nothing.
    const r = cleanBlurb('1112 State St.');
    expect(r.blurb).not.toBe('');
    expect(r.address).toBe('1112 State St');
  });

  it('handles null and empty input', () => {
    expect(cleanBlurb(null)).toEqual({ blurb: '', address: null });
    expect(cleanBlurb(undefined)).toEqual({ blurb: '', address: null });
  });

  it('does not mistake a year or a price for an address', () => {
    const text = 'Founded in 1927 and still going. Tickets are $25 at the door.';
    expect(cleanBlurb(text)).toEqual({ blurb: text, address: null });
  });
});
