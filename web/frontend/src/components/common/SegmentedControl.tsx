// Single-track segmented control for mutually-exclusive pick-one selectors
// (time ranges, date presets, category filters). One recessed track, the
// active option raised as a pill. Replaces the old scattered "separate badge"
// button groups so range/preset pickers read the same everywhere.
//
// Dark layering is context-proof: track = ui-hover, active pill = ui-active —
// both lighter than the page (#0d1117) and card (#161b22) surfaces, so the
// control stays visible whether it sits on a card or the bare page.

interface SegmentedOption<T extends string> {
  label: string;
  value: T;
}

const SIZES = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-2.5 py-1.5 text-sm',
} as const;

export function SegmentedControl<T extends string>({
  options, value, onChange, size = 'sm', ariaLabel,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: keyof typeof SIZES;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg p-0.5 bg-ui-hover border border-ui-border"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`${SIZES[size]} font-semibold rounded-md transition-colors ${
              active
                ? 'bg-ui-raised text-text-base shadow-sm'
                : 'text-text-muted hover:text-text-base'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
