"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFocusTrap } from "@/lib/useFocusTrap";
import type { SearchHit, SearchResults } from "@/lib/search";

const EMPTY: SearchResults = {
  events: [], eventsOverflow: 0,
  venues: [], venuesOverflow: 0,
  tags: [], tagsOverflow: 0,
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  event: "Event",
  venue: "Venue",
  tag: "Tag",
};

/** Header search overlay (Home Rework spec §9). Deterministic string matching only —
 *  no AI. Always mounted (visibility toggled via `.is-open`) so the slide-down
 *  transition can run; useFocusTrap's `active` flag handles enabling/disabling the
 *  trap without needing to unmount. */
export function SearchPanel({
  open,
  onClose,
  onTagSelect,
}: {
  open: boolean;
  onClose: () => void;
  onTagSelect: (filter: NonNullable<SearchHit["filter"]>) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useFocusTrap(panelRef, open);

  const reset = () => {
    setQuery("");
    setResults(EMPTY);
  };

  const close = () => {
    reset();
    onClose();
  };

  // Debounced deterministic search — no Claude call, ever (constraint C3).
  useEffect(() => {
    if (!open || !query.trim()) {
      setResults(EMPTY);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((data: SearchResults) => setResults(data))
        .catch(() => {});
    }, 180);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, open]);

  // Escape closes; scrolling the feed closes (spec §9.1 dismiss list). The scroll
  // listener arms after a short delay — autofocusing the field can itself trigger a
  // scroll-into-view on mobile, which would otherwise close the panel the instant
  // it opens (the mockup's own JS has the same beat: focus only after ~260ms).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();
    document.addEventListener("keydown", onKey);
    const armTimer = setTimeout(() => {
      window.addEventListener("scroll", onScroll, { passive: true });
    }, 350);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(armTimer);
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const total = results.events.length + results.venues.length + results.tags.length;
  const trimmed = query.trim();

  const rows: Array<{ hit: SearchHit; overflow: number }> = [
    ...results.events.map((hit) => ({ hit, overflow: 0 })),
    ...(results.eventsOverflow > 0 ? [{ hit: null as unknown as SearchHit, overflow: results.eventsOverflow }] : []),
    ...results.venues.map((hit) => ({ hit, overflow: 0 })),
    ...(results.venuesOverflow > 0 ? [{ hit: null as unknown as SearchHit, overflow: results.venuesOverflow }] : []),
    ...results.tags.map((hit) => ({ hit, overflow: 0 })),
    ...(results.tagsOverflow > 0 ? [{ hit: null as unknown as SearchHit, overflow: results.tagsOverflow }] : []),
  ];

  return (
    <>
      <div
        className={`sbd-scrim sbd-search-scrim${open ? " is-open" : ""}`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        className={`sbd-search-panel${open ? " is-open" : ""}`}
        ref={panelRef}
        role="search"
        aria-label="Search events, venues, and tags"
      >
        <div className="sbd-search-panel__bar">
          <div className="sbd-search-panel__field">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search events, venues, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search events, venues, tags"
            />
          </div>
          <button type="button" className="sbd-search-panel__cancel" onClick={close}>
            Cancel
          </button>
        </div>

        <div className="sbd-search-panel__meta" aria-live="polite">
          {trimmed
            ? total > 0
              ? `${total} match${total === 1 ? "" : "es"} for "${trimmed}"`
              : `No matches for "${trimmed}".`
            : null}
        </div>

        {total > 0 ? (
          <ul className="sbd-search-panel__results">
            {rows.map((r, i) =>
              r.hit ? (
                <li key={`${r.hit.kind}-${r.hit.id}`}>
                  {r.hit.href ? (
                    <Link href={r.hit.href} className="sbd-search-row" onClick={close}>
                      <SearchRowTag kind={r.hit.kind} />
                      <span className="sbd-search-row__name">{r.hit.label}</span>
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="sbd-search-row"
                      onClick={() => {
                        if (r.hit.filter) onTagSelect(r.hit.filter);
                        close();
                      }}
                    >
                      <SearchRowTag kind={r.hit.kind} />
                      <span className="sbd-search-row__name">{r.hit.label}</span>
                    </button>
                  )}
                </li>
              ) : (
                <li key={`overflow-${i}`} className="sbd-search-row__overflow">
                  +{r.overflow} more
                </li>
              ),
            )}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function SearchRowTag({ kind }: { kind: SearchHit["kind"] }) {
  return <span className={`sbd-search-row__tag sbd-search-row__tag--${kind}`}>{KIND_LABEL[kind]}</span>;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
