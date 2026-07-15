export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  // ver2 프로토타입 오마주: 아이콘 칩 없는 컴팩트 헤더 (14px bold + 12px muted).
  // 파괴적 작업도 카드는 중립 — 색은 액션 텍스트에만 싣는다.
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-5">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-text-base">{title}</h2>
        {subtitle && (
          <p className="text-xs text-text-dim mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
