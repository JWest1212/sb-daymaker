import { describe, it, expect } from 'vitest';
import type { Candidate } from '../packages/shared/types';
import type { VenueDictEntry } from './adapters/_shared/resolveNeighborhood';
import { toThingRow } from './land';

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: 'x',
    type: 'event',
    status: 'needs_review',
    title: 'Test Thing',
    tier: 1,
    happening_category: 'live_music',
    address: '123 State St',
    price_band: '$',
    time_of_day_fit: ['evening'],
    starts_at: '2026-07-20T19:00:00-07:00',
    ends_at: null,
    source_url: 'https://example.com/x',
    last_confirmed: '2026-07-13',
    start_strategy: 'exact',
    ...over,
  } as Candidate;
}

describe('toThingRow — Doc 21 Phase 4 activities self-heal', () => {
  it('fills activities[] from happening_category when the AI proposed none', () => {
    const row = toThingRow(candidate({ happening_category: 'festival_fair' }));
    expect(row.activities).toEqual(['community-festivals']);
  });

  it('unions the deterministic map with AI-proposed activities, deduped', () => {
    const row = toThingRow(
      candidate({ happening_category: 'recurring_nightlife', proposed_activities: ['live-music', 'family-kids'] }),
    );
    expect(row.activities).toEqual(expect.arrayContaining(['live-music', 'nightlife', 'family-kids']));
    expect((row.activities as string[]).length).toBe(3); // 'live-music' not duplicated
  });

  it('falls back to the deterministic map alone when proposed_activities is an empty array', () => {
    const row = toThingRow(candidate({ happening_category: 'live_music', proposed_activities: [] }));
    expect(row.activities).toEqual(['live-music']);
  });
});

const DICTIONARY: VenueDictEntry[] = [
  { name: 'SOhO Restaurant & Music Club', name_norm: 'soho restaurant music club', neighborhood: 'downtown', place_id: 'place-soho', aliases: ['SOhO'] },
];

describe('toThingRow — Doc 19 §6 Phase 5 neighborhood self-heal', () => {
  it('fills neighborhood from a confident dictionary match when the candidate has none', () => {
    const row = toThingRow(candidate({ place_id: 'place-soho', address: undefined }), DICTIONARY);
    expect(row.neighborhood).toBe('downtown');
    expect(row.nearby_zone).toBeTruthy();
  });

  it('a stronger signal overrides a weaker/wrong neighborhood the gate already set', () => {
    const row = toThingRow(candidate({ place_id: 'place-soho', address: undefined, neighborhood: 'goleta' }), DICTIONARY);
    expect(row.neighborhood).toBe('downtown');
  });

  it('does not auto-write on a street-tier (0.6) suggestion — leaves the candidate value as-is', () => {
    // default fixture address "123 State St" is a funk_zone street match (0.6), below the 0.75 floor
    const row = toThingRow(candidate({ address: '123 State St' }), []);
    expect(row.neighborhood).toBeNull();
  });

  it('defaults to an empty dictionary when none is passed (run.ts DRY_RUN preview call site)', () => {
    const row = toThingRow(candidate({ place_id: 'place-soho', address: undefined }));
    expect(row.neighborhood).toBeNull(); // no dictionary available to match place_id against
  });
});
