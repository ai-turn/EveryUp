// Infra domain types — used across features/, hooks/, and utils/

export interface Resource {
  id: string;
  name: string;
  type: 'server' | 'database' | 'container';
  status: 'healthy' | 'warning' | 'critical' | 'error';
  cluster: string;
  ip: string;
  isActive?: boolean;
  isRemote?: boolean;
  sshPort?: number;
}

export interface GaugeData {
  label: string;
  percentage: number;
  color: string;
  subtitle: string;
  trend: string;
  trendType: 'up' | 'down' | 'stable';
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartData {
  title: string;
  unit: string;
  yMax?: number;
  data: Record<string, number | string>[];
  series: ChartSeries[];
}

export interface Process {
  id: string;
  name: string;
  icon: string;
  pid: string;
  cpu: string;
  cpuHighlight: boolean;
  memory: string;
  status: 'RUNNING' | 'IDLE' | 'STOPPED';
}
