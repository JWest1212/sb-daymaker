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
import type { Itinerary } from "@/lib/plan/types";

// One store, two entry points (the Plan "My plans" drawer + Saved › Days). Lives
// in localStorage exactly like saves, no accounts (CLAUDE.md §2.4). Mirrors the
// SavesProvider pattern: empty on the server + first client render (no hydration
// mismatch), then hydrated from storage on mount.

const STORAGE_KEY = "sbd.itineraries.v1";

type NewItinerary = Omit<Itinerary, "id" | "createdAt" | "updatedAt"> &
  Partial<Pick<Itinerary, "id" | "createdAt" | "updatedAt">>;

interface ItinerariesContextValue {
  hydrated: boolean;
  list: Itinerary[];
  get: (id: string) => Itinerary | undefined;
  /** Create (no id) or upsert (with id). Returns the saved itinerary. */
  save: (it: NewItinerary) => Itinerary;
  update: (id: string, patch: Partial<Omit<Itinerary, "id">>) => void;
  remove: (id: string) => void;
  count: number;
}

const ItinerariesContext = createContext<ItinerariesContextValue | null>(null);

// Local id + timestamp helpers. crypto.randomUUID is available in all supported
// browsers; the fallback keeps SSR/old engines from throwing.
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `it_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function ItinerariesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Itinerary[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as Itinerary[]);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, hydrated]);

  const save = useCallback((it: NewItinerary): Itinerary => {
    const now = new Date().toISOString();
    const id = it.id ?? newId();
    let saved!: Itinerary;
    setItems((prev) => {
      const existing = prev.find((p) => p.id === id);
      saved = {
        ...it,
        id,
        createdAt: existing?.createdAt ?? it.createdAt ?? now,
        updatedAt: now,
      };
      return existing
        ? prev.map((p) => (p.id === id ? saved : p))
        : [saved, ...prev];
    });
    return saved;
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<Omit<Itinerary, "id">>) => {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now } : p)),
      );
    },
    [],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo<ItinerariesContextValue>(
    () => ({
      hydrated,
      list: items,
      get: (id) => items.find((p) => p.id === id),
      save,
      update,
      remove,
      count: items.length,
    }),
    [items, hydrated, save, update, remove],
  );

  return (
    <ItinerariesContext.Provider value={value}>
      {children}
    </ItinerariesContext.Provider>
  );
}

export function useItineraries(): ItinerariesContextValue {
  const ctx = useContext(ItinerariesContext);
  if (!ctx) {
    throw new Error("useItineraries must be used within <ItinerariesProvider>");
  }
  return ctx;
}
