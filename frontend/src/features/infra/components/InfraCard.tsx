import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon, StatusBadge } from '../../../components/common';
import { relativeTime } from '../../../utils/formatters';
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

const typeBadgeColors: Record<Resource['type'], string> = {
    server: 'bg-slate-100 dark:bg-ui-hover-dark text-slate-600 dark:text-text-muted-dark',
    database: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    container: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
};

export const InfraCard = memo(function InfraCard({ resource, onClick }: InfraCardProps) {
    const { t } = useTranslation(['infra', 'common']);
    const isPaused = resource.isActive === false;
    const healthScore = getHealthScore(resource);
    const relativeTimeLabels = {
        justNow: t('common.relativeTime.justNow'),
        minutesAgo: (count: number) => t('common.relativeTime.minutesAgo', { count }),
        hoursAgo: (count: number) => t('common.relativeTime.hoursAgo', { count }),
        daysAgo: (count: number) => t('common.relativeTime.daysAgo', { count }),
    };
    const statusTone = resource.status === 'healthy'
        ? 'bg-emerald-500'
        : resource.status === 'warning' || resource.status === 'unknown'
            ? 'bg-amber-500'
            : resource.status === 'paused'
                ? 'bg-slate-400'
                : 'bg-red-500';

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
                <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-ui-hover-dark flex items-center justify-center">
                        <MaterialIcon
                            name={typeIcons[resource.type]}
                            className="text-xl text-primary"
                        />
                    </div>
                    <span className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-bg-surface-dark ${statusTone}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                            {resource.name}
                        </h3>
                        {isPaused && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                {t('infra.paused')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5 truncate">
                        {resource.cluster || t('common.unknown')} - {resource.ip}
                        {resource.isRemote && resource.sshPort ? `:${resource.sshPort}` : ''}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
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

            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-slate-50 dark:bg-ui-hover-dark/40 border border-slate-100 dark:border-ui-border-dark/50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                        {t('common.type')}
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-text-base-dark truncate">
                        {t(`infra.resourceTypes.${resource.type}`)}
                    </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-ui-hover-dark/40 border border-slate-100 dark:border-ui-border-dark/50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                        {t('infra.connection')}
                    </div>
                    <div className="text-sm font-bold text-slate-800 dark:text-text-base-dark truncate">
                        {resource.isRemote ? t('infra.connectionTypes.sshRemote') : t('infra.connectionTypes.local')}
                    </div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-ui-hover-dark/40 border border-slate-100 dark:border-ui-border-dark/50 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">
                        {t('infra.metrics.score')}
                    </div>
                    <div className={`text-sm font-bold truncate ${healthScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isPaused ? '-' : healthScore}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-ui-border-dark/50">
                <span className="text-xs text-slate-500 dark:text-text-muted-dark min-w-0 truncate">
                    {t('infra.remote.lastCollected')}: {resource.lastCollectedAt ? relativeTime(resource.lastCollectedAt, relativeTimeLabels) : '-'}
                </span>
                <div className="flex items-center gap-1.5">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${typeBadgeColors[resource.type]}`}>
                        <MaterialIcon name={typeIcons[resource.type]} className="text-xs" />
                        {t(`infra.resourceTypes.${resource.type}`)}
                    </span>
                    {resource.isRemote ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <MaterialIcon name="key" className="text-xs" />
                            SSH
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <MaterialIcon name="computer" className="text-xs" />
                            {t('infra.connectionTypes.localShort')}
                        </span>
                    )}
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

function getHealthScore(resource: Resource) {
    const cpu = resource.cpuUsage ?? 0;
    const mem = resource.memoryUsage ?? 0;
    const disk = resource.diskUsage ?? 0;
    const statusPenalty = resource.severity === 'critical' ? 22 : resource.severity === 'warning' ? 10 : 0;
    return Math.max(0, Math.min(100, Math.round(100 - Math.max(0, cpu - 60) * 0.35 - Math.max(0, mem - 70) * 0.35 - Math.max(0, disk - 75) * 0.3 - statusPenalty)));
}
