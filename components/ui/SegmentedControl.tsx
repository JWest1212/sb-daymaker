interface Option {
  label: string;
  value: string;
}

/** Segmented switch (e.g. Today · This Week · This Month). Controlled. */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="sbd-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className="sbd-seg__btn"
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
