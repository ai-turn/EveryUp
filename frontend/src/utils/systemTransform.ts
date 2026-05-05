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
    isRemote: !!host.sshUser,
    sshPort: host.sshPort,
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
export function systemInfoToGauges(info: SystemInfo, history?: SystemMetricsHistory): GaugeData[] {
  const gauges: GaugeData[] = [
    {
      label: 'CPU',
      percentage: info.cpu.usage,
      color: '#137fec',
      subtitle: `${info.cpu.cores} Cores Online`,
      trend: '',
      trendType: 'stable',
    },
    {
      label: 'Memory',
      percentage: info.memory.usage,
      color: '#a3e635',
      subtitle: `${info.memory.used} GB / ${info.memory.total} GB`,
      trend: '',
      trendType: 'stable',
    },
    {
      label: 'Disk',
      percentage: info.disk.usage,
      color: '#f59e0b',
      subtitle: `${info.disk.used} GB / ${info.disk.total} GB`,
      trend: '',
      trendType: 'stable',
    },
  ];

  const latestPoint = history?.points?.at(-1);
  if (latestPoint) {
    const netIn = latestPoint.netIn || 0;
    const netOut = latestPoint.netOut || 0;
    const total = netIn + netOut;

    gauges.push({
      label: 'Network',
      percentage: Math.max(0, Math.min(100, Math.round(total * 4))),
      color: '#10b981',
      subtitle: `In ${netIn.toFixed(1)} MB/s · Out ${netOut.toFixed(1)} MB/s`,
      trend: `${total.toFixed(1)} MB/s`,
      trendType: 'stable',
      displayValue: total.toFixed(1),
      displayUnit: 'MB/s',
    });
  }

  return gauges;
}

// --- SystemMetricsHistory → ChartData[] ---
function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function historyToCharts(history: SystemMetricsHistory): ChartData[] {
  const points = history.points;
  if (!points || points.length === 0) return [];

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

  const diskMax = Math.max(...points.map((p) => Math.max(p.diskRead, p.diskWrite)), 1);
  const networkMax = Math.max(...points.map((p) => Math.max(p.netIn || 0, p.netOut || 0)), 1);

  return [
    {
      title: 'CPU Usage',
      unit: '%',
      yMax: 100,
      data,
      series: [{ key: 'cpu', label: 'Usage', color: '#137fec' }],
    },
    {
      title: 'Memory Flow',
      unit: 'GB',
      data,
      series: [
        { key: 'memUsed',   label: 'Used',   color: '#3b76c9' },
        { key: 'memCached', label: 'Cached', color: '#10b981' },
      ],
    },
    {
      title: 'Disk I/O',
      unit: 'MB/s',
      yMax: parseFloat((diskMax * 1.2).toFixed(2)),
      data,
      series: [
        { key: 'diskRead', label: 'Read', color: '#a3e635' },
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
      cpu: `${p.cpu}%`,
      cpuHighlight: p.cpu >= 15,
      memory: p.memory,
      status: statusMap[p.status] || 'RUNNING',
    };
  });
}
