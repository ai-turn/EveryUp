import { useState, useEffect, useRef, useCallback } from 'react';
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
  buildApiCaptureSnippets,
} from './integrationSnippets';

interface IntegrationPanelProps {
  service: Service;
  onApiKeyRegenerated: (newKey: string, maskedKey: string) => void;
}

interface StepHeaderProps {
  step: number;
  icon: string;
  accentClass: string;
  iconColorClass: string;
  stepColorClass: string;
  title: string;
  description?: string;
}

function StepHeader({
  step,
  icon,
  accentClass,
  iconColorClass,
  stepColorClass,
  title,
  description,
}: StepHeaderProps) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
        <MaterialIcon name={icon} className={`text-xl ${iconColorClass}`} />
      </div>
      <div>
        <p className={`text-[10px] font-bold tracking-widest uppercase mb-0.5 ${stepColorClass}`}>
          Step {step}
        </p>
        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">{description}</p>
        )}
      </div>
    </div>
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
        className={`p-4 bg-slate-900 dark:bg-slate-950 rounded-xl overflow-x-auto leading-relaxed whitespace-pre ${
          size === 'xs' ? 'text-xs text-slate-300' : 'text-sm text-slate-200'
        }`}
        style={minHeight ? { minHeight } : undefined}
      >
        <code>{code}</code>
      </pre>
      <button
        onClick={onCopy}
        title={copyTitle}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 transition-colors text-slate-400 hover:text-slate-200 cursor-pointer"
      >
        <MaterialIcon name="content_copy" className="text-sm" />
      </button>
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

export function IntegrationPanel({ service, onApiKeyRegenerated }: IntegrationPanelProps) {
  const { t } = useTranslation(['healthcheck', 'common']);
  const { copy } = useCopyToClipboard();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'http-appender' | 'agent' | 'api-capture'>('agent');
  const [activeSnippet, setActiveSnippet] = useState<string>('config');
  const [activeNginxTab, setActiveNginxTab] = useState<'nginx_conf' | 'docker_compose' | 'docker_run'>('nginx_conf');
  const [showNginx, setShowNginx] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maskedKey = service.apiKeyMasked || 'Not available';
  const ingestUrl = `${window.location.origin}/api/v1/logs/ingest`;
  const displayKey = '<YOUR_API_KEY>';
  const hostname = window.location.hostname;
  const port = window.location.port || '443';
  const isHttps = window.location.protocol === 'https:';
  const origin = window.location.origin;

  const httpAppenderSnippets = buildHttpAppenderSnippets(hostname, port, isHttps, displayKey, ingestUrl);
  const agentSnippets = buildAgentSnippets(hostname, port, isHttps, displayKey, origin);
  const nginxSnippets = buildNginxSnippets(hostname);
  const agentQuickStartCmd = buildAgentQuickStart(displayKey, origin);
  const apiCaptureSnippets = buildApiCaptureSnippets(origin, displayKey);

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

  const apiCaptureTabs = [
    { key: 'curl', label: 'cURL' },
    { key: 'express', label: 'Express.js' },
    { key: 'go', label: 'Go (net/http)' },
  ];

  const currentTabs =
    activeCategory === 'http-appender'
      ? httpAppenderTabs
      : activeCategory === 'api-capture'
        ? apiCaptureTabs
        : agentTabs;
  const currentSnippets =
    activeCategory === 'http-appender'
      ? httpAppenderSnippets
      : activeCategory === 'api-capture'
        ? apiCaptureSnippets
        : agentSnippets;

  const handleCategoryChange = (category: 'http-appender' | 'agent' | 'api-capture') => {
    setActiveCategory(category);
    if (category === 'agent') setActiveSnippet('config');
    else if (category === 'http-appender') setActiveSnippet('express');
    else setActiveSnippet('curl');
  };

  const curlCmd = `curl -X POST ${ingestUrl} \\
  -H "Authorization: Bearer ${displayKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`;

  const curlCopyCmd = `curl -X POST ${ingestUrl} \\\n  -H "Authorization: Bearer ${displayKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"level":"info","message":"Connection test","service":"${service.id}"}'`;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <StepHeader
          step={1}
          icon="key"
          accentClass="bg-primary/10"
          iconColorClass="text-primary"
          stepColorClass="text-primary/70"
          title={t('healthcheck.integration.apiKey.title', { defaultValue: 'API 키' })}
          description={t('healthcheck.integration.apiKey.description', { defaultValue: '앱이나 에이전트가 로그를 보낼 때 사용하는 인증 키입니다.' })}
        />

        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-ui-hover-dark rounded-xl font-mono text-sm mb-4 border border-slate-100 dark:border-ui-border-dark">
          <MaterialIcon name="lock" className="text-sm text-slate-400 dark:text-text-dim-dark shrink-0" />
          <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate select-all">
            {maskedKey}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 dark:text-text-dim-dark bg-slate-100 dark:bg-ui-active-dark px-2 py-0.5 rounded-md shrink-0">
            MASKED
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <MaterialIcon name="warning" className="text-sm shrink-0" />
            {t('healthcheck.integration.apiKey.warning', { defaultValue: '이 키를 안전하게 보관하세요. 외부에 노출되면 재발급하세요.' })}
          </p>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isRegenerating ? (
              <MaterialIcon name="sync" className="text-sm animate-spin" />
            ) : (
              <MaterialIcon name="refresh" className="text-sm" />
            )}
            {t('healthcheck.integration.apiKey.regenerate', { defaultValue: '재발급' })}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <StepHeader
          step={2}
          icon="upload"
          accentClass="bg-green-100 dark:bg-green-900/30"
          iconColorClass="text-green-600 dark:text-green-400"
          stepColorClass="text-green-600/80 dark:text-green-400/80"
          title={t('healthcheck.integration.endpoint.title', { defaultValue: '로그 수집 엔드포인트' })}
          description={t('healthcheck.integration.endpoint.description', { defaultValue: '로거 또는 에이전트가 이 URL로 POST 요청을 보내면 로그가 수집됩니다.' })}
        />

        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-ui-hover-dark rounded-xl font-mono text-sm mb-3 border border-slate-100 dark:border-ui-border-dark">
          <span className="text-xs font-bold text-white bg-green-600 px-2 py-0.5 rounded shrink-0">POST</span>
          <span className="flex-1 text-slate-700 dark:text-text-base-dark truncate text-xs">{ingestUrl}</span>
          <button
            onClick={() => copy(ingestUrl)}
            className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            title={t('common.copyToClipboard')}
          >
            <MaterialIcon name="content_copy" className="text-sm" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/8 dark:bg-red-500/10 text-xs text-red-600 dark:text-red-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            error / warn alerts
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/8 dark:bg-blue-500/10 text-xs text-blue-600 dark:text-blue-400 font-medium">
            <MaterialIcon name="auto_awesome" className="text-xs" />
            {t('healthcheck.integration.endpoint.formatInfo', {
              defaultValue: '기존 로깅 라이브러리 형식을 그대로 보내도 됩니다. 서버가 주요 포맷을 자동으로 인식합니다.',
            })}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-500/8 dark:bg-slate-500/10 text-xs text-slate-600 dark:text-text-muted-dark font-medium">
            <MaterialIcon name="layers" className="text-xs" />
            {t('healthcheck.integration.endpoint.batchInfo', {
              defaultValue: '배치 전송 지원: 요청 한 번에 최대 100개의 로그를 보낼 수 있습니다.',
            })}
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <StepHeader
          step={3}
          icon="cable"
          accentClass="bg-emerald-100 dark:bg-emerald-900/30"
          iconColorClass="text-emerald-600 dark:text-emerald-400"
          stepColorClass="text-emerald-600/80 dark:text-emerald-400/80"
          title={t('healthcheck.integration.connectionTest.title', { defaultValue: '연결 테스트' })}
          description={t('healthcheck.integration.connectionTest.description', {
            defaultValue: '실제 연동 전에 네트워크 연결과 API 키가 정상인지 먼저 확인하세요.',
          })}
        />

        <CodeBlock
          code={curlCmd}
          onCopy={() => copy(curlCopyCmd)}
          copyTitle={t('common.copyToClipboard')}
          size="sm"
        />

        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
          <MaterialIcon name="check_circle" className="text-sm text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
            {t('healthcheck.integration.connectionTest.successHint', {
              defaultValue: '연결에 성공하면 서버가 HTTP 200으로 응답합니다. 타임아웃이나 연결 거부가 발생하면 방화벽 아웃바운드 규칙과 서버 인바운드 규칙을 확인하세요.',
            })}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl p-6">
        <StepHeader
          step={4}
          icon="code"
          accentClass="bg-purple-100 dark:bg-purple-900/30"
          iconColorClass="text-purple-600 dark:text-purple-400"
          stepColorClass="text-purple-600/80 dark:text-purple-400/80"
          title={t('healthcheck.integration.snippets.title', { defaultValue: '연동 예시' })}
          description={t('healthcheck.integration.snippets.description', {
            defaultValue: '환경과 배포 방식에 맞는 연동 예시를 선택해 바로 적용할 수 있습니다.',
          })}
        />

        <div className="mb-5">
          <SegmentedControl
            options={[
              { key: 'agent' as const, label: t('healthcheck.integration.snippets.agent', { defaultValue: 'Log Agent' }) },
              { key: 'http-appender' as const, label: t('healthcheck.integration.snippets.httpAppender', { defaultValue: 'HTTP Appender' }) },
              { key: 'api-capture' as const, label: t('healthcheck.integration.snippets.apiCapture', { defaultValue: 'API Capture' }) },
            ]}
            value={activeCategory}
            onChange={handleCategoryChange}
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-text-muted-dark pl-1">
            {activeCategory === 'http-appender'
              ? t('healthcheck.integration.snippets.httpAppenderDesc', {
                  defaultValue: '앱 코드에 HTTP 전송 설정을 추가하는 방식입니다. 소스 코드를 수정할 수 있고, 로깅 라이브러리를 이미 사용 중이라면 가장 간단합니다.',
                })
              : activeCategory === 'api-capture'
                ? t('healthcheck.integration.snippets.apiCaptureDesc', {
                    defaultValue: '앱의 HTTP 요청/응답을 캡처해 MT로 전송합니다. 미들웨어를 추가하거나 cURL로 직접 테스트할 수 있습니다.',
                  })
                : t('healthcheck.integration.snippets.agentDesc', {
                    defaultValue: 'Fluent Bit 기반 에이전트가 로그 파일이나 stdout을 수집해 전달합니다. 앱 코드를 수정하기 어렵거나 서버·컨테이너 단위로 붙이고 싶을 때 적합합니다.',
                  })}
          </p>
        </div>

        {activeCategory === 'agent' && (
          <div className="mb-5 border border-slate-200 dark:border-ui-border-dark bg-slate-50 dark:bg-ui-hover-dark rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white dark:bg-ui-active-dark">
                <MaterialIcon name="rocket_launch" className="text-base text-slate-500 dark:text-text-muted-dark" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('healthcheck.integration.agent.quickStart', { defaultValue: '빠른 시작' })}
                </h4>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark">
                  {t('healthcheck.integration.agent.quickStartDesc', {
                    defaultValue: '로그 파일을 /var/log/app에 마운트하는 가장 빠른 실행 예시입니다.',
                  })}
                </p>
              </div>
            </div>
            <CodeBlock
              code={agentQuickStartCmd}
              onCopy={() => copy(agentQuickStartCmd)}
              copyTitle={t('healthcheck.integration.snippets.copy', { defaultValue: '코드 복사' })}
              size="xs"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:shrink-0 sm:w-40">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-text-dim-dark mb-2 px-1 hidden sm:block">
              {activeCategory === 'http-appender' ? 'Framework' : activeCategory === 'api-capture' ? 'Language' : 'Deploy'}
            </p>
            <div className="flex sm:flex-col gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
              {currentTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveSnippet(tab.key)}
                  className={`shrink-0 sm:w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeSnippet === tab.key
                      ? 'bg-primary/10 text-primary dark:text-primary font-semibold'
                      : 'text-slate-500 dark:text-text-muted-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <CodeBlock
              code={currentSnippets[activeSnippet]}
              onCopy={() => copy(currentSnippets[activeSnippet])}
              copyTitle={t('healthcheck.integration.snippets.copy', { defaultValue: '코드 복사' })}
              size="xs"
              minHeight="200px"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-xl overflow-hidden">
        <button
          onClick={() => setShowNginx((prev) => !prev)}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-ui-hover-dark shrink-0">
            <MaterialIcon name="dns" className="text-base text-slate-500 dark:text-text-muted-dark" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-text-secondary-dark">
              Nginx Reverse Proxy
            </h3>
            <p className="text-xs text-slate-400 dark:text-text-dim-dark mt-0.5">
              {t('healthcheck.integration.nginx.desc', {
                defaultValue: 'Authorization 헤더 전달이 필요한 경우에만 확인하세요.',
              })}
            </p>
          </div>
          <MaterialIcon
            name={showNginx ? 'expand_less' : 'expand_more'}
            className="text-slate-400 dark:text-text-dim-dark shrink-0"
          />
        </button>

        {showNginx && (
          <div className="px-5 pb-5 border-t border-slate-100 dark:border-ui-border-dark pt-4 space-y-3">
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
              <MaterialIcon name="warning" className="text-sm text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                Nginx 기본 설정은{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">Authorization</code>{' '}
                헤더를 백엔드로 전달하지 않을 수 있습니다.{' '}
                <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">proxy_set_header</code>{' '}
                설정을 추가해 주세요.
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
              copyTitle={t('common.copyToClipboard')}
              size="xs"
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
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-ui-hover-dark text-slate-700 dark:text-text-secondary-dark font-semibold text-sm hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleRegenerate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors cursor-pointer"
              >
                {t('healthcheck.integration.apiKey.confirmAction')}
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
                  {t('healthcheck.integration.apiKey.revealTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-text-muted-dark mt-0.5">
                  {t('healthcheck.integration.apiKey.revealDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-ui-hover-dark rounded-xl font-mono text-sm mb-4 border border-slate-100 dark:border-ui-border-dark">
              <span className="flex-1 text-slate-700 dark:text-text-base-dark break-all select-all">
                {revealedKey}
              </span>
              <button
                onClick={() => copy(revealedKey)}
                className="shrink-0 p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-ui-active-dark transition-colors text-slate-500 dark:text-text-muted-dark cursor-pointer"
                title={t('healthcheck.integration.apiKey.copy')}
              >
                <MaterialIcon name="content_copy" className="text-base" />
              </button>
            </div>

            <button
              onClick={dismissRevealedKey}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors cursor-pointer"
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
