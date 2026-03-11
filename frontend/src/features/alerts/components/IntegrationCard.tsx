import { useState } from 'react';
import { MaterialIcon } from '../../../components/common';
import { Toggle } from '../../../components/common/Toggle';

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  status: 'Connected' | 'Enabled' | 'Not Connected';
  statusColor: string;
  enabled: boolean;
  children?: React.ReactNode;
  backgroundIcon: string;
}

export function IntegrationCard({
  name,
  description,
  icon,
  iconBg,
  iconColor,
  status,
  statusColor,
  enabled: initialEnabled,
  children,
  backgroundIcon,
}: IntegrationCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);

  return (
    <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 rounded-xl bg-white dark:bg-bg-surface-dark/50 border border-slate-200 dark:border-ui-border-dark p-6 shadow-sm">
      <div className="flex flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex gap-4">
            <div
              className={`size-12 rounded-lg ${iconBg} flex items-center justify-center ${iconColor} border border-current/20`}
            >
              <MaterialIcon name={icon} className="text-3xl" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <p className="text-slate-900 dark:text-white text-lg font-bold">{name}</p>
                <span
                  className={`px-2 py-0.5 rounded ${statusColor} text-xs font-bold uppercase tracking-wider`}
                >
                  {status}
                </span>
              </div>
              <p className="text-slate-500 dark:text-text-muted-dark text-sm font-normal">{description}</p>
            </div>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>

        {/* Content */}
        {children}
      </div>

      {/* Background Pattern */}
      <div className="hidden md:block w-48 bg-slate-100 dark:bg-ui-hover-dark rounded-lg border border-dashed border-slate-300 dark:border-ui-border-dark relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <MaterialIcon name={backgroundIcon} className="text-[80px]" />
        </div>
      </div>
    </div>
  );
}
