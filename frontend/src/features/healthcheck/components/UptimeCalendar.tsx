import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { api, UptimeData } from '../../../services/api';

interface UptimeCalendarProps {
  serviceId: string;
  refreshKey?: number;
}

export function UptimeCalendar({ serviceId, refreshKey }: UptimeCalendarProps) {
  const { t } = useTranslate();
  const { t: tc } = useTranslation('common');
  const [uptimeData, setUptimeData] = useState<UptimeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUptime = async () => {
      try {
        const data = await api.getServiceUptime(serviceId, { days: '90' });
        setUptimeData(data);
      } catch (err) {
        console.error('Failed to fetch uptime:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUptime();
  }, [serviceId, refreshKey]);

  // Generate health grid from uptime days
  const healthGrid = useMemo(() => {
    if (!uptimeData?.days) {
      // Return empty grid while loading
      return Array.from({ length: 90 }, () => ({ status: 'up' as const, uptime: 100 }));
    }

    // Pad to 90 days if needed
    const days = [...uptimeData.days];
    while (days.length < 90) {
      days.unshift({ date: '', status: 'up', uptime: 100 });
    }

    return days.slice(-90);
  }, [uptimeData]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!uptimeData) {
      return {
        percentage: '-',
        uptime: '-',
        totalIncidents: 0,
      };
    }

    const incidentDays = healthGrid.filter((d) => d.status === 'down' || d.status === 'partial').length;

    return {
      percentage: `${uptimeData.percentage.toFixed(2)}%`,
      uptime: `${uptimeData.percentage.toFixed(2)}%`,
      totalIncidents: incidentDays,
    };
  }, [uptimeData, healthGrid]);

  const getStatusColor = (status: 'up' | 'down' | 'partial') => {
    switch (status) {
      case 'up':
        return 'bg-green-500/80';
      case 'down':
        return 'bg-red-500';
      case 'partial':
        return 'bg-amber-500';
      default:
        return 'bg-slate-300';
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg animate-pulse">
        <div className="h-6 bg-slate-200 dark:bg-ui-active-dark rounded w-32 mb-6" />
        <div className="grid grid-cols-[repeat(30,1fr)] gap-1 mb-4">
          {Array.from({ length: 90 }).map((_, i) => (
            <div key={i} className="h-3 rounded-[1px] bg-slate-200 dark:bg-ui-active-dark" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-full" />
          <div className="h-4 bg-slate-200 dark:bg-ui-active-dark rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-chart-bg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-slate-900 dark:text-white text-lg font-bold tracking-tight">
          {t('헬스체크 상태')}
        </h2>
        <span className="text-green-500 text-sm font-bold">{stats.percentage}</span>
      </div>

      {/* Health Grid */}
      <div className="overflow-x-auto mb-4">
        <div className="grid grid-cols-[repeat(30,minmax(8px,1fr))] gap-1 min-w-70">
          {healthGrid.map((day, index) => (
            <div
              key={index}
              className={`h-3 rounded-[1px] ${getStatusColor(day.status)}`}
              title={day.uptime !== undefined ? `${day.uptime.toFixed(1)}%` : ''}
            />
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="flex justify-between text-slate-400 dark:text-text-chart-dim text-xs font-bold uppercase tracking-wider mb-6">
        <span>{tc('common.daysAgo', { count: 90 })}</span>
        <span>{tc('common.today')}</span>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-text-muted-dark">{t('가동률')}</span>
          <span className="text-slate-900 dark:text-white font-medium">{stats.uptime}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-text-muted-dark">
            {t('총 인시던트')}
          </span>
          <span className="text-slate-900 dark:text-white font-medium">{stats.totalIncidents}</span>
        </div>
      </div>
    </div>
  );
}
