"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSaves } from "@/components/saves/SavesProvider";
import { WelcomeTour } from "./WelcomeTour";

export type TourCtxValue = {
  openTour: () => void;
  /** R1 W8.3. True on a first visit until the strip is closed. */
  showStrip: boolean;
  dismissStrip: () => void;
};
export const TourContext = createContext<TourCtxValue>({
  openTour: () => {},
  showStrip: false,
  dismissStrip: () => {},
});

const TOUR_KEY = "sbd.tour.v1";
const ITIN_KEY = "sbd.itineraries.v1";

/**
 * The welcome, and the tour behind "How it works".
 *
 * R1 W8.3 (D8, TP-C2-01 to TP-C2-03). The tour no longer opens itself. It used
 * to auto-open as a blocking modal over the page a newcomer came to see, and
 * wrote `sbd.tour.v1` the moment it opened, so a visitor who glanced away or
 * reloaded never saw it again and never chose to dismiss it. Now a first visit
 * gets a dismissible strip above the pick, over real content, and the key is
 * written only when the visitor closes that strip. The three-panel tour stays
 * behind "How it works". Same first-visit gates as before: saves hydrated, the
 * key unset, and no existing saves or plans.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { hydrated, counts } = useSaves();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [showStrip, setShowStrip] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    let seen = false;
    let hasItin = false;
    try {
      seen = !!localStorage.getItem(TOUR_KEY);
      // R1 W8.3. A real count. The plans store writes "[]" to this key on every
      // load, so "the key exists" was true for everyone from visit 2 on, and a
      // visitor who ignored the strip once would never have seen it again.
      const rawItin = localStorage.getItem(ITIN_KEY);
      const parsedItin: unknown = rawItin ? JSON.parse(rawItin) : [];
      hasItin = Array.isArray(parsedItin) && parsedItin.length > 0;
    } catch {
      return; // storage blocked → never auto-open
    }
    // Not written here: the key records a CHOICE, the visitor closing the strip.
    setShowStrip(!seen && counts.total === 0 && !hasItin);
  }, [hydrated, counts.total]);

  const dismissStrip = useCallback(() => {
    setShowStrip(false);
    try {
      localStorage.setItem(TOUR_KEY, "seen");
    } catch {
      /* ignore quota/blocked errors */
    }
  }, []);

  const openTour = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  const dismiss = useCallback(() => setOpen(false), []);

  const onCta = useCallback(() => {
    dismiss();
    if (pathname !== "/") router.push("/");
  }, [dismiss, pathname, router]);

  return (
    <TourContext.Provider value={{ openTour, showStrip, dismissStrip }}>
      {children}
      <WelcomeTour open={open} step={step} setStep={setStep} onDismiss={dismiss} onCta={onCta} />
    </TourContext.Provider>
  );
}
