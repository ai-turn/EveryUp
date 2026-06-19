/**
 * Visual configuration for process status states
 *
 * Maps process status values to their Tailwind CSS class styling.
 * Used for styling process status badges in monitoring tables.
 *
 * @example
 * <span className={processStatusConfig[process.status]}>
 *   {process.status}
 * </span>
 */
export const processStatusConfig: Record<'RUNNING' | 'IDLE' | 'STOPPED', string> = {
  RUNNING: 'bg-lime-400/10 text-lime-400 dark:bg-lime-400/10 dark:text-lime-400',
  IDLE: 'bg-slate-500/10 text-slate-400 dark:bg-ui-active-dark/10 dark:text-text-muted-dark',
  STOPPED: 'bg-red-500/10 text-red-400 dark:bg-red-500/10 dark:text-red-400',
} as const;
