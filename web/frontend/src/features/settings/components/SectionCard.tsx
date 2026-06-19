import { MaterialIcon } from '../../../components/common';

export function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <MaterialIcon name={icon} className="text-primary text-lg" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
