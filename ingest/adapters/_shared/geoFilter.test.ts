import { describe, it, expect } from 'vitest';
import { isInScope } from './geoFilter';

describe('isInScope', () => {
  it('passes a Santa Barbara address', () => {
    expect(isInScope({ address: '1214 State St, Santa Barbara, CA' })).toBe(true);
  });
  it('passes a Goleta address', () => {
    expect(isInScope({ address: '5679 Hollister Ave, Goleta, CA 93117' })).toBe(true);
  });
  it('passes a Montecito address', () => {
    expect(isInScope({ venueName: 'San Ysidro Ranch, Montecito' })).toBe(true);
  });
  it('passes Carpinteria by city name', () => {
    expect(isInScope({ address: '5000 Carpinteria Ave, Carpinteria, CA' })).toBe(true);
  });
  it('passes by ZIP code', () => {
    expect(isInScope({ address: '100 Main St 93101' })).toBe(true);
  });
  it('passes Isla Vista by city name', () => {
    expect(isInScope({ address: '6598 El Colegio Rd, Isla Vista, CA' })).toBe(true);
  });
  it('passes by bounding box lat/lng when no text', () => {
    expect(isInScope({ lat: 34.42, lng: -119.69 })).toBe(true);
  });
  it('fails an online/virtual event', () => {
    expect(isInScope({ title: 'Online Yoga Class', address: 'Santa Barbara, CA' })).toBe(false);
  });
  it('fails a Zoom event even with SB address', () => {
    expect(isInScope({ title: 'Zoom Meeting', address: 'Santa Barbara, CA' })).toBe(false);
  });
  it('fails an Ojai event', () => {
    expect(isInScope({ address: '100 Main St, Ojai, CA' })).toBe(false);
  });
  it('fails a Ventura event', () => {
    expect(isInScope({ address: '200 Ventura Blvd, Ventura, CA' })).toBe(false);
  });
  it('fails a Solvang event', () => {
    expect(isInScope({ address: '1 Mission Dr, Solvang, CA' })).toBe(false);
  });
  it('fails when lat/lng is out of bbox', () => {
    expect(isInScope({ lat: 34.20, lng: -119.18 })).toBe(false);
  });
  it('fails when no location info at all', () => {
    expect(isInScope({})).toBe(false);
  });
  it('fails a Lompoc event', () => {
    expect(isInScope({ address: '100 H St, Lompoc, CA' })).toBe(false);
  });
});
