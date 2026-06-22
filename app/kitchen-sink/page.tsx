import type { Metadata } from "next";
import { KitchenSink } from "./KitchenSink";

// Hidden preview page: not linked anywhere, and kept out of search results.
export const metadata: Metadata = {
  title: "Kitchen Sink — SB Daymaker components",
  robots: { index: false, follow: false },
};

export default function KitchenSinkPage() {
  return <KitchenSink />;
}
