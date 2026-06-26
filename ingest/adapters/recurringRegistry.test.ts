import { describe, it, expect } from 'vitest';
import { toRecurringSpecs } from './recurringRegistry';

const base = {
  slug: 's', title: 'T', venue: 'V', address: 'A', neighborhood: 'downtown' as const,
  category: 'recurring_market' as const, reasonToGo: 'r', sourceUrl: 'https://x',
};

describe('toRecurringSpecs', () => {
  it('weekly with a known time → frequency + plain day label, not flagged', () => {
    const [s] = toRecurringSpecs({ ...base, frequency: 'weekly', days: [{ dow: 6, start: '08:30', end: '13:00' }] });
    expect(s.frequency).toBe('weekly');
    expect(s.start_time).toBe('08:30');
    expect(s.time_unknown).toBe(false);
    expect(s.label).toBe('Saturday');
  });

  it('day known but time unknown → blank start + "(time TBD)" flag, never a guessed time', () => {
    const [s] = toRecurringSpecs({ ...base, frequency: 'weekly', category: 'recurring_nightlife', days: [{ dow: 5, start: null, end: null }] });
    expect(s.start_time).toBeNull();
    expect(s.time_unknown).toBe(true);
    expect(s.label).toBe('Friday (time TBD)');
  });

  it('monthly / biweekly cadence wording', () => {
    expect(toRecurringSpecs({ ...base, frequency: 'monthly', category: 'recurring_arts', days: [{ dow: 4, start: '17:00', end: '20:00' }] })[0].label)
      .toBe('1st Thursday/month');
    expect(toRecurringSpecs({ ...base, frequency: 'biweekly', category: 'recurring_arts', days: [{ dow: 5, start: '17:00', end: '20:00' }] })[0].label)
      .toBe('Biweekly Friday');
  });
});
