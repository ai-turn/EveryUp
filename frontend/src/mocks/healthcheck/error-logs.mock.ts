/**
 * Mock data for error logs
 * Used by: ErrorLogTable component
 */

export interface ErrorLog {
  id: number;
  timestamp: string;
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
}

export const mockErrorLogs: ErrorLog[] = [
  {
    id: 1,
    timestamp: '2023-10-24 16:42:01',
    level: 'CRITICAL',
    message: 'Connection timeout to db.primary_cluster:5432',
  },
  {
    id: 2,
    timestamp: '2023-10-24 16:38:12',
    level: 'WARNING',
    message: "Rate limit exceeded for client: 'stripe_sync_worker'",
  },
  {
    id: 3,
    timestamp: '2023-10-24 15:55:44',
    level: 'WARNING',
    message: "Unrecognized webhook payload: source 'legacy_gateway'",
  },
  {
    id: 4,
    timestamp: '2023-10-24 15:12:09',
    level: 'CRITICAL',
    message: 'Out of memory in worker thread #4 (Heap Limit Exceeded)',
  },
];
