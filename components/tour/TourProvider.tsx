"use client";

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSaves } from "@/components/saves/SavesProvider";
import { WelcomeTour } from "./WelcomeTour";

export type TourCtxValue = { openTour: () => void };
export const TourContext = createContext<TourCtxValue>({ openTour: () => {} });

const TOUR_KEY = "sbd.tour.v1";
const ITIN_KEY = "sbd.itineraries.v1";

/**
 * First-visit welcome carousel. Auto-opens once (gated on saves hydrating,
 * `sbd.tour.v1` unset, and no existing saves/itineraries so current users at
 * launch aren't surprised by it) and exposes `openTour()` for the two replay
 * links. See docs/intro-tutorial/01_welcome_tour_build_spec.md §5.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { hydrated, counts } = useSaves();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hydrated) return;
    let seen = false;
    let hasItin = false;
    try {
      seen = !!localStorage.getItem(TOUR_KEY);
      hasItin = !!localStorage.getItem(ITIN_KEY);
    } catch {
      return; // storage blocked → never auto-open
    }
    if (!seen && counts.total === 0 && !hasItin) {
      setStep(0);
      setOpen(true);
      // Written on auto-open (not on close) so a mid-tour reload won't re-trigger it.
      try {
        localStorage.setItem(TOUR_KEY, "seen");
      } catch {
        /* ignore quota/blocked errors */
      }
    }
  }, [hydrated, counts.total]);

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
    <TourContext.Provider value={{ openTour }}>
      {children}
      <WelcomeTour open={open} step={step} setStep={setStep} onDismiss={dismiss} onCta={onCta} />
    </TourContext.Provider>
  );
}
