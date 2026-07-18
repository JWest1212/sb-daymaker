"use client";

import { usePhotoFallback } from "@/components/ui/Card";

/** Card Imagery Build Spec Phase 2 §5.5 "fallback resilience", the thing detail
 *  page renders its own photo block (not ListCard/PickCard), so it needs the same
 *  broken-image → gradient fallback as the card rail and hero. Small client island
 *  (matches BackButton/DetailSaveButton's pattern) inside the otherwise
 *  server-rendered detail page. Found missing 2026-07-10 by actually poisoning a
 *  real photo URL in dev and seeing the browser's native broken-image glyph. */
export function DetailPhoto({
  photoUrl,
  tone,
  children,
}: {
  photoUrl: string | null;
  tone: string;
  /** Optional overlay anchored inside the media (e.g. the G1.6 Verified stamp,
   *  top-right). Sits inside the overflow-hidden media so it clips to the image. */
  children?: React.ReactNode;
}) {
  const [broken, markBroken] = usePhotoFallback(photoUrl ?? undefined);
  return (
    <div className={`sbd-detail__media sbd-media--${tone}`}>
      {photoUrl && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sbd-card__img" src={photoUrl} alt="" onError={markBroken} />
      ) : null}
      {children}
    </div>
  );
}
