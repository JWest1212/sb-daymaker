import { track } from "@vercel/analytics";

/**
 * The seven — and only seven — Wave-1 custom analytics events.
 *
 * Props policy (W1.2 / CLAUDE.md PII boundary): thing ids (uuids), occasion-tag
 * keys, small enums, and counts only. **Never** an email, a share/restore token,
 * a URL, or free-text user input. The overloads below enforce that at compile
 * time — every prop is a `string` id/enum or a `number` count.
 *
 * `trackEvent` also swallows any error so a missing/blocked analytics script can
 * never throw into app code (the SDK is already safe; this is belt-and-braces).
 */
export function trackEvent(name: "save_add", props: { thingId: string } | { count: number }): void;
export function trackEvent(name: "save_been", props: { thingId: string }): void;
export function trackEvent(name: "share_create", props: { kind: "list" | "plan" | "single"; count: number }): void;
export function trackEvent(name: "share_open", props: { kind: "list" | "plan"; count: number }): void;
export function trackEvent(name: "lens_select", props: { tag: string }): void;
export function trackEvent(name: "plan_built", props: { stops: number }): void;
export function trackEvent(name: "subscribe_submit", props: { status: "pending" | "already" }): void;
export function trackEvent(name: string, props: Record<string, string | number>): void {
  try {
    track(name, props);
  } catch {
    /* analytics must never throw into app code */
  }
}
