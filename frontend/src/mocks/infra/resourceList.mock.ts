import type { Resource } from '../../types/infra';

export type { Resource };

export const mockResources: Resource[] = [
    {
        id: 'prod-db-01',
        name: 'Production-DB-01',
        type: 'database',
        status: 'healthy',
        cluster: 'EU-West-1',
        ip: '192.168.1.45',
        cpuUsage: 42,
        memoryUsage: 51,
        diskUsage: 38,
        netTrend: [0.012, 0.018, 0.009, 0.024, 0.015, 0.031, 0.02, 0.014, 0.028, 0.017, 0.022, 0.013],
    },
    {
        id: 'api-server-01',
        name: 'API-Server-01',
        type: 'server',
        status: 'healthy',
        cluster: 'EU-West-1',
        ip: '192.168.1.50',
        cpuUsage: 49,
        memoryUsage: 57,
        diskUsage: 43,
        netTrend: [0.045, 0.06, 0.038, 0.072, 0.05, 0.088, 0.065, 0.041, 0.079, 0.055, 0.068, 0.049],
    },
    {
        id: 'cache-redis-01',
        name: 'Cache-Redis-01',
        type: 'container',
        status: 'warning',
        cluster: 'US-East-1',
        ip: '192.168.2.10',
        cpuUsage: 56,
        memoryUsage: 83,
        diskUsage: 48,
        netTrend: [0.08, 0.11, 0.06, 0.14, 0.09, 0.17, 0.12, 0.07, 0.15, 0.1, 0.13, 0.085],
    },
    {
        id: 'worker-node-01',
        name: 'Worker-Node-01',
        type: 'server',
        status: 'critical',
        cluster: 'US-East-1',
        ip: '192.168.2.20',
        cpuUsage: 91,
        memoryUsage: 69,
        diskUsage: 53,
        netTrend: [0.21, 0.28, 0.16, 0.34, 0.23, 0.41, 0.3, 0.18, 0.37, 0.25, 0.32, 0.2],
    },
];
