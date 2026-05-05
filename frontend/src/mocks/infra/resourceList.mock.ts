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
    },
];
