"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useSaves, type SaveState } from "@/components/saves/SavesProvider";

export function RestoreView({ saves }: { saves: Record<string, SaveState> }) {
  const { merge } = useSaves();
  const [done, setDone] = useState(false);
  const count = Object.keys(saves).length;

  return (
    <main className="sbd-public">
      <div className="sbd-public__inner">
        <p className="sbd-public__eyebrow">Restore</p>
        <h1 className="sbd-public__title">Bring your saves back</h1>
        <p className="sbd-public__desc">
          We found {count} saved item{count === 1 ? "" : "s"} in this backup.
        </p>

        <div className="sbd-public__actions">
          {done ? (
            <p className="sbd-public__saved">
              ✓ Restored to this device.
            </p>
          ) : (
            <Button
              variant="cta"
              block
              disabled={count === 0}
              onClick={() => {
                merge(saves);
                setDone(true);
              }}
            >
              Restore {count} to this device
            </Button>
          )}
          <Link href="/saved" className="sbd-public__link">
            Go to Saved →
          </Link>
        </div>
      </div>
    </main>
  );
}
