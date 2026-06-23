"use client";

import { useEffect, useMemo, useState } from "react";
import type { Thing } from "@/lib/things";
import { nearMeSort } from "@/lib/explore";
import { groupSaved } from "@/lib/savedGroups";
import type { Zone } from "@/lib/zones";
import { ZONE_LABEL } from "@/lib/zones";
import { useSaves, type SaveState } from "@/components/saves/SavesProvider";
import { SegmentedControl, EmptyState } from "@/components/ui";
import { NearMeSheet } from "@/components/explore/NearMeSheet";
import { createSharedList } from "@/lib/shares";
import { SavedCard } from "./SavedCard";
import { ShareBar } from "./ShareBar";
import { RestorePanel } from "./RestorePanel";
import { shareUrl } from "./share";

export function SavedClient({ things }: { things: Thing[] }) {
  const { ids, state, setState, remove, counts } = useSaves();

  const [stateFilter, setStateFilter] = useState<SaveState>("want");
  const [zone, setZone] = useState<Zone | null>(null);
  const [nearOpen, setNearOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const savedSet = useMemo(() => new Set(ids), [ids]);

  // Items in the current Want/Been view, near-me sorted.
  const viewItems = useMemo(() => {
    const inView = things.filter(
      (t) => savedSet.has(t.id) && (state(t.id) ?? "want") === stateFilter,
    );
    return nearMeSort(inView, zone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [things, savedSet, stateFilter, zone]);

  const groups = groupSaved(viewItems);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const makeLinkAndShare = async (shareIds: string[]) => {
    if (shareIds.length === 0) return;
    const token = await createSharedList(shareIds);
    if (!token) {
      setToast("Couldn't create a link. Try again.");
      return;
    }
    const url = `${window.location.origin}/s/${token}`;
    const result = await shareUrl(url, "My Santa Barbara picks");
    setToast(
      result === "shared"
        ? "Shared!"
        : result === "copied"
          ? "Link copied to clipboard"
          : `Link ready: ${url}`,
    );
  };

  const shareSelected = async () => {
    await makeLinkAndShare([...selected]);
    setSelectMode(false);
    setSelected(new Set());
  };

  // Whole-list empty (nothing saved at all)
  if (counts.total === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <EmptyState
          icon="❤️"
          title="Your saved list"
          message="Nothing saved yet. Tap the heart on anything you love and it'll live right here — on this device, no account needed."
        />
      </div>
    );
  }

  return (
    <div className="sbd-saved">
      <div className="sbd-saved__controls">
        <SegmentedControl
          ariaLabel="Saved state"
          value={stateFilter}
          onChange={(v) => setStateFilter(v as SaveState)}
          options={[
            { label: `Want to go${counts.want ? ` · ${counts.want}` : ""}`, value: "want" },
            { label: `Been${counts.been ? ` · ${counts.been}` : ""}`, value: "been" },
          ]}
        />
        <div className="sbd-saved__tools">
          <button
            type="button"
            className={`sbd-ctrl__near${zone ? " is-active" : ""}`}
            onClick={() => setNearOpen(true)}
          >
            <span aria-hidden="true">📍</span>
            <span>{zone ? ZONE_LABEL[zone] : "Near Me"}</span>
          </button>
          <button
            type="button"
            className={`sbd-ctrl__near${selectMode ? " is-active" : ""}`}
            onClick={() => {
              setSelectMode((m) => !m);
              setSelected(new Set());
            }}
          >
            <span aria-hidden="true">↗</span>
            <span>{selectMode ? "Done" : "Share"}</span>
          </button>
        </div>
      </div>

      {selectMode ? (
        <p className="sbd-saved__hint">Tap to choose what to send — one or many.</p>
      ) : null}

      {viewItems.length === 0 ? (
        <EmptyState
          icon={stateFilter === "been" ? "✅" : "❤️"}
          message={
            stateFilter === "been"
              ? "Nothing marked as “been” yet. Flip an item to Been once you've done it."
              : "Nothing in your want-to-go list right now."
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.key} className="sbd-saved__group">
            <div className="sbd-group-hdr">
              <span className="sbd-group-dot" style={{ background: g.dot }} />
              {g.label}
            </div>
            <div className="sbd-saved__list">
              {g.items.map((t, i) => (
                <SavedCard
                  key={t.id}
                  thing={t}
                  index={i}
                  state={(state(t.id) ?? "want") as SaveState}
                  selectMode={selectMode}
                  selected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onSetState={(s) => setState(t.id, s)}
                  onRemove={() => remove(t.id)}
                  onShareOne={() => makeLinkAndShare([t.id])}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {!selectMode ? <RestorePanel /> : null}

      <NearMeSheet
        open={nearOpen}
        current={zone}
        onClose={() => setNearOpen(false)}
        onSelect={(z) => {
          setZone(z);
          setNearOpen(false);
        }}
      />

      {selectMode ? (
        <ShareBar
          count={selected.size}
          onShare={shareSelected}
          onCancel={() => {
            setSelectMode(false);
            setSelected(new Set());
          }}
        />
      ) : null}

      {toast ? <div className="sbd-toast">{toast}</div> : null}
    </div>
  );
}
