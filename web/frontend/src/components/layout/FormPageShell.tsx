import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../common';

interface FormPageShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Path to navigate to on back. Defaults to navigate(-1). */
  backTo?: string;
}

/**
 * Full-page shell that replaces the right SidePanel for create/edit forms.
 *
 * Forms still emit a fragment with [scrollable content + bottom action bar],
 * so the shell provides a fixed-height flex column to host that pattern.
 */
export function FormPageShell({ title, subtitle, children, backTo }: FormPageShellProps) {
  const navigate = useNavigate();
  const handleBack = () => (backTo ? navigate(backTo) : navigate(-1));

  return (
    <div
      className="-m-4 sm:-m-6 md:-m-8 flex flex-col bg-white dark:bg-bg-surface-dark h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]"
    >
      <header className="flex-none flex items-center gap-3 h-16 border-b border-slate-200 dark:border-ui-border-dark px-4 sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-slate-100 dark:hover:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark transition-colors"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-text-muted-dark truncate">{subtitle}</p>}
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
