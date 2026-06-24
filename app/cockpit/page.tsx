import type { Metadata } from "next";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { EmptyState } from "@/components/ui";
import { ReviewCard, type ReviewItem } from "./ReviewCard";
import { runPipeline, signOut } from "./actions";

export const metadata: Metadata = {
  title: "Cockpit — review",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CockpitPage() {
  const sb = getAdminSupabase();

  let items: ReviewItem[] = [];
  if (sb) {
    const { data } = await sb
      .from("things")
      .select(
        `id, title, type, blurb, reason_to_go, local_note, happening_category,
         happening_tier, neighborhood, address, starts_at, price_band, free,
         is_21_plus, thing_tags ( tag )`,
      )
      .eq("status", "needs_review")
      .order("updated_at", { ascending: false });
    items = (data ?? []) as ReviewItem[];
  }

  return (
    <main className="sbd-public">
      <div className="sbd-public__inner" style={{ maxWidth: 640 }}>
        <div className="sbd-cockpit__bar">
          <div>
            <p className="sbd-public__eyebrow">SB Daymaker · cockpit</p>
            <h1 className="sbd-public__title" style={{ marginBottom: 0 }}>
              Review queue
            </h1>
          </div>
          <form action={signOut}>
            <button type="submit" className="sbd-btn sbd-btn--secondary">
              Sign out
            </button>
          </form>
        </div>

        {!sb ? (
          <EmptyState
            icon="🔌"
            title="Not configured"
            message="Add SUPABASE_SECRET_KEY (and ANTHROPIC_API_KEY) to .env.local, then reload."
          />
        ) : (
          <>
            <form action={runPipeline} style={{ margin: "var(--space-4) 0" }}>
              <button type="submit" className="sbd-btn sbd-btn--primary sbd-btn--block">
                ✨ Run nightly pipeline now
              </button>
            </form>

            {items.length === 0 ? (
              <EmptyState
                icon="✅"
                title="Nothing to review"
                message="Run the pipeline to enrich draft items, then approve or reject them here."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                {items.map((it) => (
                  <ReviewCard key={it.id} item={it} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
