import { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /** Filter selects/buttons rendered after the search field */
  children?: ReactNode;
  /** Tailwind margin-bottom override (default: mb-6) */
  className?: string;
}

/**
 * Standard top-of-list search + filter row used across list pages.
 * Children render to the right of the search input as selects/chips.
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
  className = 'mb-6',
}: FilterBarProps) {
  return (
    <div className={`flex flex-col md:flex-row gap-3 ${className}`}>
      <div className="relative flex-1">
        <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all dark:text-white dark:placeholder-text-muted-dark"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-text-base-dark rounded transition-colors"
          >
            <MaterialIcon name="close" className="text-base" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
