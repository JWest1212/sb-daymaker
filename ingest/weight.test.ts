import { describe, it, expect } from 'vitest';
import { classifyWeight } from './weight';

const w = (title: string) => classifyWeight({ title });

describe('classifyWeight, W2.1b civic-filler classifier', () => {
  it('downweights the canonical civic-meeting titles to −3', () => {
    for (const title of [
      'Street Tree Advisory Committee',
      'Planning Commission Regular Meeting',
      'Historic Landmarks Advisory Board',
      'City Council Meeting',
      'Board Meeting, Parks & Rec',
      'Public Hearing on the Housing Element',
      'Agenda Review Session',
      'Homelessness Task Force',
      'Budget Study Session',
      'Ordinance Subcommittee',
    ]) {
      expect(w(title)).toBe(-3);
    }
  });

  it('is case-insensitive and boundary-aware', () => {
    expect(w('DOWNTOWN parking COMMITTEE')).toBe(-3);
    expect(w('subcommittee on transit')).toBe(-3);
  });

  it('leaves genuine leisure events at 0', () => {
    for (const title of [
      'Friday Night Live Music at SOhO',
      'Farmers Market, Saturday',
      'First Thursday Art Walk',
      'Summer Solstice Parade',
      'Wine & Cheese Tasting',
      'Santa Barbara Bowl: The National',
    ]) {
      expect(w(title)).toBe(0);
    }
  });

  it('does not fire on partial-word or unrelated substrings', () => {
    // "commit" / "commissioned" must NOT trip the committee/commission patterns.
    expect(w('Open Mic: Commit to the Bit Comedy Night')).toBe(0);
    expect(w('Newly Commissioned Mural Unveiling')).toBe(0);
    // A bare "council" (e.g. Arts Council) is deliberately NOT civic, only "city council".
    expect(w('Santa Barbara Arts Council Gala')).toBe(0);
    // A bare "board" (surfboard/boardwalk) must not trip "board meeting"/"advisory board".
    expect(w('Board Shaping Workshop')).toBe(0);
  });

  it('accepts the documented false positive (promotional "…Committee Presents")', () => {
    // Deliberate trade-off (§W2.1b): a founder ▲ fixes this in two seconds.
    expect(w('Concert Series Committee Presents: Jazz on the Green')).toBe(-3);
  });
});
