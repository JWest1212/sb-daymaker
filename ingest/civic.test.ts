import { describe, it, expect } from 'vitest';
import { isCivic, isCivicSource, isCivicTitle, isClosureTitle, civicReason } from './civic';

describe('civic sources (R1 W2.3, D3)', () => {
  it('does not blanket-flag the city calendar, which is a mixed source', () => {
    // It carries Planning Commission AND Friday Night Swing. Judging it by
    // source would hide the second along with the first, so rows from it are
    // judged by title. See the note on CIVIC_SOURCES.
    expect(isCivicSource({ source: 'citysb' })).toBe(false);
    expect(isCivicSource({ sourceUrl: 'https://calendar.santabarbaraca.gov/event/x' })).toBe(false);
  });

  it('does not flag an unrelated source', () => {
    expect(isCivicSource({ source: 'soho', sourceUrl: 'https://sohosb.com/events' })).toBe(false);
  });

  it('separates meetings from programming on the city calendar', () => {
    const fromCity = (title: string) => isCivic({ title, source: 'citysb', sourceUrl: 'https://calendar.santabarbaraca.gov/event/x' });
    // Municipal business: hidden.
    for (const t of ['Planning Commission', 'City Council', 'Single Family Design Board - Consent', 'Staff Hearing Officer', 'Sign Committee (SIGN)', 'Santa Barbara Youth Council', 'Water Commission: Cancelled']) {
      expect(fromCity(t), t).toBe(true);
    }
    // The city's own public programming: kept.
    for (const t of ['Friday Night Swing | Carrillo Recreation Center', 'Santa Barbara Arts & Crafts Show | Cabrillo Boulevard', 'Chess Club | Louise Lowry Davis Center', 'Scrabble Club | Louise Lowry Davis Center', 'Volunteer Gardening | Alice Keck Park Memorial Garden', 'Knitting & Crochet Club | Louise Lowry Davis Center', 'Creek Week: Land Shark Tour', 'Neighborhood Cleanup | Cacique Street & South Alisos Street']) {
      expect(fromCity(t), t).toBe(false);
    }
  });
});

describe('civic titles', () => {
  it('flags the three the audit named', () => {
    expect(isCivicTitle('Single Family Design Board - Consent')).toBe(true);
    expect(isCivicTitle('Santa Barbara Youth Council')).toBe(true);
    expect(isCivicTitle('S.B. Independent: Santa Barbara City Council District 6 Forum')).toBe(true);
  });

  it('flags meetings, hearings and agendas', () => {
    expect(isCivicTitle('Special Meeting: Access Advisory Committee')).toBe(true);
    expect(isCivicTitle('Planning Commission')).toBe(true);
    expect(isCivicTitle('Public Hearing on the Draft Budget')).toBe(true);
    expect(isCivicTitle('Harbor Commission Agenda')).toBe(true);
    expect(isCivicTitle('Arts Advisory Meeting')).toBe(true);
    // ...but a board IS civic in a municipal shape.
    expect(isCivicTitle('Single Family Design Board')).toBe(true);
    expect(isCivicTitle('Board of Supervisors')).toBe(true);
    expect(isCivicTitle('Architectural Board of Review')).toBe(true);
    expect(isCivicTitle('Board Meeting')).toBe(true);
    // ...but a library's Teen Advisory Board is a teen program, not city business.
    expect(isCivicTitle('Teen Advisory Board')).toBe(false);
  });

  it('respects word boundaries, so ordinary listings are not swept up', () => {
    // These are the false positives a naive substring match would produce.
    expect(isCivicTitle('Boardwalk Stroll')).toBe(false);
    expect(isCivicTitle('Skateboard Jam')).toBe(false);
    expect(isCivicTitle('Counciling for Couples')).toBe(false);
    // "board" on its own is not civic: these are real leisure listings.
    expect(isCivicTitle('Charcuterie Board Workshop')).toBe(false);
    expect(isCivicTitle('Board Game Night at the Brewery')).toBe(false);
    expect(isCivicTitle('Paddle Board Yoga at the Harbor')).toBe(false);
  });

  it('leaves genuine leisure listings alone', () => {
    for (const t of [
      'Live Jazz at SOhO',
      'Santa Barbara Wine Festival (38th Annual)',
      'Recreation Swim | Oak Park Wading Pool',
      'Helena Avenue Bakery',
      'Downtown Santa Barbara Saturday Farmers Market',
    ]) {
      expect(isCivicTitle(t), t).toBe(false);
    }
  });

  it('does not treat a consent form or consent decree as an agenda item', () => {
    expect(isCivicTitle('Photo consent form workshop')).toBe(false);
  });
});

describe('closure and holiday notices (EXP-010)', () => {
  it('flags the shapes that are the absence of an event', () => {
    expect(isClosureTitle('Independence Day - Holiday Observed')).toBe(true);
    expect(isClosureTitle('Library Closed for Thanksgiving')).toBe(true);
    expect(isClosureTitle('Offices Closed')).toBe(true);
    expect(isClosureTitle('No Service in Observance of Labor Day')).toBe(true);
    expect(isClosureTitle('Delayed Opening Hours')).toBe(true);
  });

  it('leaves a real holiday event alone', () => {
    expect(isClosureTitle('Fourth of July Fireworks at the Harbor')).toBe(false);
    expect(isClosureTitle('Holiday Parade Downtown')).toBe(false);
  });
});

describe('isCivic and civicReason', () => {
  it('combines the three rules', () => {
    expect(isCivic({ title: 'Live Jazz', source: 'soho' })).toBe(false);
    expect(isCivic({ title: 'Live Jazz', source: 'citysb' })).toBe(false);
    expect(isCivic({ title: 'Planning Commission', source: 'independent' })).toBe(true);
    expect(isCivic({ title: 'Holiday Observed', source: 'libraries' })).toBe(true);
  });

  it('names which rule caught the row, source first', () => {
    expect(civicReason({ title: 'Planning Commission', source: 'citysb' })).toBe('title');
    expect(civicReason({ title: 'Planning Commission', source: 'independent' })).toBe('title');
    expect(civicReason({ title: 'Holiday Observed', source: 'libraries' })).toBe('closure');
    expect(civicReason({ title: 'Live Jazz', source: 'soho' })).toBeNull();
  });

  it('handles a missing title without throwing', () => {
    expect(isCivic({ title: null, source: 'soho' })).toBe(false);
    expect(isCivic({})).toBe(false);
  });
});
