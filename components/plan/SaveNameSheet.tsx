"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui";

interface SaveNameSheetProps {
  defaultTitle: string;
  onSave: (title: string) => void;
  onClose: () => void;
}

export function SaveNameSheet({ defaultTitle, onSave, onClose }: SaveNameSheetProps) {
  const [title, setTitle] = useState(defaultTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    const trimmed = title.trim() || defaultTitle;
    onSave(trimmed);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      kicker="Save your plan"
      title="Name your day"
    >
      <div className="sbd-namepicker">
        <label htmlFor="sbd-plan-name" className="sbd-namepicker__lbl">
          Plan name
        </label>
        <input
          id="sbd-plan-name"
          ref={inputRef}
          type="text"
          className="sbd-namepicker__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKey}
          autoFocus
          maxLength={80}
          placeholder={defaultTitle}
          aria-label="Plan name"
        />
        <p className="sbd-namepicker__hint">
          You can keep the default or give it your own name.
        </p>
        <div className="sbd-namepicker__actions">
          <button
            type="button"
            className="sbd-btn sbd-btn--primary"
            onClick={handleSave}
          >
            Save plan
          </button>
          <button
            type="button"
            className="sbd-btn sbd-btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
