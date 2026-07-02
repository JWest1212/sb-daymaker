import type { Metadata } from "next";
import { loadCatalog } from "@/lib/catalogServer";
import { CatalogView } from "./CatalogView";

export const metadata: Metadata = { title: "Live catalog — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const initial = await loadCatalog({ page: 1 });
  return <CatalogView initial={initial} />;
}
