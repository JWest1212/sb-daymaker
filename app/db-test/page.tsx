import { getSupabase } from "@/lib/supabase";

// Always read live from the database on each request (don't cache at build time).
export const dynamic = "force-dynamic";

type ThingRow = {
  id: string;
  title: string;
  type: string;
  neighborhood: string | null;
  happening_tier: number;
  status: string;
};

const page: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--bg)",
  padding: "var(--space-8)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "var(--space-6)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: "640px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-6)",
};

const h1: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: "var(--weight-bold)",
  fontSize: "var(--text-2xl)",
  color: "var(--accent)",
  margin: 0,
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--text-link)",
  margin: 0,
};

export default async function DbTestPage() {
  const supabase = getSupabase();

  return (
    <main style={page}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <p style={eyebrow}>SB Daymaker · connection test</p>
        <h1 style={h1}>Database test</h1>
      </div>

      {supabase === null ? (
        <StatusCard
          tone="warn"
          title="Not configured yet"
          body="No Supabase keys found. Paste your Project URL + publishable key so Claude can fill .env.local, then reload this page."
        />
      ) : (
        <Results supabase={supabase} />
      )}
    </main>
  );
}

async function Results({
  supabase,
}: {
  supabase: NonNullable<ReturnType<typeof getSupabase>>;
}) {
  const { data, error } = await supabase
    .from("things")
    .select("id,title,type,neighborhood,happening_tier,status")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <StatusCard
        tone="error"
        title="Connection error"
        body={error.message}
      />
    );
  }

  const rows = (data ?? []) as ThingRow[];

  if (rows.length === 0) {
    return (
      <StatusCard
        tone="ok"
        title="✅ Connected to Supabase"
        body="0 published things yet — that's expected until we seed content (or until the test row is added). The connection itself is working."
      />
    );
  }

  return (
    <>
      <StatusCard
        tone="ok"
        title="✅ Connected to Supabase"
        body={`Reading the things table — ${rows.length} published row${
          rows.length === 1 ? "" : "s"
        }.`}
      />
      <div style={card}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((r) => (
            <li
              key={r.id}
              style={{
                padding: "var(--space-3) 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--weight-semi)",
                  fontSize: "var(--text-lg)",
                  color: "var(--text)",
                }}
              >
                {r.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  color: "var(--text-muted)",
                  marginTop: "var(--space-1)",
                }}
              >
                {r.type} · {r.neighborhood ?? "—"} · tier {r.happening_tier} ·{" "}
                {r.status}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "ok" | "warn" | "error";
  title: string;
  body: string;
}) {
  const accent =
    tone === "error"
      ? "var(--sev-blocker)"
      : tone === "warn"
        ? "var(--sev-high)"
        : "var(--forest)";

  return (
    <div style={{ ...card, borderLeft: `4px solid ${accent}` }}>
      <h2
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: "var(--weight-bold)",
          fontSize: "var(--text-lg)",
          color: "var(--text)",
          margin: "0 0 var(--space-2)",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-base)",
          lineHeight: "var(--leading-body)",
          color: "var(--text-muted)",
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}
