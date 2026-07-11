import type { GaugeData } from '../../types/infra';
import { SERIES_HEX } from '../../components/charts';

export type { GaugeData };

export const mockGauges: GaugeData[] = [
  {
    label: 'CPU',
    percentage: 42,
    color: SERIES_HEX.primary,
    subtitle: '16 Cores Online',
    trend: '+2.4%',
    trendType: 'up',
  },
  {
    label: 'Memory',
    percentage: 68,
    color: SERIES_HEX.emerald,
    subtitle: '43.5 GB / 64 GB',
    trend: '-0.8%',
    trendType: 'down',
  },
  {
    label: 'Disk',
    percentage: 89,
    color: SERIES_HEX.amber,
    subtitle: '1.78 TB / 2 TB',
    // 디스크 용량은 추세 시계열이 없어 배지 미표시 (실제 경로와 일치)
    trend: '',
    trendType: 'stable',
  },
  {
    label: 'Network',
    percentage: 72,
    color: SERIES_HEX.teal,
    subtitle: 'In 12.4 MB/s · Out 5.6 MB/s',
    trend: '+3.1%',
    trendType: 'up',
    displayValue: '18.0',
    displayUnit: 'MB/s',
  },
];
