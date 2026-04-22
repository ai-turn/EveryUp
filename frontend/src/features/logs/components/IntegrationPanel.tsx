import { useState, useEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { api, Service } from '../../../services/api';
import {
  buildHttpAppenderSnippets,
  buildAgentSnippets,
  buildNginxSnippets,
  buildAgentQuickStart,
  buildAgentPullCommand,
} from './integrationSnippets';

interface IntegrationPanelProps {
  service: Service;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
}

type IntegrationPath = 'agent' | 'http-appender';

interface PathOption {
  key: IntegrationPath;
  icon: string;
  labelKey: string;
  taglineKey: string;
  descriptionKey: string;
  recommended?: boolean;
  goodForKey: string;
}

const PATH_OPTIONS: PathOption[] = [
  {
    key: 'agent',
    icon: 'dns',
    labelKey: 'logServices.integration.paths.agent.label',
    taglineKey: 'logServices.integration.paths.agent.tagline',
    descriptionKey: 'logServices.integration.paths.agent.description',
    recommended: true,
    goodForKey: 'logServices.integration.paths.agent.goodFor',
  },
  {
    key: 'http-appender',
    icon: 'code',
    labelKey: 'logServices.integration.paths.httpAppender.label',
    taglineKey: 'logServices.integration.paths.httpAppender.tagline',
    descriptionKey: 'logServices.integration.paths.httpAppender.description',
    goodForKey: 'logServices.integration.paths.httpAppender.goodFor',
  },
];

function ConnectionStatusBadge({
  state,
  secondsAgo,
  t,
}: {
  state: 'waiting' | 'connected' | 'error';
  secondsAgo: number | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (state === 'connected') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold"
        aria-live="polite"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {secondsAgo === null || secondsAgo > 60
          ? t('logServices.integration.status.connected')
          : t('logServices.integration.status.receivedAgo', { seconds: secondsAgo })}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold"
        aria-live="polite"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        {t('logServices.integration.status.testFailed')}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark text-xs font-semibold"
      aria-live="polite"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
      {t('logServices.integration.status.waiting')}
    </span>
  );
}

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

function PathPicker({
  onSelect,
  t,
}: {
  onSelect: (path: IntegrationPath) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-primary/70 mb-1">
          {t('logServices.integration.picker.eyebrow')}
        </p>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('logServices.integration.picker.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-1">
          {t('logServices.integration.picker.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {PATH_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onSelect(option.key)}
            className={`relative text-left p-5 rounded-xl bg-white dark:bg-bg-surface-dark border transition-all cursor-pointer hover:border-primary hover:shadow-lg ${
              option.recommended
                ? 'border-primary shadow-sm shadow-primary/10'
                : 'border-slate-200 dark:border-ui-border-dark'
            }`}
          >
            {option.recommended && (
              <span className="absolute top-4 right-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold tracking-wide">
                <MaterialIcon name="auto_awesome" className="text-xs" />
                {t('logServices.integration.picker.recommended')}
              </span>
            )}

            <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
              <MaterialIcon name={option.icon} className="text-xl" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t(option.labelKey)}
            </h3>
            <p className="text-sm font-semibold text-primary mt-1">{t(option.taglineKey)}</p>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-3 leading-relaxed">
              {t(option.descriptionKey)}
            </p>

            <div className="pt-4 mt-4 border-t border-dashed border-slate-200 dark:border-ui-border-dark">
              <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-text-dim-dark mb-2">
                {t('logServices.integration.picker.goodFor')}
              </p>
              <div className="space-y-1.5">
                {(t(option.goodForKey, { returnObjects: true }) as unknown as string[]).map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-xs text-slate-600 dark:text-text-muted-dark"
                  >
                    <MaterialIcon name="check" className="text-sm text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-1 mt-5 text-sm font-semibold text-primary">
              {t('logServices.integration.picker.start')}
              <MaterialIcon name="chevron_right" className="text-base" />
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark">
        <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-500 dark:text-text-muted-dark flex items-center justify-center shrink-0">
          <MaterialIcon name="help_outline" className="text-lg" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-white">
            {t('logServices.integration.picker.notSureTitle')}
          </p>
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-1 leading-relaxed">
            {t('logServices.integration.picker.notSureDesc')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function IntegrationPanel({ service, onApiKeyRegenerated }: IntegrationPanelProps) {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('common');
  const { copy } = useCopyToClipboard();
  const [selectedPath, setSelectedPath] = useState<IntegrationPath | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [httpSnippet, setHttpSnippet] = useState<'express' | 'springboot' | 'aspnet' | 'fastapi'>('express');
  const [agentSnippet, setAgentSnippet] = useState<'config' | 'docker_sidecar' | 'docker_pipe' | 'systemd'>('config');
  const [activeNginxTab, setActiveNginxTab] = useState<'nginx_conf' | 'docker_compose' | 'docker_run'>('nginx_conf');
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [showAgentAdvanced, setShowAgentAdvanced] = useState(false);
  const [testState, setTestState] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [latestLogAt, setLatestLogAt] = useState<Date | null>(null);
  const [, setNowTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const logs = await api.getServiceLogs(service.id, { limit: '1' });
        if (cancelled) return;
        if (logs.length > 0 && logs[0].createdAt) {
          setLatestLogAt(new Date(logs[0].createdAt));
          setTestState('connected');
        }
      } catch {
        // Connection status is a convenience only.
      }
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [service.id]);

  useEffect(() => {
    const tick = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  const secondsAgo = latestLogAt
    ? Math.max(0, Math.floor((Date.now() - latestLogAt.getTime()) / 1000))
    : null;

  const selectedOption = PATH_OPTIONS.find((option) => option.key === selectedPath);
  const maskedKey = service.apiKeyMasked || 'Not available';
  const ingestUrl = `${window.location.origin}/api/v1/logs/ingest`;
  const displayKey = revealedKey || service.apiKey || '<YOUR_API_KEY>';
  const realApiKey = revealedKey || service.apiKey || null;
  const hostname = window.location.hostname;
  const port = window.location.port || '443';
  const isHttps = window.location.protocol === 'https:';
  const origin = window.location.origin;

  const httpAppenderSnippets = buildHttpAppenderSnippets(hostname, port, isHttps, displayKey, ingestUrl);
  const agentSnippets = buildAgentSnippets(hostname, port, isHttps, displayKey, origin);
  const nginxSnippets = buildNginxSnippets(hostname);
  const agentPullCmd = buildAgentPullCommand();
  const agentQuickStartCmd = buildAgentQuickStart(displayKey, origin);

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

  const curlCmd = `curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`;

  const handleBrowserTest = async () => {
    if (!realApiKey) {
      toast.error(t('logServices.integration.toast.regenerateFirst'));
      return;
    }

    setTestState('waiting');
    try {
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${realApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: 'info',
          message: 'Connection test',
          metadata: { source: 'integration-panel', serviceId: service.id },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const now = new Date();
      setLatestLogAt(now);
      setTestState('connected');
      toast.success(t('logServices.integration.toast.testLogSent'));
    } catch (error) {
      setTestState('error');
      toast.error(getErrorMessage(error));
    }
  };

  if (!selectedPath || !selectedOption) {
    return <PathPicker onSelect={setSelectedPath} t={t} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MaterialIcon name={selectedOption.icon} className="text-xl" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-text-dim-dark">
            {t('logServices.integration.selectedMethod')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t(selectedOption.labelKey)}
            </h2>
            {selectedOption.recommended && (
              <span className="inline-flex px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">
                {t('logServices.integration.picker.recommended')}
              </span>
            )}
            <span className="text-xs text-slate-500 dark:text-text-muted-dark">
              {t(selectedOption.taglineKey)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setSelectedPath(null)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-xs font-semibold text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors cursor-pointer"
        >
          <MaterialIcon name="swap_horiz" className="text-sm" />
          {t('logServices.integration.changeMethod')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MaterialIcon name="key" className="text-base text-primary" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('logServices.integration.apiKey.title')}
            </h3>
            <span className="ml-auto text-[10px] font-semibold text-slate-400 dark:text-text-dim-dark bg-slate-100 dark:bg-ui-active-dark px-2 py-0.5 rounded-md">
              {t('logServices.integration.apiKey.masked')}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm border border-slate-100 dark:border-ui-border-dark">
            <MaterialIcon name="lock" className="text-sm text-slate-400 dark:text-text-dim-dark shrink-0" />
            <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate select-all">
              {revealedKey || maskedKey}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => copy(revealedKey || maskedKey)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-ui-border-dark text-xs font-semibold text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark cursor-pointer"
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
            <span className="ml-auto text-[10px] font-bold text-white bg-emerald-600 px-2 py-0.5 rounded">
              POST
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-xs border border-slate-100 dark:border-ui-border-dark">
            <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">{ingestUrl}</span>
            <button
              onClick={() => copy(ingestUrl)}
              className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title={tc('common.copyToClipboard')}
              aria-label={tc('common.copyToClipboard')}
            >
              <MaterialIcon name="content_copy" className="text-sm" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="auto_awesome" className="text-sm text-primary" />
            {t('logServices.integration.endpoint.description')}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
        <SectionTitle
          number={1}
          title={t('logServices.integration.test.title')}
          description={t('logServices.integration.test.description')}
          trailing={<ConnectionStatusBadge state={testState} secondsAgo={secondsAgo} t={t} />}
        />
        <CodeBlock
          code={curlCmd}
          onCopy={() => copy(curlCmd)}
          copyTitle={tc('common.copyToClipboard')}
          size="sm"
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleBrowserTest}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <MaterialIcon name="send" className="text-sm" />
            {t('logServices.integration.test.browserButton')}
          </button>
          <button
            onClick={() => setShowTroubleshooting((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-xs font-semibold text-slate-600 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors cursor-pointer"
          >
            <MaterialIcon name={showTroubleshooting ? 'expand_less' : 'help_outline'} className="text-sm" />
            {t('logServices.integration.test.troubleshooting')}
          </button>
        </div>

        {showTroubleshooting && (
          <div className="mt-4 border border-amber-200 dark:border-amber-700/30 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <MaterialIcon name="warning" className="text-base text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {t('logServices.integration.test.troubleshootingDesc')}
              </p>
            </div>
            <SegmentedControl
              options={[
                { key: 'nginx_conf' as const, label: 'nginx.conf' },
                { key: 'docker_compose' as const, label: 'Docker Compose' },
                { key: 'docker_run' as const, label: 'Docker Run' },
              ]}
              value={activeNginxTab}
              onChange={setActiveNginxTab}
            />
            <CodeBlock
              code={nginxSnippets[activeNginxTab]}
              onCopy={() => copy(nginxSnippets[activeNginxTab])}
              copyTitle={tc('common.copyToClipboard')}
              size="xs"
            />
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-5">
        <SectionTitle
          number={2}
          title={
            selectedPath === 'agent'
              ? t('logServices.integration.setup.agentTitle')
              : t('logServices.integration.setup.httpTitle')
          }
          description={
            selectedPath === 'agent'
              ? t('logServices.integration.setup.agentDesc')
              : t('logServices.integration.setup.httpDesc')
          }
        />

        {selectedPath === 'agent' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
              <MaterialIcon name="info" className="text-base text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-slate-600 dark:text-text-muted-dark leading-relaxed">
                {t('logServices.integration.setup.agentHint')}
              </p>
            </div>
            <CodeBlock
              code={agentPullCmd}
              onCopy={() => copy(agentPullCmd)}
              copyTitle={tc('common.copyToClipboard')}
              size="xs"
            />
            <CodeBlock
              code={agentQuickStartCmd}
              onCopy={() => copy(agentQuickStartCmd)}
              copyTitle={tc('common.copyToClipboard')}
              size="xs"
            />

            <div className="border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAgentAdvanced((prev) => !prev)}
                aria-expanded={showAgentAdvanced}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors text-left cursor-pointer"
              >
                <MaterialIcon name="tune" className="text-base text-slate-500 dark:text-text-muted-dark shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-text-secondary-dark">
                    {t('logServices.integration.setup.otherOptions')}
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5 truncate">
                    {t('logServices.integration.setup.otherOptionsDesc')}
                  </p>
                </div>
                <MaterialIcon
                  name={showAgentAdvanced ? 'expand_less' : 'expand_more'}
                  className="text-slate-400 dark:text-text-dim-dark shrink-0"
                />
              </button>

              {showAgentAdvanced && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-ui-border-dark pt-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="lg:shrink-0 lg:w-40">
                      <SegmentedControl
                        options={[
                          { key: 'config' as const, label: 'Config' },
                          { key: 'docker_sidecar' as const, label: 'Sidecar' },
                          { key: 'docker_pipe' as const, label: 'Pipe' },
                          { key: 'systemd' as const, label: 'systemd' },
                        ]}
                        value={agentSnippet}
                        onChange={setAgentSnippet}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CodeBlock
                        code={agentSnippets[agentSnippet]}
                        onCopy={() => copy(agentSnippets[agentSnippet])}
                        copyTitle={tc('common.copyToClipboard')}
                        size="xs"
                        minHeight="200px"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <SegmentedControl
              options={[
                { key: 'express' as const, label: 'Node.js' },
                { key: 'springboot' as const, label: 'Spring Boot' },
                { key: 'aspnet' as const, label: 'ASP.NET' },
                { key: 'fastapi' as const, label: 'FastAPI' },
              ]}
              value={httpSnippet}
              onChange={setHttpSnippet}
            />
            <CodeBlock
              code={httpAppenderSnippets[httpSnippet]}
              onCopy={() => copy(httpAppenderSnippets[httpSnippet])}
              copyTitle={tc('common.copyToClipboard')}
              size="xs"
              minHeight="240px"
            />
          </div>
        )}
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
                {tc('common.cancel')}
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
                title={tc('common.copyToClipboard')}
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
