import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { Service } from '../../../services/api';

interface LogServiceCardProps {
  service: Service;
  onClick?: () => void;
}

export function LogServiceCard({ service, onClick }: LogServiceCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5 hover:border-primary/50 transition-colors ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center">
            <MaterialIcon name="article" className="text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-sm">{service.name}</h3>
            <p className="text-xs text-slate-500">{service.tags?.[0] || 'default'}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark">
          <MaterialIcon name="arrow_forward" className="text-xs" />
          {t('logServices.viewLogs', { defaultValue: 'View Logs' })}
        </span>
      </div>
    </div>
  );
}
