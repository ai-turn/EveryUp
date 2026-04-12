import { incidentColorClasses } from '../design-tokens/colors';

/**
 * Visual configuration for error log levels
 *
 * Maps error severity levels to their Tailwind CSS class styling.
 * Used for styling error log badges and alerts.
 *
 * @example
 * <span className={errorLevelConfig[log.level]}>
 *   {log.level}
 * </span>
 */
export const errorLevelConfig: Record<'CRITICAL' | 'WARNING' | 'INFO', string> = {
  CRITICAL: `${incidentColorClasses.error.icon} ${incidentColorClasses.error.bg} ${incidentColorClasses.error.border}`,
  WARNING: `${incidentColorClasses.warning.icon} ${incidentColorClasses.warning.bg} ${incidentColorClasses.warning.border}`,
  INFO: `${incidentColorClasses.info.icon} ${incidentColorClasses.info.bg} ${incidentColorClasses.info.border}`,
} as const;
