export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // ver2 프로토타입 오마주: 아이콘 칩 없는 컴팩트 헤더 (13.5px bold + 11.5px muted).
  // 파괴적 작업도 카드는 중립 — 색은 액션 텍스트에만 싣는다.
  return (
    <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
        {subtitle && (
          <p className="text-2xs text-slate-400 dark:text-text-dim-dark mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
