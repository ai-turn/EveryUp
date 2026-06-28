import type { GaugeData } from '../../types/infra';

export type { GaugeData };

export const mockGauges: GaugeData[] = [
  {
    label: 'CPU',
    percentage: 42,
    color: '#137fec',
    subtitle: '16 Cores Online',
    trend: '+2.4%',
    trendType: 'up',
  },
  {
    label: 'Memory',
    percentage: 68,
    color: '#a3e635',
    subtitle: '43.5 GB / 64 GB',
    trend: '-0.8%',
    trendType: 'down',
  },
  {
    label: 'Disk',
    percentage: 89,
    color: '#f59e0b',
    subtitle: '1.78 TB / 2 TB',
    // 디스크 용량은 추세 시계열이 없어 배지 미표시 (실제 경로와 일치)
    trend: '',
    trendType: 'stable',
  },
  {
    label: 'Network',
    percentage: 72,
    color: '#10b981',
    subtitle: 'In 12.4 MB/s · Out 5.6 MB/s',
    trend: '+3.1%',
    trendType: 'up',
    displayValue: '18.0',
    displayUnit: 'MB/s',
  },
];
