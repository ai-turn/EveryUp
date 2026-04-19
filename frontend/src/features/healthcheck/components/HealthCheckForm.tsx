import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useTranslate } from '@tolgee/react';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api, Service } from '../../../services/api';
import { useSidePanel } from '../../../contexts/SidePanelContext';

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
    service?: Service;
}

export function HealthCheckForm({ onSuccess, service }: HealthCheckFormProps) {
    const { t } = useTranslate();
    const { t: tc } = useTranslation('common');
    const { closePanel } = useSidePanel();
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
                toast.success(t('헬스체크가 업데이트되었습니다'));
            } else {
                await api.createService(submitData);
                toast.success(t('헬스체크가 추가되었습니다'));
            }
            onSuccess();
            closePanel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const getInputClassName = (hasError: boolean) =>
        `w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`;

    const weekdays = [
        t('일'),
        t('월'),
        t('화'),
        t('수'),
        t('목'),
        t('금'),
        t('토'),
    ];

    const cronPreviewText = scheduledType === 'daily'
        ? t('매일 {hour}:{minute}에 체크', { hour: scheduledHour.toString().padStart(2, '0'), minute: scheduledMinute.toString().padStart(2, '0') })
        : t('매주 {day}요일 {hour}:{minute}에 체크', { day: weekdays[scheduledWeekday], hour: scheduledHour.toString().padStart(2, '0'), minute: scheduledMinute.toString().padStart(2, '0') });

    return (
        <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-4 custom-scrollbar">
        <form id="hc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <MaterialIcon name="info" className="text-primary text-lg" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-text-secondary-dark">{t('기본 정보')}</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tc('common.id')}</label>
                    <input
                        {...register('id')}
                        placeholder="my-api-server"
                        disabled={isEditMode}
                        className={`${getInputClassName(!!errors.id)} ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    {errors.id ? (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.id.message}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MaterialIcon name="info" className="text-xs" />
                            {isEditMode ? t('ID는 변경할 수 없습니다') : t('영문 소문자, 숫자, 하이픈(-)만 사용 가능')}
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tc('common.name')}</label>
                    <input
                        {...register('name')}
                        placeholder={t('내 API 서버')}
                        className={getInputClassName(!!errors.name)}
                    />
                    {errors.name && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.name.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <MaterialIcon name="settings_ethernet" className="text-primary text-lg" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-text-secondary-dark">{t('연결 설정')}</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tc('common.type')}</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${selectedType === 'http' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('type')} type="radio" value="http" className="hidden" />
                            <MaterialIcon name="api" className="text-lg" />
                            HTTP
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${selectedType === 'tcp' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('type')} type="radio" value="tcp" className="hidden" />
                            <MaterialIcon name="dns" className="text-lg" />
                            TCP
                        </label>
                    </div>
                </div>

                {selectedType === 'http' ? (
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">URL</label>
                        <input
                            {...register('url')}
                            placeholder="https://api.example.com/health"
                            className={getInputClassName(!!errors.url)}
                        />
                        {errors.url && (
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                <MaterialIcon name="error" className="text-sm" />
                                {errors.url.message}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Host</label>
                            <input
                                {...register('host')}
                                placeholder="8.8.8.8"
                                className={getInputClassName(!!errors.host || !!errors.url)}
                            />
                            {errors.url && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.url.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('포트')}</label>
                            <input
                                {...register('port', { valueAsNumber: true })}
                                type="number"
                                placeholder="53"
                                className={getInputClassName(!!errors.port)}
                            />
                            {errors.port && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.port.message}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-ui-border-dark">
                    <MaterialIcon name="schedule" className="text-primary text-lg" />
                    <h3 className="text-sm font-bold text-slate-700 dark:text-text-secondary-dark">{t('헬스 체크 스케줄')}</h3>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('스케줄 타입')}</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${scheduleType === 'interval' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('scheduleType')} type="radio" value="interval" className="hidden" />
                            <MaterialIcon name="schedule" className="text-lg" />
                            {t('일정 간격')}
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all ${scheduleType === 'cron' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'}`}>
                            <input {...register('scheduleType')} type="radio" value="cron" className="hidden" />
                            <MaterialIcon name="calendar_month" className="text-lg" />
                            {t('예약 스케줄')}
                        </label>
                    </div>
                </div>

                {scheduleType === 'interval' ? (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('체크 간격')} (s)</label>
                            <input
                                {...register('interval', { valueAsNumber: true })}
                                type="number"
                                className={getInputClassName(!!errors.interval)}
                            />
                            {errors.interval && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                                    <MaterialIcon name="error" className="text-sm" />
                                    {errors.interval.message}
                                </p>
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('타임아웃')} (ms)</label>
                            <input
                                {...register('timeout', { valueAsNumber: true })}
                                type="number"
                                className={getInputClassName(!!errors.timeout)}
                            />
                            {errors.timeout && (
                                <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
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
                                {t('매일 특정 시각')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setScheduledType('weekly')}
                                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${scheduledType === 'weekly' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}
                            >
                                {t('매주 특정 요일')}
                            </button>
                        </div>
                        {scheduledType === 'weekly' && (
                            <div className="flex flex-wrap gap-1">
                                {weekdays.map((day, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setScheduledWeekday(idx)}
                                        className={`px-2 py-1 rounded text-xs font-bold transition-all ${scheduledWeekday === idx ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-ui-active-dark text-slate-500'}`}
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
                        <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs text-primary font-medium">
                            {cronPreviewText}
                        </div>
                    </div>
                )}
            </div>

        </form>
        </div>
        <div className="flex-none border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-6 py-4 flex gap-3">
            <button
                type="button"
                onClick={closePanel}
                className="flex-1 py-3 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all"
            >
                {tc('common.cancel')}
            </button>
            <button
                type="submit"
                form="hc-form"
                disabled={isSubmitting}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <MaterialIcon name="save" className="text-lg" />
                        {tc('common.save')}
                    </>
                )}
            </button>
        </div>
        </>
    );
}
