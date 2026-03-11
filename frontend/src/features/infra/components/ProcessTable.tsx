import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { useMonitoringProcesses } from '../../../hooks/useData';
import { processStatusConfig } from '../../../mocks/configs';
import { TableSkeleton } from '../../../components/skeleton';

interface ProcessTableProps {
  hostId: string;
}

export function ProcessTable({ hostId }: ProcessTableProps) {
  const { t } = useTranslation();
  const { data: processes, loading } = useMonitoringProcesses(hostId);

  if (loading) {
    return <TableSkeleton rows={4} columns={6} />;
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">
          {t('monitoring.processes.title')}
        </h2>
        <button className="text-primary text-sm font-bold hover:underline">
          {t('monitoring.processes.viewAll')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-chart-border bg-white dark:bg-bg-surface-dark/30">
        <table className="w-full min-w-120 text-left">
          <thead className="bg-slate-50 dark:bg-chart-surface/50 border-b border-slate-200 dark:border-chart-border">
            <tr>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                {t('monitoring.processes.name')}
              </th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                {t('monitoring.processes.pid')}
              </th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                {t('monitoring.processes.cpu')}
              </th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                {t('monitoring.processes.memory')}
              </th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider">
                {t('monitoring.processes.status')}
              </th>
              <th className="px-3 py-3 sm:px-5 sm:py-4 text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wider text-right">
                {t('monitoring.processes.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-chart-border">
            {(processes || []).map((process) => (
              <tr
                key={process.id}
                className="hover:bg-slate-50 dark:hover:bg-primary/5 transition-colors"
              >
                <td className="px-3 py-3 sm:px-5 sm:py-4 flex items-center gap-2">
                  <MaterialIcon name={process.icon} className="text-primary" />
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {process.name}
                  </span>
                </td>
                <td className="px-3 py-3 sm:px-5 sm:py-4 font-mono text-sm text-slate-500 dark:text-text-muted-dark tabular-nums">
                  {process.pid}
                </td>
                <td
                  className={`px-3 py-3 sm:px-5 sm:py-4 font-bold tabular-nums ${process.cpuHighlight
                    ? 'text-lime-500 dark:text-lime-400'
                    : 'text-slate-900 dark:text-white'
                    }`}
                >
                  {process.cpu}
                </td>
                <td className="px-3 py-3 sm:px-5 sm:py-4 font-mono text-slate-900 dark:text-white tabular-nums">
                  {process.memory}
                </td>
                <td className="px-3 py-3 sm:px-5 sm:py-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${processStatusConfig[process.status]}`}
                  >
                    {process.status}
                  </span>
                </td>
                <td className="px-3 py-3 sm:px-5 sm:py-4 text-right">
                  <button className="text-red-400 hover:text-red-500 font-bold text-xs uppercase">
                    {t('monitoring.processes.terminate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
