export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  // ver2 프로토타입 오마주: 고정폭 레이블 | 설명 | 컨트롤 3열 행.
  return (
    <div className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3 border-b border-ui-border-soft last:border-0">
      <p className="w-40 shrink-0 text-sm font-semibold text-text-secondary">{label}</p>
      {description && (
        <p className="flex-1 min-w-0 text-xs text-text-dim">{description}</p>
      )}
      <div className="shrink-0 sm:ml-auto">{children}</div>
    </div>
  );
}
