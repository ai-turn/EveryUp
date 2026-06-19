import type { Incident } from '../types/common';
import { incidentColorClasses } from '../design-tokens/colors';

/**
 * Visual configuration for incident types
 *
 * Maps incident severity levels to their icon and color representation.
 * Used by components displaying incident information.
 *
 * @example
 * const config = incidentTypeConfig[incident.type];
 * <Icon name={config.icon} className={config.colorClasses.icon} />
 */
export const incidentTypeConfig: Record<
  Incident['type'],
  { icon: string; colorClasses: typeof incidentColorClasses[keyof typeof incidentColorClasses] }
> = {
  error: { icon: 'error', colorClasses: incidentColorClasses.error },
  warning: { icon: 'warning', colorClasses: incidentColorClasses.warning },
  success: { icon: 'check_circle', colorClasses: incidentColorClasses.success },
  info: { icon: 'info', colorClasses: incidentColorClasses.info },
} as const;
