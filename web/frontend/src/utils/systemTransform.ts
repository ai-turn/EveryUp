import type { Host, SystemInfo, SystemMetricsHistory, SystemProcess } from '../services/api';
import type { GaugeData, ChartData, Process, Resource } from '../types/infra';

// --- Host → Resource ---
export function hostToResource(host: Host): Resource {
  const statusMap: Record<string, Resource['status']> = {
    online: 'healthy',
    offline: 'critical',
    unknown: 'warning',
    error: 'error',
  };
  return {
    id: host.id,
    name: host.name,
    type: (host.resourceCategory || 'server') as Resource['type'],
    status: statusMap[host.status] || 'warning',
    cluster: host.group,
    ip: host.ip,
    isActive: host.isActive,
    isRemote: host.type === 'remote',
  };
}

// --- Host[] → Resource[] ---
export function hostsToResources(hosts: Host[]): Resource[] {
  return hosts.map(hostToResource);
}

// --- SystemInfo → Resource[] (legacy, kept for backward compatibility) ---
export function systemInfoToResources(info: SystemInfo): Resource[] {
  const maxUsage = Math.max(info.cpu.usage, info.memory.usage, info.disk.usage);
  const status: Resource['status'] =
    maxUsage >= 90 ? 'critical' : maxUsage >= 80 ? 'warning' : 'healthy';

  return [
    {
      id: 'local',
      name: info.hostname,
      type: 'server',
      status,
      cluster: 'Local',
      ip: info.ip,
    },
  ];
}

// --- SystemInfo → GaugeData[] ---
// Network gauge uses a 125 MB/s baseline (1 Gbps link) to map throughput → %.
const NETWORK_FULL_SCALE_MBPS = 125;

// 추세 배지: history(6h)의 앞·뒤 절반 평균을 비교한 상대 변화율(%).
// 단위에 무관하므로 %·GB·throughput 어떤 series든 방향/크기가 일관된다.
// 시계열이 없거나(디스크 용량) 변화가 미미하면 빈 값 → 카드에서 배지 숨김.
function trendFromSeries(series: number[]): Pick<GaugeData, 'trend' | 'trendType'> {
  const vals = series.filter(Number.isFinite);
  if (vals.length < 4) return { trend: '', trendType: 'stable' };
  const mid = Math.floor(vals.length / 2);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const older = mean(vals.slice(0, mid));
  const newer = mean(vals.slice(mid));
  if (older <= 0) return { trend: '', trendType: 'stable' };
  const pct = ((newer - older) / older) * 100;
  if (Math.abs(pct) < 1) return { trend: '', trendType: 'stable' };
  return { trend: `${pct > 0 ? '+' : '-'}${Math.abs(pct).toFixed(1)}%`, trendType: pct > 0 ? 'up' : 'down' };
}

export function systemInfoToGauges(info: SystemInfo, history?: SystemMetricsHistory): GaugeData[] {
  const pts = history?.points ?? [];
  const gauges: GaugeData[] = [
    {
      label: 'CPU',
      percentage: info.cpu.usage,
      color: '#137fec',
      subtitle: `${info.cpu.cores} Cores Online`,
      ...trendFromSeries(pts.map((p) => p.cpu)),
    },
    {
      label: 'Memory',
      percentage: info.memory.usage,
      color: '#a3e635',
      subtitle: `${info.memory.used} GB / ${info.memory.total} GB`,
      ...trendFromSeries(pts.map((p) => p.memUsed)),
    },
    {
      label: 'Disk',
      percentage: info.disk.usage,
      color: '#f59e0b',
      subtitle: `${info.disk.used} GB / ${info.disk.total} GB`,
      // 디스크 용량%는 history에 시계열이 없어 추세 미산출 (diskRead/Write는 I/O throughput).
      trend: '',
      trendType: 'stable',
    },
  ];

  const netIn = info.network?.in ?? 0;
  const netOut = info.network?.out ?? 0;
  const total = netIn + netOut;
  const { value, unit } = formatThroughput(total);

  gauges.push({
    label: 'Network',
    percentage: Math.max(0, Math.min(100, Math.round((total / NETWORK_FULL_SCALE_MBPS) * 100))),
    color: '#10b981',
    subtitle: `In ${formatThroughput(netIn).value} ${formatThroughput(netIn).unit} · Out ${formatThroughput(netOut).value} ${formatThroughput(netOut).unit}`,
    displayValue: value,
    displayUnit: unit,
    ...trendFromSeries(pts.map((p) => (p.netIn ?? 0) + (p.netOut ?? 0))),
  });

  return gauges;
}

// formatThroughput formats a MB/s value into the largest sensible unit.
export function formatThroughput(mbPerSec: number): { value: string; unit: string } {
  if (!Number.isFinite(mbPerSec) || mbPerSec < 0) return { value: '0', unit: 'KB/s' };
  if (mbPerSec >= 1024) return { value: (mbPerSec / 1024).toFixed(2), unit: 'GB/s' };
  if (mbPerSec >= 1) return { value: mbPerSec.toFixed(2), unit: 'MB/s' };
  return { value: (mbPerSec * 1024).toFixed(0), unit: 'KB/s' };
}

// --- SystemMetricsHistory → ChartData[] ---
function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function historyToCharts(history: SystemMetricsHistory, currentInfo?: SystemInfo | null): ChartData[] {
  const points = history.points ?? [];
  if (points.length === 0 && !currentInfo) return [];

  const data = points.map((p) => ({
    time: formatTimestamp(p.timestamp),
    cpu: Math.round(p.cpu),
    memUsed: parseFloat(p.memUsed.toFixed(1)),
    memCached: parseFloat((p.memCached || 0).toFixed(1)),
    diskRead: parseFloat(p.diskRead.toFixed(2)),
    diskWrite: parseFloat(p.diskWrite.toFixed(2)),
    netIn: parseFloat((p.netIn || 0).toFixed(2)),
    netOut: parseFloat((p.netOut || 0).toFixed(2)),
  }));

  if (currentInfo) {
    data.push({
      time: formatTimestamp(new Date().toISOString()),
      cpu: Math.round(currentInfo.cpu.usage),
      memUsed: parseFloat(currentInfo.memory.used.toFixed(1)),
      memCached: 0,
      diskRead: parseFloat((currentInfo.disk.readSpeed ?? 0).toFixed(2)),
      diskWrite: parseFloat((currentInfo.disk.writeSpeed ?? 0).toFixed(2)),
      netIn: parseFloat((currentInfo.network?.in ?? 0).toFixed(2)),
      netOut: parseFloat((currentInfo.network?.out ?? 0).toFixed(2)),
    });
  }

  const diskMax = Math.max(...data.map((p) => Math.max(p.diskRead, p.diskWrite)), 1);
  const networkMax = Math.max(...data.map((p) => Math.max(p.netIn || 0, p.netOut || 0)), 1);

  return [
    {
      title: 'CPU Usage',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'cpu', label: 'Usage', color: '#2563eb' }],
    },
    {
      title: 'Memory Flow',
      unit: 'GB',
      data,
      series: [
        { key: 'memUsed',   label: 'Used',   color: '#3b82f6' },
        { key: 'memCached', label: 'Cached', color: '#14b8a6' },
      ],
    },
    {
      title: 'Disk I/O',
      unit: 'MB/s',
      yMax: parseFloat((diskMax * 1.2).toFixed(2)),
      data,
      series: [
        { key: 'diskRead', label: 'Read', color: '#0ea5e9' },
        { key: 'diskWrite', label: 'Write', color: '#f97316' },
      ],
    },
    {
      title: 'Network Traffic',
      unit: 'MB/s',
      yMax: parseFloat((networkMax * 1.2).toFixed(2)),
      data,
      series: [
        { key: 'netIn', label: 'In', color: '#10b981' },
        { key: 'netOut', label: 'Out', color: '#06b6d4' },
      ],
    },
  ];
}

// --- SystemProcess[] → Process[] ---
const iconMap: Record<string, string> = {
  postgres: 'terminal',
  postgresql: 'terminal',
  node: 'deployed_code',
  nginx: 'language',
  redis: 'database',
  docker: 'deployed_code',
  python: 'code',
  java: 'coffee',
  mysql: 'database',
  mongod: 'database',
};

export function systemProcessesToProcesses(procs: SystemProcess[]): Process[] {
  return procs.map((p, i) => {
    const baseName = p.name.split(/[-_.]/)[0].toLowerCase();
    const statusMap: Record<string, Process['status']> = {
      running: 'RUNNING',
      sleeping: 'IDLE',
      stopped: 'STOPPED',
      zombie: 'STOPPED',
    };

    return {
      id: String(i + 1),
      name: p.name,
      icon: iconMap[baseName] || 'terminal',
      pid: String(p.pid),
      cpu: p.cpu.toFixed(1),
      cpuHighlight: p.cpu >= 15,
      memory: p.memory,
      status: statusMap[p.status] || 'RUNNING',
    };
  });
}
