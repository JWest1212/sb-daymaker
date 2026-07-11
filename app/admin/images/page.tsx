import type { Metadata } from "next";
import { loadImagesDesk } from "@/lib/imagesServer";
import { ImagesView } from "./ImagesView";

export const metadata: Metadata = { title: "Images — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ImagesPage() {
  const initial = await loadImagesDesk();
  return <ImagesView initial={initial} />;
}
