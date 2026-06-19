import { useState, useRef, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api, Host, type SSHTestResult } from '../../../services/api';

const hostSchema = z.object({
    id: z.string().min(2, 'ID is too short').regex(/^[a-z0-9-]+$/, 'Lower case letters, numbers, and hyphens only'),
    name: z.string().min(2, 'Name is too short'),
    type: z.enum(['local', 'remote']),
    resourceCategory: z.enum(['server', 'database', 'container']).optional(),
    ip: z.string().min(1, 'IP is required'),
    port: z.coerce.number().optional(),
    group: z.string().optional(),
    description: z.string().optional(),
    sshUser: z.string().optional(),
    sshPort: z.coerce.number().optional(),
    sshAuthType: z.enum(['password', 'key', 'key_file']).optional(),
    sshPassword: z.string().optional(),
    sshKey: z.string().optional(),
    sshKeyPath: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'remote') {
        if (!data.sshUser || data.sshUser.trim() === '') {
            ctx.addIssue({ code: 'custom', message: 'SSH User is required', path: ['sshUser'] });
        }
        if (!data.sshAuthType) {
            ctx.addIssue({ code: 'custom', message: 'Auth type is required', path: ['sshAuthType'] });
        }
        if (data.sshAuthType === 'password' && (!data.sshPassword || data.sshPassword.trim() === '')) {
            // For edit mode, password can be empty (meaning no change)
        }
    }
});

type HostFormValues = z.infer<typeof hostSchema>;

interface InfraFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    host?: Host;
    onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function InfraForm({ onSuccess, onCancel, host, onSubmittingChange }: InfraFormProps) {
    const { t } = useTranslation(['infra', 'common']);
    const isEditMode = !!host;

    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<SSHTestResult | null>(null);
    const [testError, setTestError] = useState<string | null>(null);
    const [ppkWarning, setPpkWarning] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const {
        register,
        handleSubmit,
        watch,
        reset,
        getValues,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<HostFormValues>({
        resolver: zodResolver(hostSchema) as any,
        defaultValues: {
            type: 'remote',
            resourceCategory: 'server',
            group: 'default',
            sshAuthType: 'password',
        },
    });

    const selectedType = watch('type');
    const selectedAuthType = watch('sshAuthType');
    const selectedCategory = watch('resourceCategory');
    const watchedName = watch('name');
    const watchedIp = watch('ip');
    const watchedGroup = watch('group');

    useEffect(() => {
        if (host) {
            reset({
                id: host.id,
                name: host.name,
                type: host.type as 'local' | 'remote',
                resourceCategory: (host.resourceCategory as any) || 'server',
                ip: host.ip,
                port: host.port || undefined,
                group: host.group || '',
                description: host.description || '',
                sshUser: host.sshUser || '',
                sshPort: host.sshPort || undefined,
                sshAuthType: (host.sshAuthType as any) || 'password',
                sshPassword: '',
                sshKey: '',
                sshKeyPath: host.sshKeyPath || '',
            });
        }
    }, [host, reset]);

    const handleKeyFile = useCallback((file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content.includes('PuTTY-User-Key-File')) {
                setPpkWarning(true);
                return;
            }
            setPpkWarning(false);
            setValue('sshKey', content.trim());
        };
        reader.readAsText(file);
    }, [setValue]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleKeyFile(file);
    }, [handleKeyFile]);

    const handleTestConnection = async () => {
        const values = getValues();
        if (!values.ip || !values.sshUser) {
            toast.error(t('infra.modal.testRequiredFields'));
            return;
        }
        if (isEditMode && values.sshAuthType === 'password' && !values.sshPassword) {
            toast.error(t('infra.modal.editModePasswordRequired'));
            return;
        }
        setIsTesting(true);
        setTestResult(null);
        setTestError(null);
        try {
            const result = await api.testSSHConnection({
                ip: values.ip,
                sshPort: Number(values.sshPort) || 22,
                sshUser: values.sshUser,
                sshAuthType: values.sshAuthType,
                sshPassword: values.sshPassword,
                sshKey: values.sshKey,
                sshKeyPath: values.sshKeyPath,
            });
            setTestResult(result);
            toast.success(t('infra.modal.connectionSuccess'));
        } catch (error) {
            const msg = getErrorMessage(error);
            setTestError(msg);
            toast.error(msg);
        } finally {
            setIsTesting(false);
        }
    };

    const onSubmit = async (data: HostFormValues) => {
        onSubmittingChange?.(true);
        try {
            if (isEditMode && host) {
                const submitData = { ...data };
                if (!submitData.sshPassword) delete submitData.sshPassword;
                if (!submitData.sshKey) delete submitData.sshKey;
                await api.updateHost(host.id, submitData as any);
            } else {
                await api.createHost(data as any);
            }
            toast.success(t(isEditMode ? 'infra.toast.updated' : 'infra.toast.created'));
            onSuccess();
            onCancel();
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    const inputClass = (hasError?: boolean) =>
        `w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`;

    return (
        <>
        <form
            id="infra-form"
            onSubmit={handleSubmit(onSubmit)}
            className="px-6 py-6 min-h-full"
        >
        <div className="max-w-350 mx-auto grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
            <div className="space-y-6 min-w-0">
            <div className="space-y-4">
                <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200 dark:border-ui-border-dark">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="info" className="text-primary text-base" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-text-base-dark">{t('infra.sections.basicInfo')}</h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('infra.form.basicInfoDesc')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.id')}</label>
                        <input
                            {...register('id')}
                            placeholder={t('infra.modal.hostIdPlaceholder')}
                            disabled={isEditMode}
                            className={`${inputClass(!!errors.id)} ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {errors.id ? (
                            <p className="text-sm text-red-500 font-medium">{errors.id.message}</p>
                        ) : (
                            <p className="text-sm text-slate-400">{t('infra.modal.idHint')}</p>
                        )}
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.name')}</label>
                        <input
                            {...register('name')}
                            placeholder={t('infra.modal.hostNamePlaceholder')}
                            className={inputClass(!!errors.name)}
                        />
                        {errors.name && <p className="text-sm text-red-500 font-medium">{errors.name.message}</p>}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('common.type')}</label>
                    <div className="flex gap-2">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${selectedType === 'local' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}>
                            <input {...register('type')} type="radio" value="local" className="hidden" />
                            <MaterialIcon name="computer" className="text-lg" />
                            {t('infra.connectionTypes.local')}
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${selectedType === 'remote' ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}>
                            <input {...register('type')} type="radio" value="remote" className="hidden" />
                            <MaterialIcon name="cloud" className="text-lg" />
                            {t('infra.connectionTypes.remote')}
                        </label>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.resourceCategory')}</label>
                    <div className="flex gap-2">
                        {([
                            { value: 'server', icon: 'dns', label: t('infra.resourceTypes.server') },
                            { value: 'database', icon: 'storage', label: t('infra.resourceTypes.database') },
                            { value: 'container', icon: 'deployed_code', label: t('infra.resourceTypes.container') },
                        ] as const).map(({ value, icon, label }) => (
                            <label
                                key={value}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border cursor-pointer transition-all text-sm ${watch('resourceCategory') === value ? 'bg-primary/10 border-primary text-primary font-bold' : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'}`}
                            >
                                <input {...register('resourceCategory')} type="radio" value={value} className="hidden" />
                                <MaterialIcon name={icon} className="text-lg" />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
                </div>
            </div>

            <div className="space-y-4 pt-2">
                <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-200 dark:border-ui-border-dark">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="settings_ethernet" className="text-primary text-base" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-text-base-dark">{t('infra.modal.sshSettings')}</h3>
                        <p className="text-sm text-slate-500 dark:text-text-muted-dark">{t('infra.form.connectionDesc')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.ipAddress')}</label>
                        <input
                            {...register('ip')}
                            placeholder={t('infra.modal.ipPlaceholder')}
                            className={inputClass(!!errors.ip)}
                        />
                        {errors.ip && <p className="text-sm text-red-500 font-medium">{errors.ip.message}</p>}
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.port')}</label>
                        <input
                            {...register('port')}
                            type="number"
                            placeholder={t('infra.modal.portPlaceholder')}
                            className={inputClass(!!errors.port)}
                        />
                        <p className="text-sm text-slate-400">{t('infra.modal.portHint')}</p>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.group')}</label>
                    <input
                        {...register('group')}
                        placeholder={t('infra.modal.groupPlaceholder')}
                        className={inputClass(!!errors.group)}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.description')}</label>
                    <textarea
                        {...register('description')}
                        placeholder={t('infra.modal.descriptionPlaceholder')}
                        rows={2}
                        className={`${inputClass(!!errors.description)} resize-none`}
                    />
                </div>

                {selectedType === 'remote' && (
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-ui-border-dark">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-1">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.sshUser')}</label>
                                <input
                                    {...register('sshUser')}
                                    placeholder={t('infra.modal.sshUserPlaceholder')}
                                    className={inputClass(!!errors.sshUser)}
                                />
                                {errors.sshUser && <p className="text-sm text-red-500 font-medium">{errors.sshUser.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.sshPort')}</label>
                                <input
                                    {...register('sshPort')}
                                    type="number"
                                    placeholder="22"
                                    className={inputClass(!!errors.sshPort)}
                                />
                                <p className="text-sm text-slate-400">{t('infra.modal.sshPortHint')}</p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.authType')}</label>
                            <div className="flex gap-2">
                                {(['password', 'key', 'key_file'] as const).map((authType) => (
                                    <label
                                        key={authType}
                                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg border cursor-pointer transition-all text-sm ${selectedAuthType === authType
                                                ? 'bg-primary/10 border-primary text-primary font-bold'
                                                : 'bg-slate-50 dark:bg-ui-hover-dark border-slate-200 dark:border-ui-border-dark text-slate-500'
                                            }`}
                                    >
                                        <input {...register('sshAuthType')} type="radio" value={authType} className="hidden" />
                                        <MaterialIcon
                                            name={authType === 'password' ? 'password' : authType === 'key' ? 'vpn_key' : 'folder'}
                                            className="text-base"
                                        />
                                        {t(`infra.modal.auth${authType === 'password' ? 'Password' : authType === 'key' ? 'Key' : 'KeyFile'}`)}
                                    </label>
                                ))}
                            </div>
                        </div>

                        {selectedAuthType === 'password' && (
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.password')}</label>
                                <input
                                    {...register('sshPassword')}
                                    type="password"
                                    placeholder={isEditMode ? t('infra.modal.passwordChangePlaceholder') : t('infra.modal.passwordPlaceholder')}
                                    className={inputClass(!!errors.sshPassword)}
                                />
                                {isEditMode && (
                                    <p className="text-sm text-slate-400">{t('infra.modal.editModePasswordRequired')}</p>
                                )}
                            </div>
                        )}

                        {selectedAuthType === 'key' && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.sshKey')}</label>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                                    >
                                        <MaterialIcon name="upload_file" className="text-base" />
                                        {t('infra.modal.sshKeyBrowse')}
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleKeyFile(file);
                                            e.target.value = '';
                                        }}
                                    />
                                </div>
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`relative rounded-xl border-2 border-dashed transition-all ${isDragging
                                            ? 'border-primary bg-primary/5'
                                            : errors.sshKey ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'
                                        }`}
                                >
                                    <textarea
                                        {...register('sshKey')}
                                        placeholder={isEditMode ? t('infra.modal.sshKeyChangePlaceholder') : t('infra.modal.sshKeyPlaceholder')}
                                        rows={4}
                                        className="w-full px-4 py-3 bg-transparent outline-none resize-none font-mono text-sm dark:text-white"
                                    />
                                </div>
                                {ppkWarning && (
                                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                                        <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center">
                                            <MaterialIcon name="warning" className="text-sm leading-none text-amber-500" />
                                        </span>
                                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">{t('infra.modal.sshKeyPpkDetected')}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {selectedAuthType === 'key_file' && (
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">{t('infra.modal.sshKeyPath')}</label>
                                <input
                                    {...register('sshKeyPath')}
                                    placeholder={t('infra.modal.sshKeyPathPlaceholder')}
                                    className={inputClass(!!errors.sshKeyPath)}
                                />
                            </div>
                        )}

                    </div>
                )}
                </div>
            </div>
            </div>

            <aside className="xl:sticky xl:top-6 space-y-4">
                <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <MaterialIcon
                                name={selectedCategory === 'database' ? 'storage' : selectedCategory === 'container' ? 'deployed_code' : 'dns'}
                                className="text-primary text-xl"
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {watchedName || t('infra.modal.hostNamePlaceholder')}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-text-muted-dark truncate">
                                {watchedIp || t('infra.modal.ipPlaceholder')}
                            </p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <SummaryRow label={t('common.type')} value={selectedType === 'remote' ? t('infra.connectionTypes.remote') : t('infra.connectionTypes.local')} />
                        <SummaryRow label={t('infra.modal.resourceCategory')} value={t(`infra.resourceTypes.${selectedCategory || 'server'}`)} />
                        <SummaryRow label={t('infra.modal.group')} value={watchedGroup || t('common.none')} />
                        {selectedType === 'remote' && (
                            <SummaryRow label={t('infra.modal.authType')} value={t(`infra.modal.auth${selectedAuthType === 'password' ? 'Password' : selectedAuthType === 'key' ? 'Key' : 'KeyFile'}`)} />
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <MaterialIcon
                            name={testResult ? 'check_circle' : testError ? 'error' : 'cable'}
                            className={`text-lg ${testResult ? 'text-emerald-500' : testError ? 'text-red-500' : 'text-slate-400'}`}
                        />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {t('infra.modal.testConnection')}
                        </h3>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-text-muted-dark leading-relaxed">
                        {selectedType === 'remote'
                            ? t('infra.form.testHint')
                            : t('infra.modal.localAutoManaged')}
                    </p>
                    {selectedType === 'remote' && (
                        <>
                            <button
                                type="button"
                                onClick={handleTestConnection}
                                disabled={isTesting}
                                className="mt-4 w-full py-2.5 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-700 dark:text-text-secondary-dark font-bold text-sm hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isTesting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                                        {t('infra.modal.testing')}
                                    </>
                                ) : (
                                    <>
                                        <MaterialIcon name="cable" className="text-base" />
                                        {t('infra.modal.testConnection')}
                                    </>
                                )}
                            </button>

                            {testResult && (
                                <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-2">
                                        <MaterialIcon name="check_circle" className="text-lg" />
                                        {t('infra.modal.connectionSuccess')}
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-text-muted-dark space-y-1 font-medium">
                                        {testResult.hostname && <p>Hostname: {testResult.hostname}</p>}
                                        {testResult.platform && <p>OS: {testResult.platform}</p>}
                                        <p>{t('infra.modal.latency')}: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{testResult.latencyMs}ms</span></p>
                                    </div>
                                </div>
                            )}

                            {testError && (
                                <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm mb-1">
                                        <MaterialIcon name="error" className="text-lg" />
                                        {t('infra.modal.connectionFailed')}
                                    </div>
                                    <p className="text-sm text-red-500/80 font-medium leading-relaxed">{testError}</p>
                                </div>
                            )}
                        </>
                    )}
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
