"use client";

/**
 * R1 Wave 1 (W1.5). One share behavior for every surface that hands out a link.
 *
 * The rule: a visitor who taps Share always ends up with something they can act
 * on. The native sheet is still tried first, because on a phone it is the best
 * outcome. On any other result (no `navigator.share`, the sheet was dismissed,
 * the clipboard was blocked, anything thrown) the link is put on screen with a
 * Copy control instead of the visitor being returned to the list with nothing.
 *
 * Before this, three of the five share surfaces called `shareUrl` fire-and-forget
 * and rendered no feedback whatsoever (SHR-001). The link had already been
 * created server-side; it was simply never shown.
 *
 * Usage:
 *   const { share, sheet } = useShareLink();
 *   ... onClick={() => share(url, title)}
 *   ... {sheet}
 */

import { useCallback, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { shareUrl, type ShareResult } from "./share";

export function useShareLink() {
  const [pending, setPending] = useState<{ url: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const share = useCallback(async (url: string, title: string): Promise<ShareResult> => {
    const result = await shareUrl(url, title);
    if (result !== "shared") {
      // "copied" still opens the sheet: the clipboard is invisible, and a
      // confirmation the visitor can read (and a link they can re-copy) is the
      // point. The sheet says which of the two happened.
      setCopied(result === "copied");
      setPending({ url, title });
    }
    return result;
  }, []);

  const close = useCallback(() => {
    setPending(null);
    setCopied(false);
  }, []);

  const copyNow = useCallback(async () => {
    if (!pending) return;
    try {
      await navigator.clipboard.writeText(pending.url);
      setCopied(true);
    } catch {
      // Clipboard blocked. The URL is already on screen and selectable, which is
      // the fallback that always works.
      setCopied(false);
    }
  }, [pending]);

  const sheet = (
    <BottomSheet
      open={pending !== null}
      onClose={close}
      kicker="Share"
      title={copied ? "Link copied" : "Here is your link"}
    >
      <p className="sbd-sharelink__note">
        {copied
          ? "It is on your clipboard. Paste it anywhere."
          : "Copy this link and send it however you like."}
      </p>
      <code className="sbd-sharelink__url">{pending?.url}</code>
      <div className="sbd-sharelink__actions">
        <button type="button" className="sbd-sharelink__copy" onClick={copyNow}>
          {copied ? "Copy again" : "Copy link"}
        </button>
        <button type="button" className="sbd-sharelink__done" onClick={close}>
          Done
        </button>
      </div>
      <p className="sbd-sharelink__live" aria-live="polite">
        {copied ? "Copied" : ""}
      </p>
    </BottomSheet>
  );

  return { share, sheet };
}
