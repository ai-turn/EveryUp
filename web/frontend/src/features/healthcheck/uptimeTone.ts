export type UptimeTone = 'healthy' | 'warning' | 'critical';

export const UPTIME_SLO_TARGET = 99.9;
export const UPTIME_WARNING_FLOOR = 99.5;

export function getUptimeTone(uptime: number): UptimeTone {
  if (uptime >= UPTIME_SLO_TARGET) return 'healthy';
  if (uptime >= UPTIME_WARNING_FLOOR) return 'warning';
  return 'critical';
}

export function getUptimeTextClass(uptime: number): string {
  const tone = getUptimeTone(uptime);
  if (tone === 'healthy') return 'text-emerald-600 dark:text-emerald-400';
  if (tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function getUptimeIconClass(uptime: number): string {
  const tone = getUptimeTone(uptime);
  if (tone === 'healthy') return 'text-emerald-500';
  if (tone === 'warning') return 'text-amber-500';
  return 'text-rose-500';
}

export function getUptimeBarClass(uptime: number): string {
  const tone = getUptimeTone(uptime);
  if (tone === 'healthy') return 'bg-emerald-500';
  if (tone === 'warning') return 'bg-amber-500';
  return 'bg-rose-500';
}
