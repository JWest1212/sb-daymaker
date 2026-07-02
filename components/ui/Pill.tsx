import { OCCASION_BY_KEY, type OccasionKey } from "@/lib/occasions";
import { SBIcon } from "./SBIcon";

// ---- Occasion pill --------------------------------------------------------
// Fill = occasion color token; text = occasion text token (always --paper or
// --ink — never accent-on-light). Gold survives only for free_sb (ink text).
// short=true → renders pillLabel (e.g. "Arts" instead of "Arts & Culture")
// for the on-photo pill. All other surfaces use the default full label.
export function Pill({ occasion, short }: { occasion: OccasionKey; short?: boolean }) {
  const occ = OCCASION_BY_KEY[occasion];
  if (!occ) return null;
  return (
    <span
      className="sbd-pill"
      style={{ background: occ.color, color: occ.text }}
    >
      {short ? occ.pillLabel : occ.label}
    </span>
  );
}

// ---- Date eyebrow ---------------------------------------------------------
// Renders a pre-formatted date/time string (from formatWhen() or eventTime())
// in JetBrains Mono. The parent is responsible for building the string.
export function DateEyebrow({
  onImage,
  children,
}: {
  onImage?: boolean;
  children: React.ReactNode;
}) {
  return (
    <time
      className={`sbd-eyebrow-date${onImage ? " sbd-eyebrow-date--on-image" : ""}`}
    >
      {children}
    </time>
  );
}

// ---- Place pill -----------------------------------------------------------
// Dark-scrim location chip with a pin icon. Used on media cards bottom-left.
export function PlacePill({ neighborhood }: { neighborhood: string }) {
  return (
    <span className="sbd-placepill">
      <SBIcon name="pin" size={11} />
      {neighborhood}
    </span>
  );
}
