import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { Sparkline } from '../../../components/common/Sparkline';
import { relativeTime } from '../../../utils/formatters';
import { formatThroughput } from '../../../utils/systemTransform';
import type { Resource } from '../../../types/infra';

interface InfraCardProps {
    resource: Resource;
    onClick: () => void;
}

const typeIcons: Record<Resource['type'], string> = {
    server: 'dns',
    database: 'storage',
    container: 'deployed_code',
};

const mutedBadgeClass = 'bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark';

export const InfraCard = memo(function InfraCard({ resource, onClick }: InfraCardProps) {
    const { t } = useTranslation(['infra', 'common']);
    const isPaused = resource.isActive === false;
    const netTrend = resource.netTrend ?? [];
    const netCurrent = formatThroughput(netTrend[netTrend.length - 1] ?? 0);
    const relativeTimeLabels = {
        justNow: t('common.relativeTime.justNow'),
        minutesAgo: (count: number) => t('common.relativeTime.minutesAgo', { count }),
        hoursAgo: (count: number) => t('common.relativeTime.hoursAgo', { count }),
        daysAgo: (count: number) => t('common.relativeTime.daysAgo', { count }),
    };

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
            className={`p-4 rounded-xl border bg-white dark:bg-bg-surface-dark hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer transition-all duration-150 flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 ${
                isPaused ? 'border-amber-200 dark:border-amber-900/50 opacity-80' : 'border-slate-200 dark:border-ui-border-dark'
            }`}
        >
            <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center shrink-0">
                    <MaterialIcon
                        name={typeIcons[resource.type]}
                        className="text-xl text-primary"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                        {resource.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
                        {resource.cluster || t('common.unknown')} - {resource.ip}
                        {resource.isRemote && resource.sshPort ? `:${resource.sshPort}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {isPaused && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            {t('infra.paused')}
                        </span>
                    )}
                    <StatusBadge status={resource.status} />
                </div>
            </div>

            <div className="space-y-2 mb-3">
                <MiniMetricBar
                    label="CPU"
                    value={resource.cpuUsage}
                    muted={isPaused}
                />
                <MiniMetricBar
                    label={t('infra.metrics.memory')}
                    value={resource.memoryUsage}
                    muted={isPaused}
                />
                <MiniMetricBar
                    label={t('infra.metrics.disk')}
                    value={resource.diskUsage}
                    muted={isPaused}
                />
            </div>

            <div className={`mb-3 ${isPaused ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-text-muted-dark">
                        {t('infra.metrics.network')}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-text-base-dark">
                        {netTrend.length > 0 ? `${netCurrent.value} ${netCurrent.unit}` : '-'}
                    </span>
                </div>
                {netTrend.length >= 2 ? (
                    <Sparkline data={netTrend} height={28} color="#10b981" fluid />
                ) : (
                    <div className="h-7 flex items-center text-[11px] text-slate-400 dark:text-text-dim-dark">
                        {t('infra.metrics.noData')}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
                <span className="text-xs text-slate-500 dark:text-text-muted-dark min-w-0 truncate">
                    {t('infra.remote.lastCollected')}: {resource.lastCollectedAt ? relativeTime(resource.lastCollectedAt, relativeTimeLabels) : '-'}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${mutedBadgeClass}`}>
                        <MaterialIcon name={typeIcons[resource.type]} className="text-xs" />
                        {t(`infra.resourceTypes.${resource.type}`)}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${mutedBadgeClass}`}>
                        <MaterialIcon name={resource.isRemote ? 'key' : 'computer'} className="text-xs" />
                        {resource.isRemote ? 'SSH' : t('infra.connectionTypes.localShort')}
                    </span>
                </div>
            </div>
        </div>
    );
});

function MiniMetricBar({ label, value, muted }: { label: string; value?: number; muted: boolean }) {
    const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
    const tone = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-primary';

    return (
        <div className={muted ? 'opacity-40' : undefined}>
            <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-text-muted-dark">{label}</span>
                <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-text-base-dark">
                    {value === undefined ? '-' : `${pct}%`}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-ui-hover-dark overflow-hidden">
                <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: value === undefined ? '0%' : `${pct}%` }} />
            </div>
        </div>
    );
}
