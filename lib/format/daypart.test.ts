import { describe, it, expect } from 'vitest';
import { daypartConflicts, enforceDaypart, hasDaypartConflict, sbHour, trueDaypart } from './daypart';

// All ISO strings carry an explicit SB offset so the assertion is independent of
// the machine timezone (the nightly worker runs on UTC).
const at = (localHHMM: string) => `2026-07-09T${localHHMM}:00-07:00`; // PDT

describe('sbHour / trueDaypart, SB-local boundaries', () => {
  it('reads the SB-local hour regardless of runtime tz', () => {
    expect(sbHour(at('10:00'))).toBe(10);
    expect(sbHour('2026-07-09T05:00:00+00:00')).toBe(22); // 05:00 UTC = 22:00 prev day PDT
  });
  it('buckets at the spec boundaries (<12 / 12–16:59 / 17–20:59 / ≥21)', () => {
    expect(trueDaypart(at('00:00'))).toBe('morning'); // spec is literal: hour <12 is morning
    expect(trueDaypart(at('08:00'))).toBe('morning');
    expect(trueDaypart(at('11:59'))).toBe('morning');
    expect(trueDaypart(at('12:00'))).toBe('afternoon');
    expect(trueDaypart(at('16:59'))).toBe('afternoon');
    expect(trueDaypart(at('17:00'))).toBe('evening');
    expect(trueDaypart(at('20:59'))).toBe('evening');
    expect(trueDaypart(at('21:00'))).toBe('late');
  });
});

describe('daypartConflicts', () => {
  it('flags "evening" copy on a 10am event', () => {
    const c = daypartConflicts('A free evening talk in the garden.', at('10:00'));
    expect(c.map((x) => x.word)).toEqual(['evening']);
  });
  it('flags "late-night" on a 4pm event but attributes it to late-night, not bare night', () => {
    const c = daypartConflicts('A late-night set.', at('16:00'));
    expect(c.map((x) => x.word)).toEqual(['late-night']);
  });
  it('does not flag a matching word', () => {
    expect(daypartConflicts('An evening show.', at('19:00'))).toEqual([]);
    expect(daypartConflicts('Morning yoga on the bluffs.', at('08:00'))).toEqual([]);
  });
  it('treats "night" as consistent with evening OR late', () => {
    expect(hasDaypartConflict('A night out.', at('19:00'))).toBe(false);
    expect(hasDaypartConflict('A night out.', at('22:00'))).toBe(false);
    expect(hasDaypartConflict('A night out.', at('10:00'))).toBe(true);
  });
  it('flags sunset / golden hour outside evening', () => {
    expect(hasDaypartConflict('Golden hour on the water.', at('10:00'))).toBe(true);
    expect(hasDaypartConflict('Sunset picnic.', at('19:30'))).toBe(false);
  });
  it('does not flag topic phrases: "night sky" (astronomy), "night market", "date night"', () => {
    expect(hasDaypartConflict('Learn the night sky with locals.', at('14:00'))).toBe(false);
    expect(hasDaypartConflict('Night skies over the Riviera.', at('14:00'))).toBe(false);
    expect(hasDaypartConflict('The night market on State.', at('14:00'))).toBe(false);
    expect(hasDaypartConflict('Great for date night.', at('14:00'))).toBe(false);
    // but a bare "night" claim on an afternoon event still flags
    expect(hasDaypartConflict('A night of jazz.', at('14:00'))).toBe(true);
  });
});

describe('enforceDaypart, drops only the offending sentence', () => {
  it('removes an evening sentence from a 10am event, keeps the rest', () => {
    const out = enforceDaypart('A free evening talk. Bring water and a hat.', at('10:00'));
    expect(out).toBe('Bring water and a hat.');
    expect(out).not.toMatch(/evening|night|late/i);
  });
  it('leaves a fully consistent blurb untouched', () => {
    const text = 'An evening of chamber music downtown.';
    expect(enforceDaypart(text, at('19:00'))).toBe(text);
  });
  it('is null/empty safe', () => {
    expect(enforceDaypart(null, at('10:00'))).toBeNull();
    expect(enforceDaypart('', at('10:00'))).toBe('');
  });
});
