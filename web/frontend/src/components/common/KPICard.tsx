interface KPICardProps {
    label: string;
    value: string | number;
    subValue?: string;
    color: 'primary' | 'red' | 'emerald' | 'amber';
    onClick?: () => void;
}

const colorConfig = {
    primary: {
        valueText: 'text-primary',
        cardBg: 'bg-white dark:bg-bg-surface-dark border-slate-300 dark:border-ui-border-dark',
    },
    red: {
        valueText: 'text-red-600 dark:text-red-400',
        cardBg: 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40',
    },
    emerald: {
        valueText: 'text-emerald-600 dark:text-emerald-400',
        cardBg: 'bg-white dark:bg-bg-surface-dark border-slate-300 dark:border-ui-border-dark',
    },
    amber: {
        valueText: 'text-amber-600 dark:text-amber-400',
        cardBg: 'bg-white dark:bg-bg-surface-dark border-slate-300 dark:border-ui-border-dark',
    },
};

export function KPICard({ label, value, subValue, color, onClick }: KPICardProps) {
    const config = colorConfig[color] || colorConfig.primary;
    const isClickable = !!onClick;

    return (
        <div
            onClick={onClick}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
            role={isClickable ? 'button' : undefined}
            className={[
                'border rounded-xl p-5 transition-all duration-150',
                config.cardBg,
                isClickable
                    ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2'
                    : '',
            ].join(' ')}
        >
            {/* Label */}
            <p className="text-sm font-medium text-slate-500 dark:text-text-muted-dark leading-tight mb-4">{label}</p>

            {/* Value */}
            <p className={`text-3xl font-bold leading-none tabular-nums ${config.valueText}`}>{value}</p>

            {/* SubValue — always neutral */}
            {subValue && (
                <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-2">{subValue}</p>
            )}
        </div>
    );
}
