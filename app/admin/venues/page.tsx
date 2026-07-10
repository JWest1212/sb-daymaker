import type { Metadata } from "next";
import { loadVenuesData } from "@/lib/venuesServer";
import { VenuesView } from "./VenuesView";

export const metadata: Metadata = { title: "Venues — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VenuesPage() {
  const initial = await loadVenuesData();
  return <VenuesView initial={initial} />;
}
