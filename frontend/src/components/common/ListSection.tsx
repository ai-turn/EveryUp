import { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface ListSectionProps {
  /** Material icon name shown in the colored badge on the left */
  icon: string;
  /** Section title (h2) */
  title: string;
  /** Optional subtitle below the title — typically a count or summary */
  subtitle?: ReactNode;
  /** Optional right-aligned slot in the header (filters, action buttons) */
  right?: ReactNode;
  /** Optional tone for the icon badge (default: primary) */
  tone?: 'primary' | 'amber' | 'red' | 'emerald' | 'slate';
  /** When true, renders children as a vertically divided list (border-b between rows) */
  divided?: boolean;
  children: ReactNode;
}

const toneStyles: Record<NonNullable<ListSectionProps['tone']>, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  red:     { bg: 'bg-red-500/10', text: 'text-red-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  slate:   { bg: 'bg-slate-500/10', text: 'text-slate-500' },
};

/**
 * Standard list/section container — a rounded card with a header
 * (icon + title + subtitle + optional right slot) above its body.
 *
 * Pass `divided` to draw `divide-y` between direct children (row list pattern,
 * like the alert channels tab). Otherwise renders children with default padding
 * for grid/card layouts.
 */
export function ListSection({
  icon,
  title,
  subtitle,
  right,
  tone = 'primary',
  divided = false,
  children,
}: ListSectionProps) {
  const t = toneStyles[tone];

  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-ui-border-dark">
        <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
          <MaterialIcon name={icon} className={`${t.text} text-lg`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{title}</h2>
          {subtitle != null && (
            <div className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {right && <div className="flex-none flex items-center gap-2">{right}</div>}
      </div>
      {divided ? (
        <div className="divide-y divide-slate-200 dark:divide-ui-border-dark">{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
