"use client";

import { SBIcon } from "@/components/ui/SBIcon";

/** Header magnifier, top-right, across from the wordmark (Home Rework spec §9.1). */
export function SearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="sbd-search-btn" aria-label="Search" onClick={onOpen}>
      <SBIcon name="search" size={18} strokeWidth={2.2} />
    </button>
  );
}
