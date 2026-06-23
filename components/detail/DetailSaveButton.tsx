"use client";

import { Button } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";

export function DetailSaveButton({ id }: { id: string; title: string }) {
  const { isSaved, toggle } = useSaves();
  const saved = isSaved(id);
  return (
    <Button variant={saved ? "secondary" : "primary"} block onClick={() => toggle(id)}>
      {saved ? "♥ Saved to your list" : "♡ Save to my list"}
    </Button>
  );
}
