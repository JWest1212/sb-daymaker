import type { Thing } from "@/lib/things";
import { OCCASION_BY_KEY } from "@/lib/occasions";

const TONES = ["gold", "sage", "pacific"] as const;
export type Tone = (typeof TONES)[number];

export function cardTone(index: number): Tone {
  return TONES[index % TONES.length];
}

export function prettify(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function cardTag(t: Thing): string | undefined {
  const k = t.tags[0];
  return k ? OCCASION_BY_KEY[k]?.label : undefined;
}

export function cardPlace(t: Thing): string | undefined {
  return t.neighborhood ? prettify(t.neighborhood) : undefined;
}

function eventTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

export function cardFacts(t: Thing): string[] {
  const facts: string[] = [];
  if (t.free) facts.push("Free");
  else if (t.price_band) facts.push(t.price_band);
  if (t.type === "event" && t.starts_at) facts.push(eventTime(t.starts_at));
  if (t.is_21_plus) facts.push("21+");
  return facts;
}

export function cardBlurb(t: Thing): string {
  return t.blurb ?? t.reason_to_go ?? "";
}
