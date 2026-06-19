/**
 * Mock data for configuration groups in settings
 * Used by: ConfigurationGroups component
 */

export interface ConfigGroup {
  icon: string;
  label: string;
}

export const mockConfigGroups: ConfigGroup[] = [
  { icon: 'timer', label: 'Intervals & Timeouts' },
  { icon: 'security', label: 'SSL/TLS Legacy Flags' },
  { icon: 'database', label: 'Metadata & Tags' },
];
