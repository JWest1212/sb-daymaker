import { describe, it, expect } from 'vitest';
import { blurbProblems, isBlurbPublishable, isBlurbDefective, needsReEnrich, blurbRejectReason, sbWeekdayName, MIN_BLURB_LENGTH } from './blurbRules';

const TUE = '2026-09-29T02:00:00Z'; // Monday 7pm SB... see the weekday test
const TUE_EVENING = '2026-09-30T02:00:00Z'; // Tuesday 7pm SB

describe('sbWeekdayName (R1 W5.3)', () => {
  it('reads the weekday in Santa Barbara time, not UTC', () => {
    // 02:00Z on the 30th is 7pm on the 29th in Santa Barbara.
    expect(sbWeekdayName(TUE_EVENING)).toBe('tuesday');
    expect(sbWeekdayName(TUE)).toBe('monday');
  });
});

describe('blurbProblems (R1 W5.3)', () => {
  const ok = 'Country rock from the Bowl stage, with the hills going pink behind the band.';

  it('passes a blurb that says what it is', () => {
    expect(blurbProblems({ blurb: ok, title: 'Beck: Ride Lonesome Tour' })).toEqual([]);
    expect(isBlurbPublishable({ blurb: ok, title: 'Beck' })).toBe(true);
  });

  it('catches a missing blurb', () => {
    expect(blurbProblems({ blurb: null, title: 'x' })).toEqual(['missing']);
    expect(blurbProblems({ blurb: '   ', title: 'x' })).toEqual(['missing']);
  });

  it('catches a blurb that is too short to say anything', () => {
    expect(blurbProblems({ blurb: 'Big Richard.', title: 'Big Richard' })).toContain('too_short');
    expect('Big Richard.'.length).toBeLessThan(MIN_BLURB_LENGTH);
  });

  it('catches a blurb that just repeats the title', () => {
    // The audit's shape: "Silverada with Emily Nenni." under the same title.
    expect(blurbProblems({ blurb: 'Silverada with Emily Nenni', title: 'Silverada with Emily Nenni' }))
      .toContain('repeats_title');
  });

  it('catches the wrong weekday, the error a visitor would act on', () => {
    // Live example: a blurb saying Thursday for a Tuesday show.
    const p = blurbProblems({
      blurb: 'Thursday night at the Bowl, country rock with the hills going pink behind the band.',
      title: 'Beck: Ride Lonesome Tour',
      starts_at: TUE_EVENING,
    });
    expect(p).toContain('wrong_weekday');
  });

  it('accepts a blurb naming the RIGHT weekday', () => {
    expect(blurbProblems({
      blurb: 'Tuesday night at the Bowl, country rock with the hills going pink behind the band.',
      title: 'Beck',
      starts_at: TUE_EVENING,
    })).toEqual([]);
  });

  it('ignores weekdays when the row has no start', () => {
    expect(blurbProblems({ blurb: 'Open every Sunday for pastries and strong coffee all morning.', title: 'Bakery' }))
      .toEqual([]);
  });

  it('catches the banned phrases', () => {
    for (const p of ['Nestled in the Funk Zone, a wine bar with a patio and good light.',
                     'A vibrant celebration of local food, music and craft in one place.',
                     'A hidden gem of a taproom just off the main road near the tracks.',
                     "Whether you're new in town or a local, there is a table for you."]) {
      expect(blurbProblems({ blurb: p, title: 'x' }), p).toContain('banned_phrase');
    }
  });

  it('catches a street address that belongs in the address field', () => {
    expect(blurbProblems({ blurb: 'Live music every Friday at 1112 State Street, doors at seven.', title: 'x' }))
      .toContain('contains_address');
  });

  it('reports every problem, not just the first', () => {
    const p = blurbProblems({ blurb: 'Nestled.', title: 'Nestled' });
    expect(p).toContain('too_short');
    expect(p).toContain('repeats_title');
    expect(p).toContain('banned_phrase');
  });
});

describe('blurbRejectReason', () => {
  it('is null for a good blurb', () => {
    expect(blurbRejectReason({ blurb: 'A weekly bookmobile stop with picture books and a story hour.', title: 'x' }))
      .toBeNull();
  });

  it('says what is wrong, in words a person can act on', () => {
    expect(blurbRejectReason({ blurb: 'x', title: 'x' })).toContain('under 40 characters');
  });
});

describe('defects vs improvement signals (R1 W5.3)', () => {
  it('treats a short but good blurb as publishable-enough, not defective', () => {
    // "Golden-hour guitars by the water." is 33 characters and better writing
    // than most long blurbs. Rejecting it would be the rule overriding the voice.
    const short = { blurb: 'Golden-hour guitars by the water.', title: 'Sunset Sessions' };
    expect(isBlurbDefective(short)).toBe(false);
    expect(needsReEnrich(short)).toBe(true); // worth another pass, not a blocker
  });

  it('treats the real errors as defects', () => {
    expect(isBlurbDefective({ blurb: 'Big Richard.', title: 'Big Richard' })).toBe(true);
    expect(isBlurbDefective({
      blurb: 'Thursday night at the Bowl, country rock with the hills going pink behind.',
      title: 'Beck', starts_at: '2026-09-30T02:00:00Z',
    })).toBe(true);
    expect(isBlurbDefective({ blurb: 'A hidden gem of a taproom just off the road near the tracks.', title: 'x' })).toBe(true);
  });

  it('flags a missing blurb for re-enrichment', () => {
    expect(needsReEnrich({ blurb: null, title: 'x' })).toBe(true);
  });

  it('leaves a good, full blurb alone on both counts', () => {
    const good = { blurb: 'A weekly bookmobile stop with picture books and a story hour on the lawn.', title: 'Library on the Go' };
    expect(isBlurbDefective(good)).toBe(false);
    expect(needsReEnrich(good)).toBe(false);
  });
});
