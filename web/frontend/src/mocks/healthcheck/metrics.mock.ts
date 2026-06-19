/**
 * Mock data for realtime metrics
 * Used by: RealtimeMetrics component
 */

export interface MetricData {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down';
  subtext: string;
  icon: string;
  iconColor: string;
}

export const mockMetrics: MetricData[] = [
  {
    label: 'Avg Latency',
    value: '124ms',
    change: '-4.2%',
    changeType: 'down',
    subtext: 'Compared to previous 24h',
    icon: 'timer',
    iconColor: 'text-slate-400 dark:text-text-muted-dark',
  },
  {
    label: 'Error Rate',
    value: '0.02%',
    change: '-0.01%',
    changeType: 'down',
    subtext: '99.98% success rate',
    icon: 'error_outline',
    iconColor: 'text-[#fa6238]',
  },
  {
    label: 'Request Volume',
    value: '45.2k',
    change: '+12%',
    changeType: 'up',
    subtext: 'Peak: 3.2k req/min',
    icon: 'speed',
    iconColor: 'text-primary',
  },
];
