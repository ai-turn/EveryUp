import { useEffect, useRef, useState } from 'react';
import { MaterialIcon, Toggle } from '../../../components/common';
import type { ApiRequestListParams } from '../../../services/api';

interface RequestFiltersProps {
  params: ApiRequestListParams;
  onChange: (params: ApiRequestListParams) => void;
  pathSuggestions?: string[];
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type StatusQuickFilter = 'all' | '2xx' | '4xx' | '5xx';

const STATUS_RANGES: Record<StatusQuickFilter, { minStatus?: number; maxStatus?: number }> = {
  all: { minStatus: undefined, maxStatus: undefined },
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

function fromMsAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

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

export function RequestFilters({ params, onChange, pathSuggestions = [] }: RequestFiltersProps) {
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
      from: fromMsAgo(range.ms),
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

  const groupClass =
    'h-9 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-2';
  const groupLabelClass =
    'text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-text-dim-dark select-none pr-1 border-r border-slate-200 dark:border-ui-border-dark mr-1';

  return (
    <div className="space-y-2">
      {/* Row 1: filter groups (uniform h-9) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Method filter */}
        <div className={groupClass}>
          <span className={groupLabelClass}>Method</span>
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
        <div className={groupClass}>
          <span className={groupLabelClass}>Status</span>
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
        <div className={groupClass}>
          <span className={groupLabelClass}>Time</span>
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
        <label className="h-9 flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-3">
          <Toggle
            checked={!!params.errorsOnly}
            onChange={setErrorsOnly}
          />
          <span className="text-xs font-medium text-slate-600 dark:text-text-muted-dark select-none">
            Errors only
          </span>
        </label>
      </div>

      {/* Row 2: search with path suggestions (custom combobox) */}
      <SearchCombobox
        value={params.search ?? ''}
        onChange={setSearch}
        suggestions={pathSuggestions}
      />
    </div>
  );
}

interface SearchComboboxProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
}

function SearchCombobox({ value, onChange, suggestions }: SearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = 'api-request-search-listbox';

  const query = value.trim().toLowerCase();
  const filtered = query
    ? suggestions.filter((s) => s.toLowerCase().includes(query))
    : suggestions;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [value, open]);

  const commit = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!open && filtered.length > 0) setOpen(true);
      e.preventDefault();
      setFocusedIndex((i) => (filtered.length === 0 ? -1 : (i + 1) % filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) =>
        filtered.length === 0 ? -1 : (i - 1 + filtered.length) % filtered.length,
      );
    } else if (e.key === 'Enter') {
      if (open && focusedIndex >= 0 && focusedIndex < filtered.length) {
        e.preventDefault();
        commit(filtered[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showDropdown = open && filtered.length > 0;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <span className="absolute left-3 material-symbols-outlined text-slate-400 dark:text-text-dim-dark text-sm select-none pointer-events-none">
          search
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search path, body…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            focusedIndex >= 0 ? `${listboxId}-opt-${focusedIndex}` : undefined
          }
          className={`h-9 w-full pl-9 pr-9 text-sm bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-text-dim-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors ${
            showDropdown ? 'rounded-t-lg rounded-b-none border-b-transparent' : 'rounded-lg'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            aria-label="Clear search"
            className="absolute right-2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-text-base-dark hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors cursor-pointer"
          >
            <MaterialIcon name="close" className="text-sm" />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 right-0 z-20 max-h-64 overflow-y-auto bg-white dark:bg-bg-surface-dark border border-primary border-t-slate-200 dark:border-t-ui-border-dark rounded-b-lg shadow-lg ring-2 ring-primary/30 -mt-px"
        >
          <li className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-text-dim-dark border-b border-slate-100 dark:border-ui-border-dark select-none">
            {query ? 'Matching paths' : 'Recent paths'}
          </li>
          {filtered.map((path, i) => {
            const isFocused = i === focusedIndex;
            return (
              <li
                key={path}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isFocused}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(path);
                }}
                onMouseEnter={() => setFocusedIndex(i)}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors ${
                  isFocused
                    ? 'bg-primary/10 text-primary dark:text-primary'
                    : 'text-slate-700 dark:text-text-base-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark'
                }`}
              >
                <MaterialIcon
                  name="history"
                  className="text-sm text-slate-400 dark:text-text-dim-dark shrink-0"
                />
                <span className="truncate font-mono text-xs">{path}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
