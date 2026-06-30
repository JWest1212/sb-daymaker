"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanAnswers, Block, Stop } from "./types";

export interface SavedItinerary {
  id: string;
  title: string;
  answers: PlanAnswers;
  stops: Stop[];    // snapshot at save time — restored on reopen; insertion order preserved
  savedAt: string;  // ISO timestamp
}

const STORAGE_KEY = "sbd.itineraries.v1";

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export type ItineraryInput = Omit<SavedItinerary, "id" | "savedAt">;

export interface UseItinerariesReturn {
  itineraries: SavedItinerary[];
  hydrated: boolean;
  save: (data: ItineraryInput) => string;
  update: (id: string, title: string) => void;
  remove: (id: string) => void;
  get: (id: string) => SavedItinerary | undefined;
}

export function useItineraries(): UseItinerariesReturn {
  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItineraries(JSON.parse(raw) as SavedItinerary[]);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itineraries));
    } catch {
      /* ignore quota errors */
    }
  }, [itineraries, hydrated]);

  const save = useCallback((data: ItineraryInput): string => {
    const id = genId();
    const entry: SavedItinerary = { ...data, id, savedAt: new Date().toISOString() };
    setItineraries((prev) => [entry, ...prev]);
    return id;
  }, []);

  const update = useCallback((id: string, title: string) => {
    setItineraries((prev) =>
      prev.map((it) => (it.id === id ? { ...it, title } : it)),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItineraries((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const get = useCallback(
    (id: string) => itineraries.find((it) => it.id === id),
    [itineraries],
  );

  return useMemo(
    () => ({ itineraries, hydrated, save, update, remove, get }),
    [itineraries, hydrated, save, update, remove, get],
  );
}

/** Block → CSS token for mini spine dots in My Plans drawer. */
export const BLOCK_DOT_COLOR: Record<Block, string> = {
  morning:   "var(--tod-morning)",
  afternoon: "var(--tod-afternoon)",
  night:     "var(--tod-night)",
};
