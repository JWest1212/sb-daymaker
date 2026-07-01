// ingest/adapters/sbcountyArts.ts
//
// SB County Arts Commission (sbac.ca.gov) — §9.2.
//
// DOC MISMATCH (§9.2): Doc expected a WordPress server-rendered events page.
// Reality: the /events-calendar/ page embeds a Tockify calendar widget —
// a client-rendered React SPA loaded via an iframe. Events are stored in
// Tockify's system, not in WordPress. No JSON-LD, no WP CPT, no public API.
//
//   <div data-tockify-component="calendar" data-tockify-calendar="virtualsbac">
//   <script src="https://public.tockify.com/browser/embed.js">
//
// Tockify calendar ID: virtualsbac. No documented public REST/iCal endpoint.
// Resolution: returns [] until Tockify exposes an API or an iCal feed is found.
// (Contact Tockify support re: iCal export for calendar "virtualsbac".)
//
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

export const sbcountyArts: SourceAdapter = {
  key: 'sbcountyArts',
  label: 'SB County Arts Commission',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    // Tockify client-rendered widget — plain fetch yields no event data.
    // Returns [] until a Tockify iCal/API endpoint is available.
    return [];
  },
};
