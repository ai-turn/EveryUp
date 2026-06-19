import type { Process } from '../../types/infra';

export type { Process };

export const mockProcesses: Process[] = [
  {
    id: '1',
    name: 'postgresql-main',
    icon: 'terminal',
    pid: '28441',
    cpu: '18.4%',
    cpuHighlight: true,
    memory: '1.2 GB',
    status: 'RUNNING',
  },
  {
    id: '2',
    name: 'node-server-worker',
    icon: 'deployed_code',
    pid: '12903',
    cpu: '12.1%',
    cpuHighlight: false,
    memory: '842 MB',
    status: 'RUNNING',
  },
  {
    id: '3',
    name: 'system-auth-daemon',
    icon: 'security',
    pid: '00421',
    cpu: '4.2%',
    cpuHighlight: false,
    memory: '120 MB',
    status: 'IDLE',
  },
  {
    id: '4',
    name: 'nginx-loadbalancer',
    icon: 'language',
    pid: '15220',
    cpu: '2.8%',
    cpuHighlight: false,
    memory: '256 MB',
    status: 'RUNNING',
  },
];
