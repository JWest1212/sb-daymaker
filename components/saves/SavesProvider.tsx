"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { trackEvent } from "@/lib/analytics";

export type SaveState = "want" | "been";
type SavesMap = Record<string, SaveState>;

const STORAGE_KEY = "sbd.saves.v1";

interface SavesContextValue {
  hydrated: boolean;
  state: (id: string) => SaveState | undefined;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void; // none → want → none
  setState: (id: string, s: SaveState) => void;
  remove: (id: string) => void;
  saveMany: (ids: string[]) => void; // add as "want" (skip already-saved)
  merge: (incoming: Record<string, SaveState>) => void; // restore (incoming wins)
  asMap: () => Record<string, SaveState>;
  saves: SavesMap; // the raw value-bearing map, referentially fresh on every change (safe in deps)
  ids: string[];
  counts: { want: number; been: number; total: number };
}

const SavesContext = createContext<SavesContextValue | null>(null);

export function SavesProvider({ children }: { children: ReactNode }) {
  // Server + first client render share {} → no hydration mismatch.
  const [saves, setSaves] = useState<SavesMap>({});
  const [hydrated, setHydrated] = useState(false);

  // Mirror of `saves` for read-before-write analytics decisions, so the track()
  // call can live OUTSIDE the state updater (updaters must stay pure; StrictMode
  // double-invokes them in dev, which would double-fire an event).
  const savesRef = useRef<SavesMap>(saves);
  useEffect(() => {
    savesRef.current = saves;
  }, [saves]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaves(JSON.parse(raw) as SavesMap);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    } catch {
      /* ignore quota errors */
    }
  }, [saves, hydrated]);

  const toggle = useCallback((id: string) => {
    const wasSaved = Boolean(savesRef.current[id]);
    setSaves((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = "want";
      return next;
    });
    // Event 1: fire only on a fresh save (entering "want"), never on un-save.
    if (!wasSaved) trackEvent("save_add", { thingId: id });
  }, []);

  const setState = useCallback((id: string, s: SaveState) => {
    const prevState = savesRef.current[id];
    setSaves((prev) => ({ ...prev, [id]: s }));
    // Event 2: fire on any flip INTO "been".
    if (s === "been" && prevState !== "been") trackEvent("save_been", { thingId: id });
  }, []);

  const remove = useCallback((id: string) => {
    setSaves((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const saveMany = useCallback((newIds: string[]) => {
    const before = savesRef.current;
    const added = newIds.filter((id) => !before[id]).length;
    setSaves((prev) => {
      const next = { ...prev };
      for (const id of newIds) if (!next[id]) next[id] = "want";
      return next;
    });
    // Event 1 (batch): one call with the count of newly-added saves.
    if (added > 0) trackEvent("save_add", { count: added });
  }, []);

  const merge = useCallback((incoming: Record<string, SaveState>) => {
    setSaves((prev) => ({ ...prev, ...incoming }));
  }, []);

  const value = useMemo<SavesContextValue>(() => {
    const ids = Object.keys(saves);
    const want = ids.filter((id) => saves[id] === "want").length;
    const been = ids.filter((id) => saves[id] === "been").length;
    return {
      hydrated,
      state: (id) => saves[id],
      isSaved: (id) => Boolean(saves[id]),
      toggle,
      setState,
      remove,
      saveMany,
      merge,
      asMap: () => ({ ...saves }),
      saves,
      ids,
      counts: { want, been, total: ids.length },
    };
  }, [saves, hydrated, toggle, setState, remove, saveMany, merge]);

  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>;
}

export function useSaves(): SavesContextValue {
  const ctx = useContext(SavesContext);
  if (!ctx) throw new Error("useSaves must be used within <SavesProvider>");
  return ctx;
}
