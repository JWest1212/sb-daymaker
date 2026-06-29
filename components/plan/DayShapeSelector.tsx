"use client";

// DayShapeSelector is no longer used (day-shapes removed in Plan simplification).
// Kept as a file to avoid broken references in git; imports cleaned up.
interface DayShape { id: string; name: string; }

interface DayShapeSelectorProps {
  shapes: DayShape[];
  value: string;
  onChange: (id: string) => void;
}

export function DayShapeSelector({
  shapes,
  value,
  onChange,
}: DayShapeSelectorProps) {
  return (
    <div className="sbd-dayopts" role="group" aria-label="Day shape">
      {shapes.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`sbd-daypill${value === s.id ? " sbd-daypill--on" : ""}`}
          aria-pressed={value === s.id}
          onClick={() => onChange(s.id)}
        >
          <span className="sbd-daypill__dl">Day shape</span>
          <span className="sbd-daypill__dn">{s.name}</span>
        </button>
      ))}
    </div>
  );
}
