import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { MaterialIcon } from '../../../components/common';
import { useSidePanel } from '../../../contexts/SidePanelContext';
import { api } from '../../../services/api';

interface LogServiceFormProps {
    onSuccess: () => void;
}

export function LogServiceForm({ onSuccess }: LogServiceFormProps) {
    const { t } = useTranslation(['logs', 'common']);
    const navigate = useNavigate();
    const { closePanel } = useSidePanel();
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState<{ id?: string; name?: string }>({});

    const validate = (): boolean => {
        const newErrors: { id?: string; name?: string } = {};
        if (!id || id.length < 2) {
            newErrors.id = t('logServices.validation.idRequired', { defaultValue: 'Service ID is required (min 2 chars)' });
        } else if (!/^[a-z0-9-]+$/.test(id)) {
            newErrors.id = t('logServices.validation.idFormat', { defaultValue: 'Only lowercase letters, numbers, and hyphens' });
        }
        if (!name || name.length < 2) {
            newErrors.name = t('logServices.validation.nameRequired', { defaultValue: 'Name is required (min 2 chars)' });
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setSubmitting(true);
        try {
            const created = await api.createService({
                id,
                name,
                type: 'log',
            });
            onSuccess();
            closePanel();
            navigate(`/logs/${id}?tab=integration`, {
                state: { newApiKey: created.apiKey },
            });
            toast.success(t('logServices.toast.createdGuide', { defaultValue: 'Service created! Copy the integration code below to start collecting logs.' }), { duration: 5000 });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('logServices.toast.createFailed', { defaultValue: 'Failed to create log service' }));
        } finally {
            setSubmitting(false);
        }
    };

    const getInputClassName = (hasError: boolean) =>
        `w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`;

    return (
        <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-6 pb-4 custom-scrollbar">
        <div className="space-y-6">
            {/* Info Banner */}
            <div className="flex gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <MaterialIcon name="info" className="text-primary text-xl flex-shrink-0" />
                <div className="text-sm">
                    <p className="font-bold text-slate-800 dark:text-text-base-dark mb-1">{t('logServices.add.infoTitle', { defaultValue: 'Log Collection Service' })}</p>
                    <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                        {t('logServices.add.infoDesc', { defaultValue: 'Create a service to collect error logs via logging library HTTP Appenders (Winston, Logback, etc.). An API key will be generated automatically.' })}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Service ID */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('common.id')}
                    </label>
                    <input
                        type="text"
                        value={id}
                        onChange={(e) => {
                            setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                            setErrors((prev) => ({ ...prev, id: undefined }));
                        }}
                        placeholder="my-api-server"
                        className={getInputClassName(!!errors.id)}
                    />
                    {errors.id ? (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.id}
                        </p>
                    ) : (
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MaterialIcon name="info" className="text-xs" />
                            {t('logServices.validation.idFormat')}
                        </p>
                    )}
                </div>

                {/* Service Name */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t('common.name')}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            setErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        placeholder="My API Server"
                        className={getInputClassName(!!errors.name)}
                    />
                    {errors.name && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <MaterialIcon name="error" className="text-sm" />
                            {errors.name}
                        </p>
                    )}
                </div>
            </div>

        </div>
        </div>
        <div className="flex-none border-t border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark px-6 py-4 flex gap-3">
            <button
                onClick={closePanel}
                className="flex-1 py-3 rounded-lg border border-slate-200 dark:border-ui-border-dark text-slate-600 dark:text-text-muted-dark font-bold hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-all"
            >
                {t('common.cancel')}
            </button>
            <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        <MaterialIcon name="save" className="text-lg" />
                        {t('common.save')}
                    </>
                )}
            </button>
        </div>
        </>
    );
}
