export type ShareResult = "shared" | "copied" | "failed";

/** Share a URL via the native share sheet; fall back to copying to clipboard. */
export async function shareUrl(url: string, title: string): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      // User cancelled the share sheet, don't fall through to a copy.
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
