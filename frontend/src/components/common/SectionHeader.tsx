import { ReactNode } from 'react';
import { MaterialIcon } from './MaterialIcon';

interface SectionHeaderProps {
  /** Material icon name shown in the colored badge */
  icon: string;
  /** Section title (h2) */
  title: string;
  /** Optional subtitle below the title — typically a count or summary */
  subtitle?: ReactNode;
  /** Optional right-aligned slot (filters, action button) */
  right?: ReactNode;
  /** Color tone for the icon badge */
  tone?: 'primary' | 'amber' | 'red' | 'emerald' | 'slate';
  /** Tailwind margin-bottom override (default: mb-4) */
  className?: string;
}

const toneStyles: Record<NonNullable<SectionHeaderProps['tone']>, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
  amber:   { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  red:     { bg: 'bg-red-500/10', text: 'text-red-500' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  slate:   { bg: 'bg-slate-500/10', text: 'text-slate-500' },
};

/**
 * Standalone section header (icon badge + title + subtitle + optional right slot)
 * for pages that show a grid/cards layout where wrapping in a bordered ListSection
 * would create visual noise. Use ListSection when you have a divided row list.
 */
export function SectionHeader({
  icon,
  title,
  subtitle,
  right,
  tone = 'primary',
  className = 'mb-4',
}: SectionHeaderProps) {
  const t = toneStyles[tone];
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`w-9 h-9 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
        <MaterialIcon name={icon} className={`${t.text} text-lg`} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{title}</h2>
        {subtitle != null && (
          <div className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex-none flex items-center gap-2">{right}</div>}
    </div>
  );
}
