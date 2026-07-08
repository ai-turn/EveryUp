// Shared time-range preset for the service-detail charts (response time,
// metrics, request trends, infra trends). List filters (logs/requests) keep
// their own day-based presets — different axis.
export type GlobalTimeRange = '1h' | '6h' | '24h';

const OPTIONS: { label: string; value: GlobalTimeRange }[] = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
];

export function TimeRangePicker({ value, onChange }: {
  value: GlobalTimeRange;
  onChange: (range: GlobalTimeRange) => void;
}) {
  return (
    <div className="flex gap-1">
      {OPTIONS.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
            value === r.value
              ? 'bg-primary text-white'
              : 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-secondary-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
