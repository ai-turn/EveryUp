import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api, Service } from '../../../services/api';

// Helper functions to convert between UI state and cron expression
function cronToScheduledParams(cronExpr: string | undefined): {
    scheduledType: 'daily' | 'weekly';
    scheduledHour: number;
    scheduledMinute: number;
    scheduledWeekday: number;
} {
    if (!cronExpr) return { scheduledType: 'daily', scheduledHour: 9, scheduledMinute: 0, scheduledWeekday: 1 };
    const weeklyMatch = cronExpr.match(/^(\d+) (\d+) \* \* ([0-6])$/);
    if (weeklyMatch) {
        return {
            scheduledType: 'weekly',
            scheduledMinute: parseInt(weeklyMatch[1]),
            scheduledHour: parseInt(weeklyMatch[2]),
            scheduledWeekday: parseInt(weeklyMatch[3]),
        };
    }
    const dailyMatch = cronExpr.match(/^(\d+) (\d+) \* \* \*$/);
    if (dailyMatch) {
        return {
            scheduledType: 'daily',
            scheduledMinute: parseInt(dailyMatch[1]),
            scheduledHour: parseInt(dailyMatch[2]),
            scheduledWeekday: 1,
        };
    }
    return { scheduledType: 'daily', scheduledHour: 9, scheduledMinute: 0, scheduledWeekday: 1 };
}

function scheduledToCron(type: 'daily' | 'weekly', hour: number, minute: number, weekday: number): string {
    if (type === 'daily') {
        return `${minute} ${hour} * * *`;
    }
    return `${minute} ${hour} * * ${weekday}`;
}

const serviceSchema = z.object({
    id: z.string().min(2, 'ID is too short').regex(/^[a-z0-9-]+$/, 'Lower case letters, numbers, and hyphens only'),
    name: z.string().min(2, 'Name is too short'),
    type: z.enum(['http', 'tcp']),
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.coerce.number().optional(),
    scheduleType: z.enum(['interval', 'cron']),
    interval: z.coerce.number().min(5, 'Minimum interval is 5s'),
    cronExpression: z.string().optional(),
    timeout: z.coerce.number().min(500, 'Minimum timeout is 500ms'),
}).refine(data => {
    if (data.type === 'http' && (!data.url || data.url.trim() === '')) return false;
    if (data.type === 'tcp' && !data.host && !data.url) return false;
    return true;
}, {
    message: 'URL or Host is required',
    path: ['url'],
}).refine(data => {
    if (data.scheduleType === 'cron' && !data.cronExpression) return false;
    return true;
}, {
    message: 'Cron expression is required',
    path: ['cronExpression'],
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface HealthCheckFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    service?: Service;
    onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function HealthCheckForm({ onSuccess, service, onSubmittingChange }: HealthCheckFormProps) {
    const { t } = useTranslation(['healthcheck', 'common']);
    const isEditMode = !!service;

    const [scheduledType, setScheduledType] = useState<'daily' | 'weekly'>('daily');
    const [scheduledHour, setScheduledHour] = useState(9);
    const [scheduledMinute, setScheduledMinute] = useState(0);
    const [scheduledWeekday, setScheduledWeekday] = useState(1);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<ServiceFormValues>({
        resolver: zodResolver(serviceSchema) as any,
        defaultValues: {
            type: 'http',
            scheduleType: 'interval',
            interval: 30,
            timeout: 5000,
        },
    });

    const selectedType = watch('type');
    const scheduleType = watch('scheduleType');
    const watchedName = watch('name');
    const watchedId = watch('id');
    const watchedUrl = watch('url');
    const watchedHost = watch('host');
    const watchedPort = watch('port');
    const watchedInterval = watch('interval');
    const watchedTimeout = watch('timeout');

    useEffect(() => {
        onSubmittingChange?.(isSubmitting);
    }, [isSubmitting, onSubmittingChange]);

    useEffect(() => {
        if (service) {
            reset({
                id: service.id,
                name: service.name,
                type: service.type as 'http' | 'tcp',
                url: service.url || '',
                host: service.host || '',
                port: service.port || undefined,
                scheduleType: service.scheduleType || 'interval',
                interval: service.interval,
                cronExpression: service.cronExpression || '',
                timeout: service.timeout,
            });

            if (service.scheduleType === 'cron' && service.cronExpression) {
                const params = cronToScheduledParams(service.cronExpression);
                setScheduledType(params.scheduledType);
                setScheduledHour(params.scheduledHour);
                setScheduledMinute(params.scheduledMinute);
                setScheduledWeekday(params.scheduledWeekday);
            }
        } else {
            reset({
                id: '',
                name: '',
                type: 'http',
                url: '',
                host: '',
                port: undefined,
                scheduleType: 'interval',
                interval: 30,
                cronExpression: '',
                timeout: 5000,
            });
            setScheduledType('daily');
            setScheduledHour(9);
            setScheduledMinute(0);
            setScheduledWeekday(1);
        }
    }, [service, reset]);

    const onSubmit = async (data: ServiceFormValues): Promise<void> => {
        try {
            const submitData = { ...data };
            if (submitData.scheduleType === 'cron') {
                submitData.cronExpression = scheduledToCron(scheduledType, scheduledHour, scheduledMinute, scheduledWeekday);
            }

            if (isEditMode && service) {
                await api.updateService(service.id, submitData);
                toast.success(t('healthcheck.toast.updated'));
            } else {
                await api.createService(submitData);
                toast.success(t('healthcheck.toast.created'));
            }
            onSuccess();
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const getInputClassName = (hasError: boolean) =>
        `w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`;

    const weekdays = [
        t('healthcheck.weekdays.sun'),
        t('healthcheck.weekdays.mon'),
        t('healthcheck.weekdays.tue'),
        t('healthcheck.weekdays.wed'),
        t('healthcheck.weekdays.thu'),
        t('healthcheck.weekdays.fri'),
        t('healthcheck.weekdays.sat'),
    ];

    const cronPreviewText = scheduledType === 'daily'
        ? t('healthcheck.form.cronDailyPreview', { hour: scheduledHour.toString().padStart(2, '0'), minute: scheduledMinute.toString().padStart(2, '0') })
        : t('healthcheck.form.cronWeeklyPreview', { day: weekdays[scheduledWeekday], hour: scheduledHour.toString().padStart(2, '0'), minute: scheduledMinute.toString().padStart(2, '0') });

    return (
        <>
        <form
            id="healthcheck-form"
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-6 min-h-full"
        >
        <div className="max-w-350 mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <div className="space-y-6 min-w-0">
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="info" className="text-primary text-base" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-text-base-dark">{t('healthcheck.form.basicInfo')}</h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('healthcheck.form.basicInfoDesc')}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.id')}</label>
                    <input
                        {...register('id')}
                        placeholder="my-api-server"
                        disabled={isEditMode}
                        className={`${getInputClassName(!!errors.id)} ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {errors.id ? (
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.id.message}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                            <MaterialIcon name="info" className="text-sm" />
                            {isEditMode ? t('healthcheck.form.idCannotChange') : t('healthcheck.form.idHint')}
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.name')}</label>
                    <input
                        {...register('name')}
                        placeholder={t('healthcheck.form.namePlaceholder')}
                        className={getInputClassName(!!errors.name)}
                    />
                    {errors.name && (
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.name.message}
                        </p>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="settings_ethernet" className="text-primary text-base" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-text-base-dark">{t('healthcheck.form.connection')}</h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('healthcheck.form.connectionDesc')}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.type')}</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${selectedType === 'http' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('type')} type="radio" value="http" className="hidden" />
                            <MaterialIcon name="api" className="text-lg" />
                            HTTP
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${selectedType === 'tcp' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('type')} type="radio" value="tcp" className="hidden" />
                            <MaterialIcon name="dns" className="text-lg" />
                            TCP
                        </label>
                    </div>
                </div>

                {selectedType === 'http' ? (
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">URL</label>
                        <input
                            {...register('url')}
                            placeholder="https://api.example.com/health"
                            className={getInputClassName(!!errors.url)}
                        />
                        {errors.url && (
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                <MaterialIcon name="error" className="text-sm" />
                                {errors.url.message}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Host</label>
                            <input
                                {...register('host')}
                                placeholder="8.8.8.8"
                                className={getInputClassName(!!errors.host || !!errors.url)}
                            />
                            {errors.url && (
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.url.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('healthcheck.form.port')}</label>
                            <input
                                {...register('port', { valueAsNumber: true })}
                                type="number"
                                placeholder="53"
                                className={getInputClassName(!!errors.port)}
                            />
                            {errors.port && (
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.port.message}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="schedule" className="text-primary text-base" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-text-base-dark">{t('healthcheck.form.schedule')}</h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('healthcheck.form.scheduleDesc')}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('healthcheck.form.scheduleType')}</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${scheduleType === 'interval' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('scheduleType')} type="radio" value="interval" className="hidden" />
                            <MaterialIcon name="schedule" className="text-lg" />
                            {t('healthcheck.form.interval')}
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${scheduleType === 'cron' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('scheduleType')} type="radio" value="cron" className="hidden" />
                            <MaterialIcon name="calendar_month" className="text-lg" />
                            {t('healthcheck.form.cron')}
                        </label>
                    </div>
                </div>

                {scheduleType === 'interval' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('healthcheck.form.checkInterval')} (s)</label>
                            <input
                                {...register('interval', { valueAsNumber: true })}
                                type="number"
                                className={getInputClassName(!!errors.interval)}
                            />
                            {errors.interval && (
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.interval.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('healthcheck.form.timeout')} (ms)</label>
                            <input
                                {...register('timeout', { valueAsNumber: true })}
                                type="number"
                                className={getInputClassName(!!errors.timeout)}
                            />
                            {errors.timeout && (
                                <p className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.timeout.message}
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setScheduledType('daily')}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${scheduledType === 'daily' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}
                            >
                                {t('healthcheck.form.daily')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setScheduledType('weekly')}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${scheduledType === 'weekly' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}
                            >
                                {t('healthcheck.form.weekly')}
                            </button>
                        </div>
                        {scheduledType === 'weekly' && (
                            <div className="flex flex-wrap gap-1">
                                {weekdays.map((day, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setScheduledWeekday(idx)}
                                        className={`px-2 py-1 rounded text-sm font-bold transition-all ${scheduledWeekday === idx ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-ui-active-dark text-slate-500'}`}
                                    >
                                        {day.substring(0, 3)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={scheduledHour}
                                onChange={(e) => setScheduledHour(parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm text-center font-mono"
                                min="0" max="23"
                            />
                            <span className="font-bold">:</span>
                            <input
                                type="number"
                                value={scheduledMinute}
                                onChange={(e) => setScheduledMinute(parseInt(e.target.value) || 0)}
                                className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm text-center font-mono"
                                min="0" max="59"
                            />
                        </div>
                        <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-sm text-primary font-medium">
                            {cronPreviewText}
                        </div>
                    </div>
                )}
            </div>
        </div>

        </div>

        <aside className="xl:sticky xl:top-6 space-y-4">
            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name={selectedType === 'http' ? 'api' : 'dns'} className="text-primary text-xl" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {watchedName || t('healthcheck.form.namePlaceholder')}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark truncate">
                            {watchedId || 'my-api-server'}
                        </p>
                    </div>
                </div>
                <div className="space-y-2">
                    <SummaryRow label={t('common.type')} value={selectedType?.toUpperCase() || 'HTTP'} />
                    <SummaryRow
                        label={selectedType === 'http' ? 'URL' : 'Host'}
                        value={selectedType === 'http' ? (watchedUrl || '-') : `${watchedHost || '-'}${watchedPort ? `:${watchedPort}` : ''}`}
                    />
                    <SummaryRow
                        label={t('healthcheck.form.summarySchedule')}
                        value={scheduleType === 'interval' ? `${watchedInterval || 30}s` : cronPreviewText}
                    />
                    <SummaryRow label={t('healthcheck.form.timeout')} value={`${watchedTimeout || 5000}ms`} />
                </div>
            </div>

            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                    <MaterialIcon name="tips_and_updates" className="text-lg text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('healthcheck.form.configTitle')}</h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-text-muted-dark leading-relaxed">
                    {selectedType === 'http'
                        ? t('healthcheck.form.httpConfigDesc')
                        : t('healthcheck.form.tcpConfigDesc')}
                </p>
            </div>
        </aside>

        </div>
        </form>
        </>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 dark:border-ui-border-dark/50 last:border-0">
            <span className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-text-muted-dark">{label}</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-text-base-dark truncate">{value}</span>
        </div>
    );
}

