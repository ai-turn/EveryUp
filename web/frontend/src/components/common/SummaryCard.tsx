import { MaterialIcon } from './MaterialIcon';

export function SummaryCard({ icon, label, value, detail, tone = 'idle' }: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  tone?: 'healthy' | 'warn' | 'error' | 'idle';
}) {
  const toneClass = {
    healthy: 'text-status-healthy',
    warn: 'text-status-warn',
    error: 'text-status-error',
    idle: 'text-status-idle',
  }[tone];

  return (
    <article className="rounded-xl border border-ui-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-label text-text-secondary">{label}</p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-text-base">{value}</p>
        </div>
        <MaterialIcon size={20} name={icon} className={`${toneClass}`} />
      </div>
      <p className={`mt-3 type-caption ${toneClass}`}>{detail}</p>
    </article>
  );
}
