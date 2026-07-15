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
      className="-m-4 sm:-m-6 md:-m-8 flex flex-col bg-bg-surface h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]"
    >
      <header className="flex-none flex items-center gap-3 h-16 border-b border-ui-border px-4 sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="p-2 -ml-2 rounded-lg hover:bg-ui-hover text-text-muted transition-colors"
        >
          <MaterialIcon name="arrow_back" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-text-base tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-text-muted truncate">{subtitle}</p>}
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
