/**
 * Mock data for uptime statistics
 * Used by: UptimeCalendar component
 */

export interface UptimeStats {
  uptime: string;
  totalIncidents: number;
  mttr: string;
  percentage: string;
}

export const mockUptimeStats: UptimeStats = {
  uptime: '2,160h 42m',
  totalIncidents: 2,
  mttr: '4m 12s',
  percentage: '99.98%',
};
