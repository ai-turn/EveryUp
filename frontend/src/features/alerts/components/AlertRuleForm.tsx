import { ReactNode, useEffect, useState } from 'react';
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

const ruleSchema = z.object({
    name: z.string().min(1),
    ruleCategory: z.enum(['resource', 'endpoint', 'log']),
    metric: z.enum(['cpu', 'memory', 'disk', 'http_status', 'response_time', 'log_level', 'api_status_code']),
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
        if (metric === 'api_status_code') return { operator: 'lt', threshold: 400 };
        return { operator: 'lt', threshold: 70, duration: 1 };
    }
    if (metric === 'http_status') return { operator: 'gte', threshold: 400 };
    if (metric === 'response_time') return { operator: 'gt', threshold: 3000 };
    if (metric === 'log_level') return { operator: 'gte', threshold: 3 };
    if (metric === 'api_status_code') return { operator: 'gte', threshold: 500 };
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
    if (metric === 'api_status_code') return `{method} {path} → {status} ({duration}ms)`;
    const metricLabel = { cpu: 'CPU', memory: 'Memory', disk: 'Disk' }[metric] ?? metric.toUpperCase();
    return `${metricLabel} usage ${opSym} ${threshold}%, sustained for ${duration}min on {host_name}`;
}

function getEvalPath(category: RuleCategory, metric: RuleFormValues['metric']): string {
    if (category === 'resource') return 'collector → evaluator.go  (N분 연속 임계 초과 시 발동)';
    if (category === 'endpoint') return 'healthcheck → service_evaluator.go  (N회 연속 실패 시 발동)';
    if (category === 'log' && metric === 'api_status_code') return 'api_request_ingest.go  (이벤트당 즉시 평가 · cooldown=0)';
    if (category === 'log') return 'log_ingest.go  (이벤트당 즉시 평가 · cooldown=0)';
    return '시스템 자동 생성 룰';
}

// ─── Layout primitives ────────────────────────────────────────────────────────

function FormStep({ n, title, subtitle, children }: { n: number; title: string; subtitle?: string; children: ReactNode }) {
    return (
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
            <div className={`flex items-center gap-3 px-5 ${subtitle ? 'py-4' : 'py-3'} border-b border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30`}>
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs font-mono shrink-0">
                    {n}
                </span>
                <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
                    {subtitle && <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5 space-y-5">{children}</div>
        </div>
    );
}

function Field({ label, hint, required, children }: { label: string; hint?: string | null; required?: boolean; children: ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-1 mb-2">
                <label className="text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide">{label}</label>
                {required && <span className="text-red-500 text-xs">*</span>}
            </div>
            {children}
            {hint && <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-1.5 italic">{hint}</p>}
        </div>
    );
}

const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 dark:bg-ui-hover-dark border border-slate-200 dark:border-ui-border-dark rounded-lg text-sm font-semibold outline-none focus:border-primary dark:text-white transition-colors";

// ─── Props ────────────────────────────────────────────────────────────────────

interface AlertRuleFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    rule?: AlertRule;
    channels: NotificationChannel[];
    onSubmittingChange?: (v: boolean) => void;
}

// ─── Public export ────────────────────────────────────────────────────────────

export function AlertRuleForm({ onSuccess, onCancel, rule, channels, onSubmittingChange }: AlertRuleFormProps) {
    if (!!rule && rule.isSystem) {
        return <SystemRuleEditor rule={rule} channels={channels} onSuccess={onSuccess} onCancel={onCancel} onSubmittingChange={onSubmittingChange} />;
    }
    return <FullRuleForm onSuccess={onSuccess} onCancel={onCancel} rule={rule} channels={channels} onSubmittingChange={onSubmittingChange} />;
}

// ─── System rule editor ───────────────────────────────────────────────────────

function SystemRuleEditor({ rule, channels, onSuccess, onCancel, onSubmittingChange }: { rule: AlertRule; channels: NotificationChannel[]; onSuccess: () => void; onCancel: () => void; onSubmittingChange?: (v: boolean) => void }) {
    const { t } = useTranslation(['alerts', 'common']);
    const [message, setMessage] = useState(rule.message ?? '');
    const [selectedChannels, setSelectedChannels] = useState<string[]>(rule.channelIds || []);

    const handleToggleChannel = (id: string) => {
        setSelectedChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        onSubmittingChange?.(true);
        try {
            await api.updateAlertRule(rule.id, { message, channelIds: selectedChannels });
            toast.success(t('alerts.rules.updated'));
            onSuccess();
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    return (
        <form id="alert-rule-form" onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-6 space-y-4">
            <FormStep n={1} title={t('alerts.rules.systemRule')} subtitle={t('alerts.rules.systemRuleDesc')}>
                <div className="p-4 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">{rule.name}</h3>
                    <p className="text-xs text-slate-500">{t('alerts.rules.systemRuleDesc')}</p>
                </div>
            </FormStep>

            <FormStep n={2} title={t('alerts.rules.messageLabel')} subtitle="알림 발송 시 사용될 메시지">
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    placeholder="Server has been started"
                    className={inputCls + " resize-none"}
                />
            </FormStep>

            <FormStep n={3} title={t('alerts.rules.notifyChannels')} subtitle="발송할 채널 선택">
                <div className="space-y-2">
                    {channels.length === 0 ? (
                        <p className="text-sm text-slate-400">{t('alerts.rules.noChannels')}</p>
                    ) : channels.map(ch => (
                        <button key={ch.id} type="button" onClick={() => handleToggleChannel(ch.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-all ${selectedChannels.includes(ch.id) ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-ui-border-dark text-slate-500'}`}>
                            <MaterialIcon name={ch.type === 'telegram' ? 'send' : 'sports_esports'} className="text-sm" />
                            <span className="text-xs font-bold flex-1 text-left">{ch.name}</span>
                        </button>
                    ))}
                    {selectedChannels.length === 0 && channels.length > 0 && (
                        <p className="text-xs text-slate-400 italic">{t('alerts.rules.allChannels')}</p>
                    )}
                </div>
            </FormStep>
        </form>
    );
}

// ─── Full rule form ───────────────────────────────────────────────────────────

function FullRuleForm({ onSuccess, onCancel, rule, channels, onSubmittingChange }: AlertRuleFormProps) {
    const { t } = useTranslation(['alerts', 'common']);
    const isEdit = !!rule;
    const [services, setServices] = useState<Service[]>([]);
    const [hosts, setHosts] = useState<Host[]>([]);
    const [conditionPreset, setConditionPreset] = useState<ConditionPreset>('error');
    const [customMessage, setCustomMessage] = useState('');
    const [customThreshold, setCustomThreshold] = useState('');

    const { register, handleSubmit, reset, setValue, watch } = useForm<RuleFormValues>({
        resolver: zodResolver(ruleSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '', ruleCategory: 'endpoint', metric: 'http_status',
            serviceId: '', hostId: '', operator: 'gte', threshold: 400,
            duration: 1, severity: 'warning', cooldown: 300, channelIds: [],
        },
    });

    const watchedCategory  = watch('ruleCategory');
    const watchedMetric    = watch('metric');
    const watchedOperator  = watch('operator');
    const watchedThreshold = watch('threshold');
    const watchedDuration  = watch('duration');
    const watchedCooldown  = watch('cooldown');
    const watchedServiceId = watch('serviceId') ?? '';
    const watchedHostId    = watch('hostId') ?? '';
    const watchedChannelIds = watch('channelIds');
    const watchedSeverity  = watch('severity');
    const watchedName      = watch('name');

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
            if (preset === 'custom') setCustomThreshold(String(rule.threshold));
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
        onSubmittingChange?.(true);
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
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    const isEndpoint = watchedCategory === 'endpoint';
    const isLog = watchedCategory === 'log';
    const isApiStatus = watchedMetric === 'api_status_code';
    const metricName = { cpu: 'CPU', memory: 'Memory', disk: 'Disk', http_status: 'HTTP Status', response_time: 'Response Time', log_level: 'Log Level', api_status_code: 'API Status' }[watchedMetric] ?? watchedMetric;
    const thresholdUnit = watchedMetric === 'response_time' ? 'ms' : (watchedMetric === 'http_status' || watchedMetric === 'log_level' || isApiStatus) ? '' : '%';
    const selectableServices = isLog ? services.filter(s => s.type === 'log') : services.filter(s => s.type !== 'log');
    const selectedService = selectableServices.find(s => s.id === watchedServiceId);
    const selectedHost = hosts.find(h => h.id === watchedHostId);
    const targetLabel = isEndpoint || isLog
        ? (watchedServiceId ? (selectedService?.name ?? watchedServiceId) : (isLog ? t('alerts.rules.allLogServices') : t('alerts.rules.allHealthchecks')))
        : (watchedHostId ? (selectedHost?.name ?? watchedHostId) : t('alerts.rules.allHosts'));

    const previewChannels = watchedChannelIds.length === 0
        ? channels
        : channels.filter(c => watchedChannelIds.includes(c.id));

    const severityClasses = {
        critical: { border: 'border-red-500',  bg: 'bg-red-500/5',   badge: 'bg-red-500/10 text-red-500',   dot: 'bg-red-500' },
        warning:  { border: 'border-amber-500', bg: 'bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500' },
        info:     { border: 'border-sky-500',   bg: 'bg-sky-500/5',   badge: 'bg-sky-500/10 text-sky-500',   dot: 'bg-sky-500' },
    }[watchedSeverity];

    return (
        <form
            id="alert-rule-form"
            onSubmit={handleSubmit(onSubmit, (validationErrors) => {
                const firstError = Object.values(validationErrors)[0];
                toast.error(firstError?.message as string || t('alerts.rules.validationFailed', { defaultValue: 'Please check required fields' }));
            })}
            className="px-6 py-6"
        >
            <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">

                {/* ── Left: form steps ─────────────────────────────────── */}
                <div className="space-y-4 min-w-0">

                    {/* Step 1: Target */}
                    <FormStep n={1} title="대상 (Target)">
                        <Field label={t('alerts.rules.category', { defaultValue: '카테고리' })}>
                            <div className="flex gap-2">
                                {([
                                    { value: 'endpoint' as const, label: t('alerts.rules.endpointHealth'), sub: 'ENDPOINT · 헬스체크', icon: 'monitor_heart' },
                                    { value: 'log'      as const, label: t('alerts.rules.logRule'),       sub: 'LOG · 로그 분석',     icon: 'article' },
                                    { value: 'resource' as const, label: t('alerts.rules.serverResource'), sub: 'INFRA · 서버 리소스', icon: 'memory' },
                                ]).map(cat => (
                                    <button
                                        key={cat.value}
                                        type="button"
                                        onClick={() => handleCategoryChange(cat.value)}
                                        className={`flex-1 flex flex-col items-start gap-1 px-3 py-3 border-2 rounded-xl transition-all text-left ${
                                            watchedCategory === cat.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-slate-100 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2 font-bold text-sm">
                                            <MaterialIcon name={cat.icon} className="text-base" />
                                            {cat.label}
                                        </span>
                                        <span className="text-2xs font-semibold uppercase tracking-wider opacity-60">{cat.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field
                                label={t('alerts.rules.target')}
                                hint={(!watchedServiceId && !watchedHostId) ? '* 미선택 시 모든 대상에 적용됩니다' : null}
                            >
                                <select
                                    value={isEndpoint ? watchedServiceId : isLog ? watchedServiceId : watchedHostId}
                                    onChange={e => setValue(isEndpoint || isLog ? 'serviceId' : 'hostId', e.target.value)}
                                    className={inputCls}
                                >
                                    <option value="">{isLog ? t('alerts.rules.allLogServices') : isEndpoint ? t('alerts.rules.allHealthchecks') : t('alerts.rules.allHosts')}</option>
                                    {(isEndpoint || isLog ? selectableServices : hosts).map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </Field>

                            <Field label={t('alerts.rules.metric')}>
                                <div className="flex flex-wrap gap-2">
                                    {(isLog
                                        ? ['log_level', 'api_status_code'] as const
                                        : isEndpoint
                                        ? ['http_status', 'response_time'] as const
                                        : ['cpu', 'memory', 'disk'] as const
                                    ).map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => handleMetricChange(m)}
                                            className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                                                watchedMetric === m
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-slate-100 dark:border-ui-border-dark text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            {m === 'log_level' ? t('alerts.rules.logLevel') : m === 'api_status_code' ? t('alerts.rules.apiStatusCode') : m.replace('_', ' ').toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                        </div>

                        <Field label={t('alerts.rules.ruleName')} required>
                            <input
                                {...register('name')}
                                placeholder="e.g. High CPU usage alert"
                                className={inputCls}
                            />
                        </Field>
                    </FormStep>

                    {/* Step 2: Condition */}
                    <FormStep n={2} title="조건 (Condition)">
                        <Field label={t('alerts.rules.preset', { defaultValue: '프리셋' })}>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    { value: 'normal' as const, icon: 'check_circle', label: t('alerts.rules.conditionNormal'), sub: 'normal range' },
                                    { value: 'error'  as const, icon: 'warning',      label: t('alerts.rules.conditionError'),  sub: 'threshold breach' },
                                    { value: 'custom' as const, icon: 'tune',         label: t('alerts.rules.conditionCustom'), sub: 'manual' },
                                ]).map(p => (
                                    <button
                                        key={p.value}
                                        type="button"
                                        onClick={() => handleConditionPreset(p.value)}
                                        className={`flex flex-col items-start gap-1 p-3 border-2 rounded-xl transition-all ${
                                            conditionPreset === p.value
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-slate-100 dark:border-ui-border-dark text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <span className="flex items-center gap-1.5 text-xs font-bold">
                                            <MaterialIcon name={p.icon} className="text-sm" />
                                            {p.label}
                                        </span>
                                        <span className="text-2xs font-semibold uppercase tracking-wider opacity-60">{p.sub}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        {conditionPreset === 'custom' && (
                            <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
                                <Field label={t('alerts.rules.operator')}>
                                    <select
                                        {...register('operator')}
                                        className={inputCls + " w-20"}
                                    >
                                        <option value="gt">&gt;</option>
                                        <option value="gte">&ge;</option>
                                        <option value="lt">&lt;</option>
                                        <option value="lte">&le;</option>
                                        <option value="eq">=</option>
                                    </select>
                                </Field>
                                <Field label={t('alerts.rules.customInputThreshold')}>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            value={customThreshold}
                                            onChange={e => {
                                                setCustomThreshold(e.target.value);
                                                const n = parseFloat(e.target.value);
                                                if (!isNaN(n)) setValue('threshold', n);
                                            }}
                                            className={inputCls + (thresholdUnit ? " rounded-r-none" : "")}
                                        />
                                        {thresholdUnit && (
                                            <span className="px-3 py-2.5 bg-slate-100 dark:bg-ui-hover-dark border border-l-0 border-slate-200 dark:border-ui-border-dark rounded-r-lg text-sm font-semibold text-slate-500 dark:text-text-muted-dark font-mono">
                                                {thresholdUnit}
                                            </span>
                                        )}
                                    </div>
                                </Field>
                                {isEndpoint ? (
                                    <Field label={t('alerts.rules.consecutiveChecks')}>
                                        <input
                                            type="number" min={1} max={20}
                                            {...register('duration', { valueAsNumber: true })}
                                            className={inputCls}
                                        />
                                    </Field>
                                ) : !isLog ? (
                                    <Field label={t('alerts.rules.durationMin', { defaultValue: '지속 시간 (분)' })}>
                                        <input
                                            type="number" min={1} max={60}
                                            {...register('duration', { valueAsNumber: true })}
                                            className={inputCls}
                                        />
                                    </Field>
                                ) : (
                                    <Field label={t('alerts.rules.evalMode', { defaultValue: '평가 방식' })}>
                                        <p className="text-xs text-slate-400 italic py-2.5">이벤트당 즉시 평가</p>
                                    </Field>
                                )}
                            </div>
                        )}

                        {conditionPreset !== 'custom' && isEndpoint && (
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-xl">
                                <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-white">{t('alerts.rules.consecutiveChecks')}</p>
                                    <p className="text-xs text-slate-400">{t('alerts.rules.consecutiveChecksHint')}</p>
                                </div>
                                <input
                                    type="number" min={1} max={20}
                                    {...register('duration', { valueAsNumber: true })}
                                    className="w-16 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg px-2 py-1.5 text-sm font-mono font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-primary text-right tabular-nums"
                                />
                            </div>
                        )}

                        {!isEndpoint && !isLog && (
                            <Field
                                label={t('alerts.rules.cooldown', { defaultValue: '쿨다운 (초)' })}
                                hint="동일 규칙은 이 시간 내 재발송하지 않음"
                            >
                                <input
                                    type="number" min={0} max={86400}
                                    {...register('cooldown', { valueAsNumber: true })}
                                    className={inputCls}
                                />
                            </Field>
                        )}

                        {/* Compact inline IF expression (visible on all screen sizes) */}
                        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5 bg-slate-900 dark:bg-slate-950 rounded-xl border border-slate-700/60">
                            <span className="text-slate-500 font-mono text-xs">IF</span>
                            <code className="px-2 py-0.5 bg-sky-500/20 text-sky-300 rounded text-xs font-mono">{metricName}</code>
                            <code className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-xs font-mono">{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator}</code>
                            <code className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs font-mono">{watchedThreshold}{thresholdUnit}</code>
                            {isApiStatus ? (
                                <span className="text-slate-600 font-mono text-xs">PER REQUEST</span>
                            ) : isLog ? (
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
                    </FormStep>

                    {/* Step 3: Notify */}
                    <FormStep n={3} title="알림 (Notify)">
                        <Field label={t('alerts.rules.severity')}>
                            <div className="grid grid-cols-3 gap-2">
                                {(['critical', 'warning', 'info'] as const).map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setValue('severity', s)}
                                        className={`py-2.5 text-xs font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 uppercase tracking-wide ${
                                            watchedSeverity === s
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-slate-100 dark:border-ui-border-dark text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                            s === 'critical' ? 'bg-red-500' : s === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                                        }`} />
                                        {t(`alerts.rules.${s}`)}
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <Field
                            label={t('alerts.rules.notifyChannels')}
                            hint={watchedChannelIds.length === 0 && channels.length > 0 ? '* 미선택 시 모든 활성 채널로 발송됩니다' : null}
                        >
                            <div className="space-y-2">
                                {channels.length === 0 ? (
                                    <p className="text-sm text-slate-400">{t('alerts.rules.noChannels')}</p>
                                ) : channels.map(ch => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => handleToggleChannel(ch.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 border-2 rounded-xl transition-all ${
                                            watchedChannelIds.includes(ch.id)
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-100 dark:border-ui-border-dark text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <MaterialIcon name={ch.type === 'telegram' ? 'send' : 'sports_esports'} className="text-sm" />
                                        <span className="text-xs font-bold flex-1 text-left">{ch.name}</span>
                                        <span className="text-2xs uppercase tracking-wider text-slate-400 font-mono">{ch.type}</span>
                                    </button>
                                ))}
                            </div>
                        </Field>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-xs font-bold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide">
                                    <span className="text-sky-400 font-mono">"message"</span>
                                </label>
                                <span className="text-xs font-normal text-slate-400 normal-case">
                                    {t('alerts.rules.messageOverridesHint')}
                                </span>
                            </div>
                            <textarea
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                rows={2}
                                placeholder={buildDefaultMessage(watchedMetric, watchedOperator, watchedThreshold, watchedDuration)}
                                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-emerald-400 outline-none focus:border-primary resize-none placeholder:text-slate-600"
                            />
                            <p className="mt-1.5 text-xs text-slate-400 font-mono">
                                <span className="text-slate-500">// vars: </span>
                                {isApiStatus
                                    ? <span className="text-violet-400">{'{service_name}'} {'{method}'} {'{path}'} {'{status}'} {'{duration}'}</span>
                                    : isLog
                                    ? <span className="text-violet-400">{'{service_name}'} {'{level}'} {'{message}'}</span>
                                    : isEndpoint
                                    ? <span className="text-violet-400">{'{service_name}'} {'{value}'} {'{threshold}'} {'{metric}'}</span>
                                    : <span className="text-violet-400">{'{host_name}'} {'{value}'} {'{threshold}'} {'{metric}'} {'{duration}'}</span>
                                }
                            </p>
                        </div>
                    </FormStep>
                </div>

                {/* ── Right: sticky live preview (lg+) ─────────────────── */}
                <div className="hidden lg:block">
                    <div className="sticky top-6 space-y-4">

                        {/* Live preview card */}
                        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-ui-border-dark bg-slate-50/50 dark:bg-ui-hover-dark/30">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <div>
                                    <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-widest">라이브 미리보기</p>
                                    <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">입력값 변경 시 자동 갱신</p>
                                </div>
                            </div>
                            <div className="p-5 space-y-5">

                                {/* IF block */}
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">IF (조건)</p>
                                    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg px-4 py-3 font-mono text-xs leading-7">
                                        <div>
                                            <span className="text-sky-300">IF </span>
                                            <span className="text-amber-300">{metricName} </span>
                                            <span className="text-slate-400">{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator} </span>
                                            <span className="text-red-300">{watchedThreshold}{thresholdUnit}</span>
                                        </div>
                                        {isEndpoint && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">FAILS </span>
                                                <span className="text-violet-300">{watchedDuration}×</span>
                                            </div>
                                        )}
                                        {!isEndpoint && !isLog && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">FOR </span>
                                                <span className="text-violet-300">{watchedDuration} min</span>
                                            </div>
                                        )}
                                        {isLog && (
                                            <div className="pl-4">
                                                <span className="text-sky-300">PER </span>
                                                <span className="text-violet-300">event (immediate)</span>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-sky-300">ON </span>
                                            <span className="text-emerald-300 truncate">{targetLabel}</span>
                                        </div>
                                        {!isEndpoint && !isLog && (
                                            <div>
                                                <span className="text-sky-300">COOLDOWN </span>
                                                <span className="text-slate-400">{watchedCooldown}s</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* THEN block */}
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">THEN (메시지)</p>
                                    <div className={`border-l-4 pl-3 pr-3 py-3 rounded-r-lg ${severityClasses.border} ${severityClasses.bg}`}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wide ${severityClasses.badge}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${severityClasses.dot}`} />
                                                {watchedSeverity}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-text-muted-dark truncate">{watchedName || '<규칙 이름>'}</span>
                                        </div>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {customMessage || buildDefaultMessage(watchedMetric, watchedOperator, watchedThreshold, watchedDuration)}
                                        </p>
                                    </div>
                                </div>

                                {/* Channels */}
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                        발송 → {watchedChannelIds.length === 0 ? `${channels.length}개 채널 전체` : `${watchedChannelIds.length}개 선택`}
                                    </p>
                                    <div className="space-y-1.5">
                                        {channels.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">등록된 채널 없음</p>
                                        ) : previewChannels.slice(0, 5).map(ch => (
                                            <div key={ch.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-ui-hover-dark/50 rounded-lg">
                                                <MaterialIcon name={ch.type === 'telegram' ? 'send' : 'sports_esports'} className="text-sm text-slate-400" />
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex-1 truncate">{ch.name}</span>
                                                <span className="text-2xs text-slate-400 uppercase font-mono">{ch.type}</span>
                                            </div>
                                        ))}
                                        {previewChannels.length > 5 && (
                                            <p className="text-xs text-slate-400 italic pl-1">+{previewChannels.length - 5}개 더...</p>
                                        )}
                                    </div>
                                </div>

                                {/* JSON payload */}
                                <div>
                                    <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">JSON 페이로드</p>
                                    <div className="rounded-lg overflow-hidden border border-slate-700">
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border-b border-slate-700">
                                            <div className="flex gap-1">
                                                <span className="w-2 h-2 rounded-full bg-red-400" />
                                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                            </div>
                                            <span className="text-xs text-slate-500 font-mono ml-1">payload.json</span>
                                        </div>
                                        <div className="bg-slate-950 px-3 py-2.5 font-mono text-2xs leading-5 overflow-x-auto">
                                            <span className="text-slate-500">{'{'}</span>
                                            <div className="pl-3 space-y-px">
                                                <div><span className="text-sky-400">"type"</span><span className="text-slate-500">: </span><span className="text-emerald-400">"{isApiStatus ? 'api_request' : isLog ? 'log' : isEndpoint ? 'healthcheck' : 'resource'}"</span><span className="text-slate-500">,</span></div>
                                                <div><span className="text-sky-400">"{isEndpoint || isLog ? 'service' : 'host'}"</span><span className="text-slate-500">: </span><span className="text-yellow-300">"{targetLabel}"</span><span className="text-slate-500">,</span></div>
                                                <div><span className="text-sky-400">"metric"</span><span className="text-slate-500">: </span><span className="text-yellow-300">"{metricName}"</span><span className="text-slate-500">,</span></div>
                                                <div><span className="text-sky-400">"operator"</span><span className="text-slate-500">: </span><span className="text-yellow-300">"{OPERATOR_SYMBOLS[watchedOperator] ?? watchedOperator}"</span><span className="text-slate-500">,</span></div>
                                                <div><span className="text-sky-400">"threshold"</span><span className="text-slate-500">: </span><span className="text-pink-400">{watchedThreshold}</span><span className="text-slate-500">{thresholdUnit ? `,  // ${thresholdUnit}` : ','}</span></div>
                                                <div><span className="text-sky-400">"current"</span><span className="text-slate-500">: </span><span className="text-violet-400 italic">{'<live_value>'}</span><span className="text-slate-500">,</span></div>
                                                <div><span className="text-sky-400">"severity"</span><span className="text-slate-500">: </span><span className={watchedSeverity === 'critical' ? 'text-red-400' : watchedSeverity === 'warning' ? 'text-amber-400' : 'text-sky-400'}>"{watchedSeverity}"</span><span className="text-slate-500">,</span></div>
                                                <div className="flex items-start"><span className="text-sky-400 shrink-0">"message"</span><span className="text-slate-500 shrink-0">: "</span><span className={`wrap-break-word ${customMessage ? 'text-emerald-400' : 'text-slate-500 italic'}`}>{customMessage || 'auto-generated'}</span><span className="text-slate-500 shrink-0">"</span></div>
                                            </div>
                                            <span className="text-slate-500">{'}'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Eval path card */}
                        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4">
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">평가 경로</p>
                            <p className="text-xs text-slate-500 dark:text-text-muted-dark font-mono leading-relaxed whitespace-pre-wrap">
                                {getEvalPath(watchedCategory, watchedMetric)}
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </form>
    );
}
