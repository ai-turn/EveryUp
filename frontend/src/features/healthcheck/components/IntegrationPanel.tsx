import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '../../../utils/errors';
import { MaterialIcon } from '../../../components/common';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { api, Service } from '../../../services/api';
import { buildHttpAppenderSnippets, buildAgentSnippets, buildNginxSnippets, buildAgentQuickStart } from './integrationSnippets';

interface IntegrationPanelProps {
  service: Service;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
}

export function IntegrationPanel({ service, onApiKeyRegenerated }: IntegrationPanelProps) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const { copy } = useCopyToClipboard();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'http-appender' | 'agent'>('http-appender');
  const [activeSnippet, setActiveSnippet] = useState<string>('express');
  const [activeNginxTab, setActiveNginxTab] = useState<'nginx_conf' | 'docker_compose' | 'docker_run'>('nginx_conf');
  const [showNginx, setShowNginx] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskedKey = service.apiKeyMasked || '—';
  const ingestUrl = `${window.location.origin}/api/v1/logs/ingest`;
  const displayKey = '<YOUR_API_KEY>';
  const hostname = window.location.hostname;
  const port = window.location.port || '443';
  const isHttps = window.location.protocol === 'https:';
  const origin = window.location.origin;

  // Build snippet data
  const httpAppenderSnippets = buildHttpAppenderSnippets(hostname, port, isHttps, displayKey, ingestUrl);
  const agentSnippets = buildAgentSnippets(hostname, port, isHttps, displayKey, ingestUrl, origin);
  const nginxSnippets = buildNginxSnippets(hostname);
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
      toast.success(t('healthcheck.integration.toast.regenerated'));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsRegenerating(false);
    }
  };

  const httpAppenderTabs = [
    { key: 'express', label: 'Express / Node.js' },
    { key: 'springboot', label: 'Spring Boot' },
    { key: 'aspnet', label: 'ASP.NET' },
    { key: 'fastapi', label: 'FastAPI / Django' },
  ];

  const agentTabs = [
    { key: 'config', label: t('healthcheck.integration.snippets.agentConfig') },
    { key: 'docker_sidecar', label: 'Docker (Sidecar)' },
    { key: 'docker_pipe', label: 'Docker (Pipe)' },
    { key: 'systemd', label: 'systemd' },
  ];

  const currentTabs = activeCategory === 'http-appender' ? httpAppenderTabs : agentTabs;
  const currentSnippets = activeCategory === 'http-appender' ? httpAppenderSnippets : agentSnippets;

  const handleCategoryChange = (cat: 'http-appender' | 'agent') => {
    setActiveCategory(cat);
    setActiveSnippet(cat === 'http-appender' ? 'express' : 'config');
  };

  return (
    <div className="space-y-4">

      {/* ── Step flow indicator ── */}
      <div className="flex items-center gap-0 bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-4 overflow-x-auto">
        {[
          { num: 1, label: 'API Key', icon: 'key' },
          { num: 2, label: 'Endpoint', icon: 'upload' },
          { num: 3, label: 'Test', icon: 'cable' },
          { num: 4, label: 'Integrate', icon: 'code' },
        ].map((step, i) => (
          <div key={step.num} className="flex items-center gap-0 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">
                {step.num}
              </span>
              <MaterialIcon name={step.icon} className="text-sm text-slate-500 dark:text-text-muted-dark" />
              <span className="text-sm font-medium text-slate-700 dark:text-text-secondary-dark whitespace-nowrap">
                {step.label}
              </span>
            </div>
            {i < 3 && (
              <MaterialIcon name="chevron_right" className="text-slate-300 dark:text-ui-border-dark mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: API Key ── */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">1</span>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
            <MaterialIcon name="key" className="text-lg text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('healthcheck.integration.apiKey.title')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark">
              {t('healthcheck.integration.apiKey.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4">
          <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">
            {maskedKey}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <MaterialIcon name="warning" className="text-sm" />
            {t('healthcheck.integration.apiKey.warning')}
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
          >
            {isRegenerating ? (
              <MaterialIcon name="sync" className="text-sm animate-spin" />
            ) : (
              <MaterialIcon name="refresh" className="text-sm" />
            )}
            {t('healthcheck.integration.apiKey.regenerate')}
          </button>
        </div>
      </div>

      {/* ── Step 2: Ingest Endpoint ── */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">2</span>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30">
            <MaterialIcon name="upload" className="text-lg text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('healthcheck.integration.endpoint.title')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark">
              {t('healthcheck.integration.endpoint.description')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-3">
          <span className="text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded shrink-0">POST</span>
          <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate">{ingestUrl}</span>
          <button
            onClick={() => copy(ingestUrl)}
            className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
          >
            <MaterialIcon name="content_copy" className="text-base" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-text-muted-dark">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            error
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 ml-2" />
            warn
          </span>
          <span className="text-slate-300 dark:text-ui-border-dark select-none">·</span>
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="auto_awesome" className="text-sm text-blue-400" />
            {t('healthcheck.integration.endpoint.formatInfo', { defaultValue: 'Formats auto-detected' })}
          </span>
          <span className="text-slate-300 dark:text-ui-border-dark select-none">·</span>
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-text-muted-dark">
            <MaterialIcon name="layers" className="text-sm text-blue-400" />
            {t('healthcheck.integration.endpoint.batchInfo', { defaultValue: 'Batch up to 100 logs/req' })}
          </span>
        </div>
      </div>

      {/* ── Step 3: Connection Test ── */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">3</span>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <MaterialIcon name="cable" className="text-lg text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              {t('healthcheck.integration.connectionTest.title', { defaultValue: 'Connection Test' })}
            </h3>
            <p className="text-sm text-slate-500 dark:text-text-muted-dark">
              {t('healthcheck.integration.connectionTest.description', { defaultValue: 'Verify network connectivity and API key before integrating.' })}
            </p>
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 bg-slate-900 dark:bg-bg-main-dark rounded-lg text-sm text-slate-200 overflow-x-auto leading-relaxed">
            <code>{`curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${maskedKey !== '—' ? maskedKey : displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`}</code>
          </pre>
          <button
            onClick={() => copy(`curl -X POST ${ingestUrl} \\\n  -H "Authorization: Bearer ${displayKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`)}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={t('common.copyToClipboard')}
          >
            <MaterialIcon name="content_copy" className="text-base" />
          </button>
        </div>

        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <p className="text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-1.5">
            <MaterialIcon name="check_circle" className="text-sm mt-0.5 shrink-0" />
            {t('healthcheck.integration.connectionTest.successHint', { defaultValue: 'If connected successfully, the server responds with HTTP 200. If you get a timeout or connection refused, check your firewall outbound rules and server inbound rules.' })}
          </p>
        </div>
      </div>

      {/* ── Step 4: Code Snippets (2-column) ── */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold shrink-0">4</span>
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <MaterialIcon name="code" className="text-lg text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {t('healthcheck.integration.snippets.title')}
          </h3>
        </div>

        {/* Category toggle */}
        <div className="flex gap-1 mb-5 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg w-fit">
          {[
            { key: 'http-appender' as const, label: t('healthcheck.integration.snippets.httpAppender'), icon: 'http' },
            { key: 'agent' as const, label: t('healthcheck.integration.snippets.agent'), icon: 'smart_toy' },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeCategory === cat.key
                  ? 'bg-white dark:bg-ui-active-dark text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
              }`}
            >
              <MaterialIcon name={cat.icon} className="text-sm" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Agent Quick Start */}
        {activeCategory === 'agent' && (
          <div className="mb-5 border border-cyan-200 dark:border-cyan-800/50 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-800/40">
                <MaterialIcon name="deployed_code" className="text-base text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('healthcheck.integration.agent.quickStart', { defaultValue: 'Quick Start' })}
                </h4>
                <p className="text-sm text-slate-500 dark:text-text-muted-dark">
                  {t('healthcheck.integration.agent.quickStartDesc', { defaultValue: 'Pull and run the Log Agent with a single command.' })}
                </p>
              </div>
            </div>
            <div className="relative">
              <pre className="p-3 bg-slate-900 dark:bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">{agentQuickStartCmd}</pre>
              <button
                onClick={() => copy(agentQuickStartCmd)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                title={t('healthcheck.integration.snippets.copy')}
              >
                <MaterialIcon name="content_copy" className="text-sm" />
              </button>
            </div>
          </div>
        )}

        {/* 2-column: sidebar tabs + code */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:shrink-0 sm:w-36">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-text-dim-dark mb-2 px-2 hidden sm:block">
              {activeCategory === 'http-appender' ? 'Framework' : 'Deploy'}
            </p>
            <div className="flex sm:flex-col gap-1 overflow-x-auto pb-1 sm:pb-0">
            {currentTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSnippet(tab.key)}
                className={`shrink-0 sm:w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeSnippet === tab.key
                    ? 'bg-primary/10 text-primary dark:text-primary font-semibold'
                    : 'text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
                }`}
              >
                {tab.label}
              </button>
            ))}
            </div>

            <div className="pt-3 hidden sm:block">
              <p className="text-sm text-slate-400 dark:text-text-dim-dark leading-relaxed px-2">
                {activeCategory === 'http-appender'
                  ? t('healthcheck.integration.snippets.httpAppenderDesc', { defaultValue: 'Add a transport to your app code. Best when you control the source.' })
                  : t('healthcheck.integration.snippets.agentDesc', { defaultValue: 'Tail log files and forward. Best for servers or containers.' })
                }
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="relative h-full">
              <pre className="p-4 bg-slate-900 dark:bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre h-full min-h-50">
                {currentSnippets[activeSnippet]}
              </pre>
              <button
                onClick={() => copy(currentSnippets[activeSnippet])}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                title={t('healthcheck.integration.snippets.copy')}
              >
                <MaterialIcon name="content_copy" className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Optional: Nginx Reverse Proxy (collapsible) ── */}
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        <button
          onClick={() => setShowNginx((v) => !v)}
          className="w-full flex items-center gap-3 p-5 hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors text-left"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-ui-hover-dark shrink-0">
            <MaterialIcon name="dns" className="text-base text-slate-500 dark:text-text-muted-dark" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-text-secondary-dark">
              Nginx Reverse Proxy
            </h3>
            <p className="text-sm text-slate-400 dark:text-text-dim-dark">
              Nginx 뒤에서 운영 시 Authorization 헤더 전달 설정 · 선택 사항
            </p>
          </div>
          <MaterialIcon
            name={showNginx ? 'expand_less' : 'expand_more'}
            className="text-slate-400 dark:text-text-dim-dark shrink-0"
          />
        </button>

        {showNginx && (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-ui-border-dark pt-4">
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-start gap-2">
              <MaterialIcon name="warning" className="text-sm text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Nginx 기본 설정은 <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Authorization</code> 헤더를 백엔드로 전달하지 않습니다.{' '}
                아래 <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">proxy_set_header</code> 설정을 반드시 추가하세요.
              </p>
            </div>

            <div className="flex gap-1 mb-3 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg w-fit">
              {([
                { key: 'nginx_conf', label: 'nginx.conf' },
                { key: 'docker_compose', label: 'Docker Compose' },
                { key: 'docker_run', label: 'Docker Run' },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveNginxTab(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeNginxTab === tab.key
                      ? 'bg-white dark:bg-ui-active-dark text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 dark:bg-slate-950 rounded-lg text-xs text-slate-300 overflow-x-auto leading-relaxed whitespace-pre">
                {nginxSnippets[activeNginxTab]}
              </pre>
              <button
                onClick={() => copy(nginxSnippets[activeNginxTab])}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors text-slate-300"
                title={t('common.copyToClipboard')}
              >
                <MaterialIcon name="content_copy" className="text-sm" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Regenerate Confirm Dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30">
                <MaterialIcon name="warning" className="text-xl text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('healthcheck.integration.apiKey.confirmTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('healthcheck.integration.apiKey.confirmDesc')}
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold text-sm hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
              >
                {t('healthcheck.integration.apiKey.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revealed Key Modal ── */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-full bg-green-100 dark:bg-green-900/30">
                <MaterialIcon name="key" className="text-xl text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {t('healthcheck.integration.apiKey.revealTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('healthcheck.integration.apiKey.revealDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-lg font-mono text-sm mb-4">
              <span className="flex-1 text-slate-700 dark:text-text-base-dark break-all select-all">
                {revealedKey}
              </span>
              <button
                onClick={() => copy(revealedKey)}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark"
                title={t('healthcheck.integration.apiKey.copy')}
              >
                <MaterialIcon name="content_copy" className="text-base" />
              </button>
            </div>

            <button
              onClick={dismissRevealedKey}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              {t('healthcheck.integration.apiKey.revealConfirm')}
              {revealCountdown > 0 && ` (${revealCountdown}s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
