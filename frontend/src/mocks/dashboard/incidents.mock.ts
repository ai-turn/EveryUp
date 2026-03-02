import type { Incident } from '../../types/common';

/**
 * Mock incidents data for dashboard timeline
 * Used by: IncidentTimeline component
 */
export const mockIncidents: Incident[] = [
  {
    id: '1',
    time: '12:45:02 PM',
    type: 'error',
    serviceName: 'Auth Service',
    message: 'transitioned from Healthy to Degraded',
  },
  {
    id: '2',
    time: '12:12:44 PM',
    type: 'warning',
    serviceName: 'User Database',
    message: 'reporting high connection pool usage (88%)',
  },
  {
    id: '3',
    time: '11:30:15 AM',
    type: 'success',
    serviceName: 'API Gateway',
    message: 'latency stabilized after deployment',
  },
  {
    id: '4',
    time: '10:55:00 AM',
    type: 'info',
    serviceName: 'System',
    message: 'Weekly maintenance scheduled for Saturday 02:00 UTC',
  },
  {
    id: '5',
    time: '09:12:10 AM',
    type: 'success',
    serviceName: 'Redis Cache',
    message: 'successfully scaled to 3 nodes',
  },
];
