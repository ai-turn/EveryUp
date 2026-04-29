import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import {
    api,
    type AlertRule,
    type NotificationChannel,
    type Service,
    type Host,
} from '../../../services/api';
import { useSidePanel } from '../../../contexts/SidePanelContext';

const ruleSchema = z.object({
    name: z.string().min(1),
    ruleCategory: z.enum(['resource', 'endpoint', 'log']),
    metric: z.enum(['cpu', 'memory', 'disk', 'http_status', 'response_time', 'log_level']),
    serviceId: z.string().optional(),
    hostId: z.string().optional(),
    operator: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']),
    threshold: z.number().min(0),
    duration: z.number().min(1).max(60),
    severity: z.enum(['critical', 'warning', 'info']),
    cooldown: z.number().min(0).max(86400),
    channelIds: z.array(z.string()),
}).superRefine((data, ctx) => {
    if (!data.name.trim()) {
        ctx.addIssue({ path: ['name'], code: z.ZodIssueCode.custom, message: 'required' });
    }
});

type RuleFormValues = z.infer<typeof ruleSchema>;
type RuleCategory = RuleFormValues['ruleCategory'];
type ConditionPreset = 'normal' | 'error' | 'custom';

const OPERATOR_SYMBOLS: Record<string, string> = {
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    eq: '=',
};


function getPresetValues(metric: RuleFormValues['metric'], preset: ConditionPreset): { operator: RuleFormValues['operator']; threshold: number; duration?: number } | null {
    if (preset === 'custom') return null;
    if (preset === 'normal') {
        if (metric === 'http_status') return { operator: 'lte', threshold: 299 };
        if (metric === 'response_time') return { operator: 'lt', threshold: 1000 };
        if (metric === 'log_level') return { operator: 'eq', threshold: 4 };
        return { operator: 'lt', threshold: 70, duration: 1 };
    }
    if (metric === 'http_status') return { operator: 'gte', threshold: 400 };
    if (metric === 'response_time') return { operator: 'gt', threshold: 3000 };
    if (metric === 'log_level') return { operator: 'gte', threshold: 3 };
    return { operator: 'gt', threshold: 80, duration: 3 };
}

function detectConditionPreset(metric: RuleFormValues['metric'], operator: RuleFormValues['operator'], threshold: number, duration: number): ConditionPreset {
    const normal = getPresetValues(metric, 'normal');
    const error = getPresetValues(metric, 'error');
    if (normal && operator === normal.operator && threshold === normal.threshold && (normal.duration == null || duration === normal.duration)) return 'normal';
    if (error && operator === error.operator && threshold === error.threshold && (error.duration == null || duration === error.duration)) return 'error';
    return 'custom';
}

function buildDefaultMessage(metric: RuleFormValues['metric'], operator: RuleFormValues['operator'], threshold: number, duration: number): string {
    const opSym = OPERATOR_SYMBOLS[operator] ?? operator;
    if (metric === 'http_status') return `HTTP Status ${opSym} ${threshold} detected`;
    if (metric === 'response_time') return `Response Time ${opSym} ${threshold}ms detected`;
    if (metric === 'log_level') return `Log {level}: {message}`;
    const metricLabel = { cpu: 'CPU', memory: 'Memory', disk: 'Disk' }[metric] ?? metric.toUpperCase();
    return `${metricLabel} usage ${opSym} ${threshold}%, sustained for ${duration}min on {host_name}`;
}

function SectionHeader({ icon, label }: { icon: string; label: string }) {
    return (
        <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name={icon} className="text-base text-primary" />
            <span className="text-xs font-bold text-primary">{label}</span>
            <div className="flex-1 h-px bg-primary/20" />
        </div>
    );
}

interface AlertRuleFormProps {
    onSuccess: () => void;
    rule?: AlertRule;
    channels: NotificationChannel[];
}

export function AlertRuleForm({ onSuccess, rule, channels }: AlertRuleFormProps) {
    const isEdit = !!rule;

    // System rules get a simplified editor (message + channels only)
    if (isEdit && rule?.isSystem) {
        return <SystemRuleEditor rule={rule} channels={channels} onSuccess={onSuccess} />;
    }

    return <FullRuleForm onSuccess={onSuccess} rule={rule} channels={channels} />;
}

function SystemRuleEditor({ rule, channels, onSuccess }: { rule: AlertRule; channels: NotificationChannel[]; onSuccess: () => void }) {
    const { t } = useTranslation(['alerts', 'common']);
    const { closePanel } = useSidePanel();
    const [message, setMessage] = useState(rule.message ?? '');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(rule.channelIds || []);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleToggleChannel = (id: string) => {
        setSelectedChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            await api.updateAlertRule(rule.id, { message, channelIds: selectedChannels });
            toast.success(t('alerts.rules.updated'));
            onSuccess();
            closePanel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-4 custom-scrollbar">
        <div className="space-y-8">
            <section>
                <SectionHeader icon="power_settings_new" label={t('alerts.rules.systemRule')} />
                <div className="p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{rule.name}</h3>
                    <p className="text-xs text-slate-500">{t('alerts.rules.systemRuleDesc')}</p>
                </div>
            </section>

            <section>
                <SectionHeader icon="edit_note" label={t('alerts.rules.messageLabel')} />
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Server has been started"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-ui-hover-dark border-2 border-slate-100 dark:border-ui-border-dark rounded-xl text-sm font-semibold outline-none focus:border-primary dark:text-white resize-none"
                />
            </section>

            <section>
                <SectionHeader icon="notifications" label={t('alerts.rules.notifyChannels')} />
                <div className="space-y-2">
                    {channels.length === 0 ? (
                        <p className="text-sm text-slate-400">{t('alerts.rules.noChannels')}</p>
                    ) : channels.map(ch => (
                        <button key={ch.id} type="button" onClick={() => handleToggleChannel(ch.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 border-2 rounded-xl transition-all ${selectedChannels.includes(ch.id) ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'}`}>
                            <MaterialIcon name={ch.type === 'telegram' ? 'send' : 'sports_esports'} className="text-sm" />
                            <span className="text-xs font-bold flex-1 text-left">{ch.name}</span>
                        </button>
                    ))}
                    {selectedChannels.length === 0 && channels.length > 0 && (
                        <p className="text-xs text-slate-400 italic">{t('alerts.rules.allChannels')}</p>
                    )}
                </div>
            </section>

        </div>
        </div>
        <div className="flex-none border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-6 py-4 flex gap-3">
            <button type="button" onClick={closePanel} className="flex-1 py-3 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all">
                {t('common.cancel')}
            </button>
            <button type="button" onClick={handleSave} disabled={isSubmitting} className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>{t('common.save')}</span>}
            </button>
        </div>
        </>
    );
}

function FullRuleForm({ onSuccess, rule, channels }: AlertRuleFormProps) {
    const { t } = useTranslation(['alerts', 'common']);
    const { closePanel } = useSidePanel();
    const isEdit = !!rule;
    const [services, setServices] = useState<Service[]>([]);
    const [hosts, setHosts] = useState<Host[]>([]);

    const [conditionPreset, setConditionPreset] = useState<ConditionPreset>('error');
    const [customMessage, setCustomMessage] = useState('');
    const [customThreshold, setCustomThreshold] = useState('');

    const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '', ruleCategory: 'endpoint', metric: 'http_status',
            serviceId: '', hostId: '', operator: 'gte', threshold: 400,
            duration: 1, severity: 'warning', cooldown: 300, channelIds: [],
        },
    });

    const watchedCategory = watch('ruleCategory');
    const watchedMetric = watch('metric');
    const watchedOperator = watch('operator');
    const watchedThreshold = watch('threshold');
    const watchedDuration = watch('duration');
    const watchedServiceId = watch('serviceId') ?? '';
    const watchedHostId = watch('hostId') ?? '';
    const watchedChannelIds = watch('channelIds');
    const watchedSeverity = watch('severity');

    useEffect(() => {
        api.getServices().then(setServices).catch(() => { });
        api.getHosts().then(setHosts).catch(() => { });
    }, []);

    useEffect(() => {
        if (rule) {
            const ruleCategory: RuleCategory = rule.type === 'service' ? 'endpoint' : rule.type === 'log' ? 'log' : 'resource';
            const metric = rule.metric as RuleFormValues['metric'];
            const preset = detectConditionPreset(metric, rule.operator, rule.threshold, rule.duration);
            reset({
                name: rule.name,
                ruleCategory,
                metric,
                serviceId: rule.serviceId ?? '',
                hostId: rule.hostId ?? '',
                operator: rule.operator,
                threshold: rule.threshold,
                duration: rule.duration,
                severity: rule.severity,
                cooldown: rule.cooldown || 300,
                channelIds: rule.channelIds || [],
            });
            setConditionPreset(preset);
            setCustomMessage(rule.message ?? '');
            if (preset === 'custom') {
                setCustomThreshold(String(rule.threshold));
            }
        }
    }, [rule, reset]);

    const applyPreset = (preset: ConditionPreset, metric: RuleFormValues['metric']) => {
        setConditionPreset(preset);
        const vals = getPresetValues(metric, preset);
        if (vals) {
            setValue('operator', vals.operator);
            setValue('threshold', vals.threshold);
            if (vals.duration != null) setValue('duration', vals.duration);
        }
    };

    const handleCategoryChange = (cat: RuleCategory) => {
        setValue('ruleCategory', cat);
        setValue('serviceId', '');
        setValue('hostId', '');
        const newMetric: RuleFormValues['metric'] = cat === 'resource' ? 'cpu' : cat === 'log' ? 'log_level' : 'http_status';
        setValue('metric', newMetric);
        applyPreset('error', newMetric);
    };

    const handleMetricChange = (m: RuleFormValues['metric']) => {
        setValue('metric', m);
        applyPreset('error', m);
    };

    const handleConditionPreset = (preset: ConditionPreset) => {
        applyPreset(preset, watchedMetric);
        if (preset !== 'custom') {
            setCustomThreshold('');
        } else {
            setCustomThreshold(String(watchedThreshold));
        }
    };

    const handleToggleChannel = (channelId: string) => {
        const current = watchedChannelIds || [];
        setValue('channelIds', current.includes(channelId)
            ? current.filter(id => id !== channelId)
            : [...current, channelId]);
    };

    const onSubmit = async (data: RuleFormValues) => {
        try {
            const isEndpoint = data.ruleCategory === 'endpoint';
            const isLog = data.ruleCategory === 'log';
            const payload = {
                name: data.name,
                type: isLog ? 'log' as const : isEndpoint ? 'service' as const : 'resource' as const,
                metric: data.metric,
                serviceId: isEndpoint || isLog ? (data.serviceId || null) : null,
                hostId: !isEndpoint && !isLog ? (data.hostId || null) : null,
                operator: data.operator,
                threshold: data.threshold,
                duration: data.duration,
                severity: data.severity,
                cooldown: isEndpoint || isLog ? 0 : data.cooldown,
                message: customMessage.trim() || '',
                channelIds: data.channelIds,
            };
            if (isEdit && rule) {
                await api.updateAlertRule(rule.id, payload);
                toast.success(t('alerts.rules.updated'));
            } else {
                await api.createAlertRule(payload);
                toast.success(t('alerts.rules.created'));
            }
            onSuccess();
            closePanel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const isEndpoint = watchedCategory === 'endpoint';
    const isLog = watchedCategory === 'log';
    const metricName = { cpu: 'CPU', memory: 'Memory', disk: 'Disk', http_status: 'HTTP Status', response_time: 'Response Time', log_level: 'Log Level' }[watchedMetric] ?? watchedMetric;
    const thresholdUnit = watchedMetric === 'response_time' ? 'ms' : watchedMetric === 'http_status' || watchedMetric === 'log_level' ? '' : '%';
    const selectableServices = isLog ? services.filter(s => s.type === 'log') : services.filter(s => s.type !== 'log');
    const selectedService = selectableServices.find(s => s.id === watchedServiceId);
    const selectedHost = hosts.find(h => h.id === watchedHostId);
    const targetLabel = isEndpoint || isLog
        ? (watchedServiceId ? (selectedService?.name ?? watchedServiceId) : (isLog ? t('alerts.rules.allLogServices') : t('alerts.rules.allHealthchecks')))
        : (watchedHostId ? (selectedHost?.name ?? watchedHostId) : t('alerts.rules.allHosts'));

    return (
        <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-4 custom-scrollbar">
        <form id="alert-rule-form" onSubmit={handleSubmit(onSubmit, (validationErrors) => {
            const firstError = Object.values(validationErrors)[0];
            toast.error(firstError?.message as string || t('alerts.rules.validationFailed', { defaultValue: 'Please check required fields' }));
        })} className="space-y-8">
            <section>
                <SectionHeader icon="target" label={t('alerts.rules.sectionTarget')} />
                <div className="flex gap-2 mb-4">
                    {([
                        { value: 'endpoint' as const, label: t('alerts.rules.endpointHealth'), icon: 'monitor_heart' },
                        { value: 'log' as const, label: t('alerts.rules.logRule'), icon: 'article' },
                        { value: 'resource' as const, label: t('alerts.rules.serverResource'), icon: 'memory' },
                    ]).map(cat => (
                        <button key={cat.value} type="button" onClick={() => handleCategoryChange(cat.value)}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-bold border-2 rounded-xl transition-all ${watchedCategory === cat.value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500 hover:border-slate-200 dark:hover:border-slate-700'
                                }`}>
                            <MaterialIcon name={cat.icon} />
                            {cat.label}
                        </button>
                    ))}
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">{t('alerts.rules.target')}</label>
                        <select
                            value={isEndpoint ? watchedServiceId : watchedHostId}
                            onChange={e => setValue(isEndpoint || isLog ? 'serviceId' : 'hostId', e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-ui-hover-dark border-2 border-slate-100 dark:border-ui-border-dark rounded-xl text-sm font-semibold outline-none focus:border-primary dark:text-white"
                        >
                            <option value="">{isLog ? t('alerts.rules.allLogServices') : isEndpoint ? t('alerts.rules.allHealthchecks') : t('alerts.rules.allHosts')}</option>
                            {(isEndpoint || isLog ? selectableServices : hosts).map(item => (
                                <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">{t('alerts.rules.metric')}</label>
                        <div className="flex flex-wrap gap-2">
                            {(isLog ? ['log_level'] as const : isEndpoint ? ['http_status', 'response_time'] as const : ['cpu', 'memory', 'disk'] as const).map(m => (
                                <button key={m} type="button" onClick={() => handleMetricChange(m)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold border-2 transition-all ${watchedMetric === m ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'
                                        }`}>
                                    {m === 'log_level' ? t('alerts.rules.logLevel') : m.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">{t('alerts.rules.ruleName')}</label>
                        <input {...register('name')} placeholder="e.g. High CPU usage alert" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-ui-hover-dark border-2 border-slate-100 dark:border-ui-border-dark rounded-xl text-sm font-semibold outline-none focus:border-primary dark:text-white" />
                    </div>
                </div>
            </section>

            <section>
                <SectionHeader icon="rule" label={t('alerts.rules.sectionCondition')} />
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {([
                        { value: 'normal' as const, icon: 'check_circle', labelKey: 'alerts.rules.conditionNormal' },
                        { value: 'error'  as const, icon: 'warning',       labelKey: 'alerts.rules.conditionError'  },
                        { value: 'custom' as const, icon: 'tune',          labelKey: 'alerts.rules.conditionCustom' },
                    ]).map(p => (
                        <button key={p.value} type="button" onClick={() => handleConditionPreset(p.value)}
                            className={`flex flex-col items-center gap-1.5 p-2 sm:p-3 border-2 rounded-xl transition-all ${conditionPreset === p.value ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'
                                }`}>
                            <MaterialIcon name={p.icon} />
                            <span className="text-xs font-bold">{t(p.labelKey)}</span>
                        </button>
                    ))}
                </div>

                {(isEndpoint || isLog) && (
                    <div className="mt-3 flex items-center justify-between p-3 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
                        <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-white">{isLog ? t('alerts.rules.logSensitivity') : t('alerts.rules.consecutiveChecks')}</p>
                            <p className="text-xs text-slate-400">{isLog ? t('alerts.rules.logSensitivityHint') : t('alerts.rules.consecutiveChecksHint')}</p>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            {...register('duration', { valueAsNumber: true })}
                            className="w-16 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2 py-1.5 text-sm font-mono font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary text-right tabular-nums"
                        />
                    </div>
                )}

                {conditionPreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl mb-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('alerts.rules.operator')}</label>
                            <select {...register('operator')} className="w-full bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2 py-1.5 text-sm dark:text-white">
                                <option value="gt">&gt;</option>
                                <option value="gte">&ge;</option>
                                <option value="lt">&lt;</option>
                                <option value="lte">&le;</option>
                                <option value="eq">=</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('alerts.rules.customInputThreshold')}</label>
                            <input type="number" value={customThreshold} onChange={e => {
                                setCustomThreshold(e.target.value);
                                const n = parseFloat(e.target.value);
                                if (!isNaN(n)) setValue('threshold', n);
                            }} className="w-full bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2 py-1.5 text-sm dark:text-white" />
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-700/60">
                    <span className="text-slate-500 font-mono text-xs">IF</span>
                    <code className="px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded text-xs font-mono">{metricName}</code>
                    <code className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator}</code>
                    <code className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs font-mono">{watchedThreshold}{thresholdUnit}</code>
                    {isLog ? (
                        <>
                            <span className="text-slate-600 font-mono text-xs">MATCHES</span>
                            <code className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{watchedThreshold >= 4 ? 'ERROR' : 'WARN+'}</code>
                        </>
                    ) : isEndpoint ? (
                        <>
                            <span className="text-slate-600 font-mono text-xs">FAILS</span>
                            <code className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{watchedDuration}x</code>
                        </>
                    ) : (
                        <>
                            <span className="text-slate-600 font-mono text-xs">FOR</span>
                            <code className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{watchedDuration}min</code>
                        </>
                    )}
                    <span className="text-slate-600 font-mono text-xs">ON</span>
                    <code className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-mono max-w-32 truncate">{targetLabel}</code>
                </div>
            </section>

            <section>
                <SectionHeader icon="notifications" label={t('alerts.rules.sectionNotification')} />
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">{t('alerts.rules.severity')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['critical', 'warning', 'info'] as const).map(s => (
                                <button key={s} type="button" onClick={() => setValue('severity', s)}
                                    className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${watchedSeverity === s ? 'border-primary bg-primary/10 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'
                                        }`}>
                                    {t(`alerts.rules.${s}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">{t('alerts.rules.notifyChannels')}</label>
                        <div className="space-y-2">
                            {channels.map(ch => (
                                <button key={ch.id} type="button" onClick={() => handleToggleChannel(ch.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2 border-2 rounded-xl transition-all ${watchedChannelIds.includes(ch.id) ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'
                                        }`}>
                                    <MaterialIcon name={ch.type === 'telegram' ? 'send' : 'sports_esports'} className="text-sm" />
                                    <span className="text-xs font-bold flex-1 text-left">{ch.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Alert Payload Preview */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">
                            {t('alerts.rules.alertPayload')}
                            <span className="ml-2 text-xs font-normal text-slate-400 normal-case">{t('alerts.rules.alertPayloadHint')}</span>
                        </label>
                        <div className="rounded-xl overflow-hidden border border-slate-700">
                            {/* Terminal title bar */}
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700">
                                <div className="flex gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                                </div>
                                <span className="text-xs text-slate-500 font-mono ml-1">notification_payload.json</span>
                            </div>
                            {/* JSON body */}
                            <div className="bg-[#1E1E2E] px-4 py-3 font-mono text-xs leading-6 select-none overflow-x-auto">
                                <span className="text-[#6272A4]">{'{'}</span>
                                <div className="pl-4 space-y-px">
                                    <div>
                                        <span className="text-[#8BE9FD]">"type"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#50FA7B]">"{isLog ? 'log' : isEndpoint ? 'healthcheck' : 'resource'}"</span>
                                        <span className="text-[#6272A4]">,</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"{isEndpoint || isLog ? 'service' : 'host'}"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#F1FA8C]">"{targetLabel}"</span>
                                        <span className="text-[#6272A4]">,</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"metric"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#F1FA8C]">"{metricName}"</span>
                                        <span className="text-[#6272A4]">,</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"operator"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#F1FA8C]">"{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator}"</span>
                                        <span className="text-[#6272A4]">,</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"threshold"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#FF79C6]">{watchedThreshold}</span>
                                        <span className="text-[#6272A4]">{thresholdUnit ? `,  // ${thresholdUnit}` : ','}</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"current"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className="text-[#BD93F9] italic">{'<live_value>'}</span>
                                        <span className="text-[#6272A4]">,  // evaluated at runtime</span>
                                    </div>
                                    <div>
                                        <span className="text-[#8BE9FD]">"severity"</span>
                                        <span className="text-[#6272A4]">: </span>
                                        <span className={
                                            watchedSeverity === 'critical' ? 'text-[#FF5555]' :
                                            watchedSeverity === 'warning' ? 'text-[#FFB86C]' : 'text-[#8BE9FD]'
                                        }>"{watchedSeverity}"</span>
                                        <span className="text-[#6272A4]">,</span>
                                    </div>
                                    <div className="flex items-start">
                                        <span className="text-[#8BE9FD] shrink-0">"message"</span>
                                        <span className="text-[#6272A4] shrink-0">: "</span>
                                        <span className={`break-all ${customMessage ? 'text-[#50FA7B]' : 'text-[#6272A4] italic'}`}>
                                            {customMessage || 'auto-generated'}
                                        </span>
                                        <span className="text-[#6272A4] shrink-0">"</span>
                                    </div>
                                </div>
                                <span className="text-[#6272A4]">{'}'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Editable message */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">
                            <span className="text-[#8BE9FD] font-mono">"message"</span>
                            <span className="ml-2 normal-case font-normal text-slate-400">
                                {t('alerts.rules.messageOverridesHint')}
                            </span>
                        </label>
                        <textarea
                            value={customMessage}
                            onChange={e => setCustomMessage(e.target.value)}
                            rows={2}
                            placeholder={buildDefaultMessage(watchedMetric, watchedOperator, watchedThreshold, watchedDuration)}
                            className="w-full px-3 py-2.5 bg-[#1E1E2E] border border-slate-700 rounded-xl text-xs font-mono text-[#50FA7B] outline-none focus:border-primary resize-none placeholder:text-[#44475A]"
                        />
                        <p className="mt-1 text-xs text-slate-400 font-mono">
                            <span className="text-[#6272A4]">// vars: </span>
                            {isLog
                                ? <span className="text-[#BD93F9]">{'{service_name}'} {'{level}'} {'{message}'}</span>
                                : isEndpoint
                                ? <span className="text-[#BD93F9]">{'{service_name}'} {'{value}'} {'{threshold}'} {'{metric}'}</span>
                                : <span className="text-[#BD93F9]">{'{host_name}'} {'{value}'} {'{threshold}'} {'{metric}'} {'{duration}'}</span>
                            }
                        </p>
                    </div>
                </div>
            </section>

        </form>
        </div>
        <div className="flex-none border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-6 py-4 flex gap-3">
            <button type="button" onClick={closePanel} className="flex-1 py-3 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all">
                {t('common.cancel')}
            </button>
            <button type="submit" form="alert-rule-form" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>{t('common.save')}</span>}
            </button>
        </div>
        </>
    );
}
