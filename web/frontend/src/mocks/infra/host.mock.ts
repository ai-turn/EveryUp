import type { Host } from '../../services/api';

export const mockHost: Host = {
  id: 'api-server-01',
  name: 'API-Server-01',
  type: 'remote',
  resourceCategory: 'server',
  ip: '192.168.1.50',
  group: 'EU-West-1',
  isActive: true,
  status: 'online',
  sshUser: 'ubuntu',
  sshPort: 22,
  sshAuthType: 'key',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};
