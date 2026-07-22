import Link from "next/link";
import type { TodayData } from "@/lib/todayServer";

// S1 (Today screen), the Morning Ledger per docs/cockpit/cockpit_mockups_r1.html
// #today-a. Plain server component, no interactivity of its own (every row is
// a real link; the shell's badges/counts refresh separately).

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit",
});

export function TodayView({ data }: { data: TodayData }) {
  const nowDate = new Date(data.generatedAt);
  const dateLabel = `${DATE_FMT.format(nowDate)} · ${TIME_FMT.format(nowDate)}`;
  const lastRunLabel = data.lastRunAt ? TIME_FMT.format(new Date(data.lastRunAt)) : null;

  return (
    <main className="today">
      <div className="dateline">
        <h1 className="greet">Good morning, <em>Jim.</em></h1>
        <time dateTime={nowDate.toISOString()}>{dateLabel}</time>
      </div>
      <p className="night-line">{data.nightSummary}</p>

      {data.unhealthy ? (
        <div className="attention is-error" role="alert">
          <span className="sun" aria-hidden="true">⚠</span>
          <p>Couldn&rsquo;t read some counts, the ledger below may be incomplete.</p>
        </div>
      ) : null}

      {data.attention.length > 0 ? (
        <div className="attention" role="status">
          <span className="sun" aria-hidden="true">☀</span>
          <p>
            <b>{data.attention.length === 1 ? "One thing won’t wait: " : "A couple things won’t wait: "}</b>
            {data.attention.map((a, i) => (
              <span key={a.href}>
                {i > 0 ? " · " : ""}
                {a.text}, <Link href={a.href}>{a.linkLabel} &rarr;</Link>
              </span>
            ))}
          </p>
        </div>
      ) : null}

      <ul className="ledger">
        {data.rows.map((row) => (
          <li key={row.key}>
            <Link className="today-row" href={row.href}>
              <span className={`dot ${row.dot}`} aria-hidden="true" />
              <span className="ldesk">{row.label}</span>
              <span className="today-count">{row.count}<small>{row.countLabel}</small></span>
              <span className="lstory">{row.story}</span>
              <span className="lgo">{row.goLabel}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="today-foot">
        <span>{lastRunLabel ? `nightly run ${lastRunLabel}` : "no run recorded yet"}</span>
        <Link href="/admin/review">Recently rejected ({data.recentlyRejectedCount} this week) &rarr;</Link>
      </div>
    </main>
  );
}
