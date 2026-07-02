import type { Metadata } from "next";
import { loadHeroPlan } from "@/lib/heroServer";
import { HeroPlanView } from "./HeroPlanView";

export const metadata: Metadata = { title: "Hero plan — SB Daymaker", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HeroesPage() {
  const initial = await loadHeroPlan();
  return <HeroPlanView initial={initial} />;
}
