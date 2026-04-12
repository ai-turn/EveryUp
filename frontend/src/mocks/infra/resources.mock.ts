import type { GaugeData } from '../../types/infra';

export type { GaugeData };

export const mockGauges: GaugeData[] = [
  {
    label: 'CPU Load',
    percentage: 42,
    color: '#137fec',
    subtitle: '16 Cores Online',
    trend: '+2.4% from last hour',
    trendType: 'up',
  },
  {
    label: 'Memory Usage',
    percentage: 68,
    color: '#a3e635',
    subtitle: '43.5 GB / 64 GB',
    trend: '-0.8% free space',
    trendType: 'down',
  },
  {
    label: 'Disk Space',
    percentage: 24,
    color: '#f59e0b',
    subtitle: '480 GB / 2 TB',
    trend: 'Stable',
    trendType: 'stable',
  },
];
