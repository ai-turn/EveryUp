import type { ChartData } from '../../types/infra';

export type { ChartData };

const now = Date.now();
const makePoints = (count: number, genFn: (i: number) => Record<string, number | string>) =>
  Array.from({ length: count }, (_, i) => ({
    time: new Date(now - (count - 1 - i) * 30 * 60 * 1000).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    ...genFn(i),
  }));

export const mockCharts: ChartData[] = [
  {
    title: 'CPU Usage',
    unit: '%',
    yMax: 100,
    data: makePoints(12, (i) => ({
      cpu: Math.round(20 + Math.sin(i * 0.8) * 15 + (i % 3) * 4),
    })),
    series: [{ key: 'cpu', label: 'Usage', color: '#2563eb' }],
  },
  {
    title: 'Memory Flow',
    unit: 'GB',
    data: makePoints(12, (i) => ({
      memUsed: parseFloat((20 + Math.sin(i * 0.5) * 5 + i * 0.3).toFixed(1)),
      memCached: parseFloat((8 + Math.cos(i * 0.4) * 2).toFixed(1)),
    })),
    series: [
      { key: 'memUsed', label: 'Used', color: '#3b82f6' },
      { key: 'memCached', label: 'Cached', color: '#14b8a6' },
    ],
  },
  {
    title: 'Disk I/O',
    unit: 'MB/s',
    data: makePoints(12, (i) => ({
      diskRead: parseFloat((Math.abs(Math.sin(i * 1.2)) * 80 + 10).toFixed(2)),
      diskWrite: parseFloat((Math.abs(Math.cos(i * 0.9)) * 40 + 5).toFixed(2)),
    })),
    series: [
      { key: 'diskRead', label: 'Read', color: '#0ea5e9' },
      { key: 'diskWrite', label: 'Write', color: '#f97316' },
    ],
  },
  {
    title: 'Network Traffic',
    unit: 'MB/s',
    data: makePoints(12, (i) => ({
      netIn: parseFloat((Math.abs(Math.sin(i * 0.7)) * 24 + 4).toFixed(2)),
      netOut: parseFloat((Math.abs(Math.cos(i * 0.9)) * 18 + 2).toFixed(2)),
    })),
    series: [
      { key: 'netIn', label: 'In', color: '#10b981' },
      { key: 'netOut', label: 'Out', color: '#06b6d4' },
    ],
  },
];
