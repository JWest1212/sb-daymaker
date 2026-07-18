import type { Metadata } from "next";
import { loadFlags } from "@/lib/flagsServer";
import { FlagsView } from "./FlagsView";

export const metadata: Metadata = { title: "Flags · SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const flags = await loadFlags();
  return <FlagsView initialFlags={flags} />;
}
