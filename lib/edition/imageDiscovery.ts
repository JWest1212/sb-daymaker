// lib/edition/imageDiscovery.ts
//
// Cockpit "find more options" (spec §3.5's "lazily for candidates on demand"),
// also reused by draft.ts to guarantee a minimum option count at draft time.
// Tries each of imageQuery.ts's discovery angles in turn, feeding each round's
// growing option list back in as the "existing" set so findMoreOptions's own
// dedup does the merging, reuses ingest/images.ts's findMoreOptions/rankOptions
// verbatim rather than forking the Pexels/Wikimedia calling code.
//
// Deliberately NOT "server-only": draft.ts must run from both Next.js AND the
// ingest/ GitHub Action worker (tsx), same dual-context constraint as
// imageHost.ts, see that file's header for the fuller rationale.

import { findMoreOptions, type ImageOption } from "../../ingest/images";
import { discoveryQueries, type QueryableThing } from "./imageQuery";

export interface DiscoveryThing extends QueryableThing {
  photo_options: ImageOption[];
}

export async function discoverMoreImages(thing: DiscoveryThing): Promise<ImageOption[]> {
  let options = thing.photo_options;
  for (const query of discoveryQueries(thing)) {
    options = await findMoreOptions(query, options);
  }
  return options;
}
