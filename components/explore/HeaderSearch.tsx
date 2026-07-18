"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchButton } from "./SearchButton";
import { SearchPanel } from "./SearchPanel";
import type { SearchHit } from "@/lib/search";

/** Mounted once in the global BrandHeader (Home Rework spec §9), search is
 *  reachable from every page, not just Explore. A "Tag" hit sets a Vibe/Place
 *  filter: since the header lives outside ExploreClient's subtree, the bridge is
 *  a query param (`?vibe=` / `?place=`) that ExploreClient reads on mount/update
 *  and clears after applying, works whether the tap happens on Explore already
 *  or from another page (Saved, Discover SB, a detail screen). */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  // G0.8: the overlay (and its "Cancel" control) must not leak into the SSR of
  // every page. It is not rendered until the user first opens it (set here in the
  // click handler, not an effect); once mounted it stays, so the slide transition
  // still runs. SSR (everOpened=false) emits no panel and no "Cancel".
  const [everOpened, setEverOpened] = useState(false);
  const router = useRouter();

  const handleTagSelect = (filter: NonNullable<SearchHit["filter"]>) => {
    router.push(`/?${filter.dimension}=${filter.key}`);
  };

  const openPanel = () => {
    setEverOpened(true);
    setOpen(true);
  };

  return (
    <>
      <SearchButton onOpen={openPanel} />
      {everOpened ? (
        <SearchPanel open={open} onClose={() => setOpen(false)} onTagSelect={handleTagSelect} />
      ) : null}
    </>
  );
}
