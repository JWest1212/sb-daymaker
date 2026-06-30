import { describe, it, expect } from 'vitest';
import { extractEvents } from './jsonLd';

const wrap = (obj: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe('extractEvents', () => {
  it('extracts a plain Event', () => {
    const html = wrap({
      '@type': 'Event',
      name: 'Jazz Night',
      startDate: '2026-07-12T20:00:00-07:00',
      endDate: '2026-07-12T23:00:00-07:00',
      location: { '@type': 'Place', name: 'SOhO', address: '1221 State St, Santa Barbara, CA' },
      offers: { '@type': 'Offer', price: '25', priceCurrency: 'USD' },
      url: 'https://example.com/jazz',
    });
    const [ev] = extractEvents(html);
    expect(ev.name).toBe('Jazz Night');
    expect(ev.startDate).toBe('2026-07-12T20:00:00-07:00');
    expect(ev.locationName).toBe('SOhO');
    expect(ev.address).toBe('1221 State St, Santa Barbara, CA');
    expect(ev.offersLow).toBe(25);
    expect(ev.url).toBe('https://example.com/jazz');
  });

  it('extracts a MusicEvent', () => {
    const html = wrap({ '@type': 'MusicEvent', name: 'Rock Show', startDate: '2026-08-01T21:00:00-07:00' });
    const [ev] = extractEvents(html);
    expect(ev.name).toBe('Rock Show');
  });

  it('marks isFree when price is 0', () => {
    const html = wrap({
      '@type': 'Event', name: 'Free Concert', startDate: '2026-07-04T18:00:00-07:00',
      offers: [{ price: '0', priceCurrency: 'USD' }],
    });
    const [ev] = extractEvents(html);
    expect(ev.isFree).toBe(true);
    expect(ev.offersLow).toBe(0);
  });

  it('picks the lowest price from multiple offers', () => {
    const html = wrap({
      '@type': 'Event', name: 'Concert', startDate: '2026-07-10T19:00:00-07:00',
      offers: [{ price: '40' }, { price: '25' }, { price: '75' }],
    });
    const [ev] = extractEvents(html);
    expect(ev.offersLow).toBe(25);
  });

  it('handles @graph wrapping', () => {
    const html = wrap({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Event', name: 'Art Walk', startDate: '2026-07-09T18:00:00-07:00' },
        { '@type': 'Organization', name: 'Venue Org' },
      ],
    });
    const evs = extractEvents(html);
    expect(evs).toHaveLength(1);
    expect(evs[0].name).toBe('Art Walk');
  });

  it('skips non-Event types', () => {
    const html = wrap({ '@type': 'Restaurant', name: 'Joe\'s Diner' });
    expect(extractEvents(html)).toHaveLength(0);
  });

  it('extracts multiple script blocks', () => {
    const html = wrap({ '@type': 'Event', name: 'Show A', startDate: '2026-07-01T20:00:00-07:00' }) +
      wrap({ '@type': 'MusicEvent', name: 'Show B', startDate: '2026-07-02T20:00:00-07:00' });
    const evs = extractEvents(html);
    expect(evs).toHaveLength(2);
    expect(evs[0].name).toBe('Show A');
    expect(evs[1].name).toBe('Show B');
  });

  it('handles address as an object', () => {
    const html = wrap({
      '@type': 'Event', name: 'Show', startDate: '2026-07-01T20:00:00-07:00',
      location: {
        '@type': 'Place',
        name: 'Lobero Theatre',
        address: { '@type': 'PostalAddress', streetAddress: '33 E Canon Perdido St', addressLocality: 'Santa Barbara', addressRegion: 'CA', postalCode: '93101' },
      },
    });
    const [ev] = extractEvents(html);
    expect(ev.locationName).toBe('Lobero Theatre');
    expect(ev.address).toContain('33 E Canon Perdido St');
    expect(ev.address).toContain('Santa Barbara');
  });

  it('returns empty array on no JSON-LD', () => {
    expect(extractEvents('<html><body>No script here</body></html>')).toHaveLength(0);
  });

  it('skips malformed JSON silently', () => {
    const html = '<script type="application/ld+json">{broken json}</script>';
    expect(extractEvents(html)).toHaveLength(0);
  });
});
