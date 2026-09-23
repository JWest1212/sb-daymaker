export type ShareResult = "shared" | "copied" | "failed";

/**
 * R1 Wave 1 (W1.5). Share a URL, and never leave the visitor with nothing.
 *
 * The old behavior returned "failed" when the native sheet was dismissed and
 * when the clipboard write threw, and the caller turned both into a toast that
 * flashed past. On a desktop browser with no `navigator.share`, and in any
 * context where the clipboard is blocked (an insecure origin, a permissions
 * policy, Safari outside a user gesture), the visitor tapped Share and got
 * nothing they could act on. The link had been created on the server already.
 *
 * "failed" no longer means "give up". It means "show the link", and every
 * caller now renders a sheet with the URL and a Copy control. The distinction
 * this function still makes is only about what already happened, so the caller
 * knows whether to say "Shared", "Copied", or show the sheet.
 */
export async function shareUrl(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      // A dismissed sheet is not a request to copy silently. Fall through to the
      // visible link sheet, which is the one outcome that is always actionable.
      if ((e as Error).name === "AbortError") return "failed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
