import { Toggle } from '../../../components/common';
import type { ApiRequestListParams } from '../../../services/api';

interface RequestFiltersProps {
  params: ApiRequestListParams;
  onChange: (params: ApiRequestListParams) => void;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type StatusQuickFilter = 'all' | '2xx' | '4xx' | '5xx';

const STATUS_RANGES: Record<StatusQuickFilter, { minStatus?: number; maxStatus?: number }> = {
  all: {},
  '2xx': { minStatus: 200, maxStatus: 299 },
  '4xx': { minStatus: 400, maxStatus: 499 },
  '5xx': { minStatus: 500, maxStatus: 599 },
};

const TIME_RANGES = [
  { label: '1h', ms: 3_600_000 },
  { label: '6h', ms: 21_600_000 },
  { label: '24h', ms: 86_400_000 },
  { label: '7d', ms: 604_800_000 },
] as const;

type TimeRangeLabel = (typeof TIME_RANGES)[number]['label'];

function getActiveTimeRange(from?: string): TimeRangeLabel {
  if (!from) return '24h';
  const diff = Date.now() - new Date(from).getTime();
  const closest = TIME_RANGES.reduce((best, r) =>
    Math.abs(r.ms - diff) < Math.abs(best.ms - diff) ? r : best,
  );
  return closest.label;
}

function getActiveStatusFilter(
  minStatus?: number,
  maxStatus?: number,
): StatusQuickFilter {
  if (minStatus === 200 && maxStatus === 299) return '2xx';
  if (minStatus === 400 && maxStatus === 499) return '4xx';
  if (minStatus === 500 && maxStatus === 599) return '5xx';
  return 'all';
}

export function RequestFilters({ params, onChange }: RequestFiltersProps) {
  const activeTimeRange = getActiveTimeRange(params.from);
  const activeStatusFilter = getActiveStatusFilter(params.minStatus, params.maxStatus);

  function setMethod(method: string | undefined) {
    onChange({ ...params, method, offset: 0 });
  }

  function setStatusFilter(filter: StatusQuickFilter) {
    const range = STATUS_RANGES[filter];
    onChange({ ...params, ...range, offset: 0 });
  }

  function setTimeRange(label: TimeRangeLabel) {
    const range = TIME_RANGES.find((r) => r.label === label)!;
    onChange({
      ...params,
      from: new Date(Date.now() - range.ms).toISOString(),
      to: undefined,
      offset: 0,
    });
  }

  function setSearch(search: string) {
    onChange({ ...params, search: search || undefined, offset: 0 });
  }

  function setErrorsOnly(errorsOnly: boolean) {
    onChange({ ...params, errorsOnly: errorsOnly || undefined, offset: 0 });
  }

  const chipBase =
    'px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-100 select-none';
  const chipActive = 'bg-primary text-white';
  const chipInactive =
    'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark hover:bg-slate-200 dark:hover:bg-ui-active-dark';

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex items-center">
        <span className="absolute left-3 material-symbols-outlined text-slate-400 dark:text-text-dim-dark text-sm select-none">
          search
        </span>
        <input
          type="text"
          value={params.search ?? ''}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search path, body…"
          className="pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors w-52"
        />
      </div>

      {/* Method filter */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setMethod(undefined)}
          className={`${chipBase} ${!params.method ? chipActive : chipInactive}`}
        >
          ALL
        </button>
        {HTTP_METHODS.map((m) => (
          <button
            key={m}
            onClick={() => setMethod(params.method === m ? undefined : m)}
            className={`${chipBase} ${params.method === m ? chipActive : chipInactive}`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Status quick filter */}
      <div className="flex items-center gap-1.5">
        {(['all', '2xx', '4xx', '5xx'] as StatusQuickFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`${chipBase} ${activeStatusFilter === f ? chipActive : chipInactive}`}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Time range selector */}
      <div className="flex items-center gap-1.5">
        {TIME_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => setTimeRange(r.label)}
            className={`${chipBase} ${activeTimeRange === r.label ? chipActive : chipInactive}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Errors only toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Toggle
          checked={!!params.errorsOnly}
          onChange={setErrorsOnly}
        />
        <span className="text-xs font-medium text-slate-600 dark:text-text-muted-dark select-none">
          Errors only
        </span>
      </label>
    </div>
  );
}
