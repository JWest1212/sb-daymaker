"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
  ids: string[];
  counts: { want: number; been: number; total: number };
}

const SavesContext = createContext<SavesContextValue | null>(null);

export function SavesProvider({ children }: { children: ReactNode }) {
  // Server + first client render share {} → no hydration mismatch.
  const [saves, setSaves] = useState<SavesMap>({});
  const [hydrated, setHydrated] = useState(false);

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
    setSaves((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = "want";
      return next;
    });
  }, []);

  const setState = useCallback((id: string, s: SaveState) => {
    setSaves((prev) => ({ ...prev, [id]: s }));
  }, []);

  const remove = useCallback((id: string) => {
    setSaves((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const saveMany = useCallback((newIds: string[]) => {
    setSaves((prev) => {
      const next = { ...prev };
      for (const id of newIds) if (!next[id]) next[id] = "want";
      return next;
    });
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
