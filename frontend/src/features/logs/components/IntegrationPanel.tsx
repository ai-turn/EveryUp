import { useState, useEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { api, Service } from '../../../services/api';
import { buildOTelSnippets } from './integrationSnippets';

interface IntegrationPanelProps {
  service: Service;
  temporaryApiKey?: string | null;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
}

type OTelLanguage = 'springboot' | 'python' | 'nodejs';

function CodeBlock({
  code,
  onCopy,
  copyTitle,
  size = 'sm',
  minHeight,
}: {
  code: string;
  onCopy: () => void;
  copyTitle: string;
  size?: 'xs' | 'sm';
  minHeight?: string;
}) {
  return (
    <div className="relative">
      <pre
        className={`p-4 bg-slate-900 dark:bg-slate-950 rounded-lg overflow-x-auto leading-relaxed whitespace-pre ${
          size === 'xs' ? 'text-xs text-slate-300' : 'text-sm text-slate-200'
        }`}
        style={minHeight ? { minHeight } : undefined}
      >
        <code>{code}</code>
      </pre>
      <button
        onClick={onCopy}
        title={copyTitle}
        aria-label={copyTitle}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700/80 hover:bg-slate-600 transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
      >
        <MaterialIcon name="content_copy" className="text-sm" />
      </button>
    </div>
  );
}

function SectionTitle({
  number,
  title,
  description,
  trailing,
}: {
  number: number;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 dark:bg-primary/15 text-primary text-xs font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg w-fit">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          aria-pressed={value === opt.key}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
            value === opt.key
              ? 'bg-white dark:bg-ui-active-dark text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function IntegrationPanel({ service, temporaryApiKey, onApiKeyRegenerated }: IntegrationPanelProps) {
  const { t } = useTranslation(['logs', 'common']);
  const { copy } = useCopyToClipboard();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [otelSnippet, setOtelSnippet] = useState<OTelLanguage>('springboot');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskedKey = service.apiKeyMasked || 'Not available';
  const plainKey = revealedKey || temporaryApiKey || service.apiKey || null;
  const displayKey = plainKey || '<YOUR_API_KEY>';
  const origin = window.location.origin;

  const otelSnippets = buildOTelSnippets(origin, displayKey);
  const otelEndpointUrl = `${origin}/api/v1/otlp`;

  const dismissRevealedKey = useCallback(() => {
    setRevealedKey(null);
    setRevealCountdown(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!revealedKey) return;
    setRevealCountdown(10);
    timerRef.current = setInterval(() => {
      setRevealCountdown((prev) => {
        if (prev <= 1) {
          dismissRevealedKey();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [revealedKey, dismissRevealedKey]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setShowConfirm(false);
    try {
      const { apiKey: newKey, apiKeyMasked: newMasked } = await api.regenerateServiceApiKey(service.id);
      onApiKeyRegenerated(newKey, newMasked);
      setRevealedKey(newKey);
      toast.success(t('logServices.integration.toast.apiKeyRegenerated'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="key" className="text-base text-primary" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('logServices.integration.apiKey.title')}
            </h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-text-dim-dark bg-slate-100 dark:bg-ui-active-dark px-2 py-0.5 rounded-md">
              {t('logServices.integration.apiKey.masked')}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm border border-slate-100 dark:border-ui-border-dark">
            <MaterialIcon name="lock" className="text-sm text-slate-400 dark:text-text-dim-dark shrink-0" />
            <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate select-all">
              {plainKey || maskedKey}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => plainKey && copy(plainKey)}
              disabled={!plainKey}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark text-xs font-semibold text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <MaterialIcon name="content_copy" className="text-sm" />
              {t('logServices.integration.apiKey.copyVisible')}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 cursor-pointer"
            >
              <MaterialIcon name={isRegenerating ? 'sync' : 'refresh'} className={`text-sm ${isRegenerating ? 'animate-spin' : ''}`} />
              {t('logServices.integration.apiKey.regenerate')}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="upload" className="text-base text-primary" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('logServices.integration.endpoint.title')}
            </h3>
            <span className="ml-auto text-xs font-bold text-white bg-emerald-600 px-2 py-0.5 rounded">
              POST
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-xs border border-slate-100 dark:border-ui-border-dark">
            <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">
              {otelEndpointUrl}
            </span>
            <button
              onClick={() => copy(otelEndpointUrl)}
              className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={t('common.copyToClipboard')}
              aria-label={t('common.copyToClipboard')}
            >
              <MaterialIcon name="content_copy" className="text-sm" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="auto_awesome" className="text-sm text-primary" />
            {t('logServices.integration.endpoint.otelDescription')}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
        <SectionTitle
          number={1}
          title={t('logServices.integration.setup.otelTitle')}
          description={t('logServices.integration.setup.otelDesc')}
        />

        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
            <span className="w-4 h-5 shrink-0 inline-flex items-center justify-center">
              <MaterialIcon name="info" className="text-base leading-none text-primary" />
            </span>
            <p className="text-xs text-slate-600 dark:text-text-muted-dark leading-5">
              {t('logServices.integration.setup.otelHint')}
            </p>
          </div>
          <SegmentedControl
            options={[
              { key: 'springboot' as const, label: 'Spring Boot' },
              { key: 'python' as const, label: 'Python' },
              { key: 'nodejs' as const, label: 'Node.js' },
            ]}
            value={otelSnippet}
            onChange={setOtelSnippet}
          />
          <CodeBlock
            code={otelSnippets[otelSnippet]}
            onCopy={() => copy(otelSnippets[otelSnippet])}
            copyTitle={t('common.copyToClipboard')}
            size="xs"
            minHeight="320px"
          />
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30">
                <MaterialIcon name="warning" className="text-xl text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('logServices.integration.modals.regenerateTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('logServices.integration.modals.regenerateDesc')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold text-sm hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer"
              >
                {t('logServices.integration.apiKey.regenerate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/30">
                <MaterialIcon name="key" className="text-xl text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('logServices.integration.modals.newKeyTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('logServices.integration.modals.newKeyDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4 border border-slate-100 dark:border-ui-border-dark">
              <span className="flex-1 text-slate-700 dark:text-text-base-dark break-all select-all">
                {revealedKey}
              </span>
              <button
                onClick={() => copy(revealedKey)}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark cursor-pointer"
                title={t('common.copyToClipboard')}
              >
                <MaterialIcon name="content_copy" className="text-base" />
              </button>
            </div>

            <button
              onClick={dismissRevealedKey}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {t('logServices.integration.modals.done')}
              {revealCountdown > 0 && ` (${revealCountdown}s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
