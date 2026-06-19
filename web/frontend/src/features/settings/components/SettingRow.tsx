export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-4 border-b border-slate-100 dark:border-ui-border-dark last:border-0">
      <div className="min-w-0">
        <p className="text-base font-medium text-slate-900 dark:text-white">{label}</p>
        {description && (
          <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
