/**
 * Mock data for notification rules.
 * Used by: useNotificationRules() hook (hooks/useAlerts.ts)
 * TODO: Replace with real API when backend implements notification rules endpoint.
 */

export interface NotificationRule {
  id: string;
  eventType: string;
  description: string;
  icon: string;
  iconColor: string;
  slack: boolean;
  email: boolean;
  pagerduty: boolean;
}

export const mockNotificationRules: NotificationRule[] = [
  {
    id: '1',
    eventType: 'Critical Alert',
    description: 'Service downtime or major failure',
    icon: 'error',
    iconColor: 'text-red-500',
    slack: true,
    email: true,
    pagerduty: true,
  },
  {
    id: '2',
    eventType: 'Warning',
    description: 'Threshold exceeded or latency high',
    icon: 'warning',
    iconColor: 'text-amber-500',
    slack: true,
    email: false,
    pagerduty: false,
  },
  {
    id: '3',
    eventType: 'Recovery',
    description: 'Service back to normal state',
    icon: 'check_circle',
    iconColor: 'text-emerald-500',
    slack: true,
    email: true,
    pagerduty: false,
  },
  {
    id: '4',
    eventType: 'Daily Digest',
    description: 'Summary of service performance',
    icon: 'info',
    iconColor: 'text-blue-500',
    slack: false,
    email: true,
    pagerduty: false,
  },
];
