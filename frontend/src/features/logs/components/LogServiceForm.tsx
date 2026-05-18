import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { api } from '../../../services/api';

interface LogServiceFormProps {
    onSuccess: () => void;
    onCancel: () => void;
    onSubmittingChange?: (isSubmitting: boolean) => void;
}

export function LogServiceForm({ onSuccess, onCancel, onSubmittingChange }: LogServiceFormProps) {
    const { t } = useTranslation(['logs', 'common']);
    const navigate = useNavigate();
    const [id, setId] = useState('');
    const [name, setName] = useState('');
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

        onSubmittingChange?.(true);
        try {
            const created = await api.createService({
                id,
                name,
                type: 'log',
            });
            onSuccess();
            onCancel();
            navigate(`/logs/${id}?tab=integration`, {
                state: { newApiKey: created.apiKey },
            });
            toast.success(t('logServices.toast.createdGuide', { defaultValue: 'Service created! Copy the integration code below to start collecting logs.' }), { duration: 5000 });
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            onSubmittingChange?.(false);
        }
    };

    const getInputClassName = (hasError: boolean) =>
        `w-full px-4 py-2 bg-slate-50 dark:bg-ui-hover-dark border ${hasError ? 'border-red-500' : 'border-slate-200 dark:border-ui-border-dark'} rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm dark:text-white`;

    return (
        <>
        <form
            id="log-service-form"
            onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
            }}
            className="px-6 py-6 min-h-full"
        >
        <div className="max-w-350 mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <div className="space-y-6 min-w-0">
            <div className="flex gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                <MaterialIcon name="info" className="text-primary text-xl shrink-0" />
                <div className="text-sm">
                    <p className="font-bold text-slate-800 dark:text-text-base-dark mb-1">{t('logServices.add.infoTitle', { defaultValue: 'Log Collection Service' })}</p>
                    <p className="text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                        {t('logServices.add.infoDesc', { defaultValue: 'Create a log service to generate an API key automatically. Then connect your app with OpenTelemetry in the Integration tab.' })}
                    </p>
                </div>
            </div>

            <div className="space-y-4">
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
        <aside className="lg:sticky lg:top-6 space-y-4">
            <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MaterialIcon name="article" className="text-primary text-xl" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {name || t('logServices.add.title')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-text-muted-dark truncate">
                            {id || 'my-api-server'}
                        </p>
                    </div>
                </div>
                <div className="space-y-2 text-xs text-slate-500 dark:text-text-muted-dark leading-relaxed">
                    <p>{t('logServices.add.infoDesc', { defaultValue: 'Create a log service to generate an API key automatically. Then choose an integration method and connect your app.' })}</p>
                </div>
            </div>
        </aside>
        </div>
        </form>
        </>
    );
}
