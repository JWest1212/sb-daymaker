import Link from "next/link";
import { eventDateWithYear } from "@/lib/format/eventTime";

/**
 * R1 Wave 2 (W2.2). The banner on a page for something that already happened.
 *
 * Archived rows stay reachable on purpose. Wave 2 archives roughly a thousand
 * finished events, and people have those pages saved, shared with a friend, or
 * sitting in a restore link. Turning all of them into 404s would break exactly
 * the trust Wave 1 was spent rebuilding. So the page still renders, the save
 * heart still works (been-marking depends on past items surviving), and the page
 * simply says what it is, up front, before the visitor reads the rest as if it
 * were an upcoming event.
 */
export function ArchivedBanner({ startsAt }: { startsAt: string | null }) {
  const when = startsAt ? eventDateWithYear(startsAt) : null;
  return (
    <aside className="sbd-archived" role="note">
      <p className="sbd-archived__line">
        {when ? `This already happened on ${when}.` : "This already happened."}{" "}
        <Link href="/" className="sbd-archived__link">
          Here is what else is on.
        </Link>
      </p>
    </aside>
  );
}
