import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, MaterialIcon } from '../../../components/common';
import { SectionCard } from './SectionCard';
import { AccountSection } from './AccountSection';
import { AlertsSection } from './AlertsSection';
import { AuditLogSection } from './AuditLogSection';
import { retentionLabel, intervalLabel } from '../retentionLabel';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];
const COLLECT_INTERVAL_OPTIONS = [15, 30, 60, 300];

interface SettingsMobileViewProps {
  currentLanguage: string;
  theme: 'light' | 'dark';
  metricsRetention: string;
  logsRetention: string;
  collectInterval: number;
  consecutiveFailures: number;
  backendLoading: boolean;
  settingsError: string | null;
  showResetConfirm: boolean;
  resetting: boolean;
  onLanguageChange: (lng: string) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onMetricsRetentionChange: (value: string) => void;
  onLogsRetentionChange: (value: string) => void;
  onCollectIntervalChange: (seconds: number) => void;
  onConsecutiveFailuresChange: (n: number) => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
  onRetryLoad: () => void;
}

export function SettingsMobileView({
  currentLanguage,
  theme,
  metricsRetention,
  logsRetention,
  collectInterval,
  consecutiveFailures,
  backendLoading,
  settingsError,
  showResetConfirm,
  resetting,
  onLanguageChange,
  onThemeChange,
  onMetricsRetentionChange,
  onLogsRetentionChange,
  onCollectIntervalChange,
  onConsecutiveFailuresChange,
  onResetClick,
  onResetConfirm,
  onResetCancel,
  onRetryLoad,
}: SettingsMobileViewProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-base">{t('settings.title')}</h1>
        <p className="text-sm text-text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>
      {settingsError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2.5 text-sm text-text-secondary">
          <MaterialIcon name="sync_problem" className="text-status-warn" />
          <span className="min-w-0 flex-1">{t('settings.loadFailed', { defaultValue: '일부 설정을 불러오지 못했습니다.' })}</span>
          <Button size="sm" variant="secondary" onClick={onRetryLoad}>{t('common.retry')}</Button>
        </div>
      )}

      {/* Account (ver2: 계정 · 인증) */}
      <AccountSection />

      {/* Interface */}
      <SectionCard title={t('settings.interface.title')} subtitle={t('settings.interface.subtitle')}>
        {/* Language */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-base">{t('settings.interface.language')}</p>
          <p className="text-sm text-text-muted">{t('settings.interface.languageDesc')}</p>
          <div className="flex gap-1 bg-ui-hover p-1 rounded-lg">
            {(['ko', 'en'] as const).map((lng) => (
              <button
                key={lng}
                onClick={() => onLanguageChange(lng)}
                className={`flex-1 cursor-pointer px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                  currentLanguage.startsWith(lng)
                    ? 'bg-ui-raised text-primary shadow-sm'
                    : 'text-text-muted'
                }`}
              >
                {lng === 'ko' ? '한국어' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ui-border-soft my-3" />

        {/* Theme */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-base">{t('settings.interface.theme')}</p>
          <p className="text-sm text-text-muted">{t('settings.interface.themeDesc')}</p>
          <div className="flex gap-1 bg-ui-hover p-1 rounded-lg">
            {(['light', 'dark'] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => onThemeChange(t_)}
                className={`flex-1 cursor-pointer flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold transition-all ${
                  theme === t_
                    ? 'bg-ui-raised text-primary shadow-sm'
                    : 'text-text-muted'
                }`}
              >
                <MaterialIcon name={t_ === 'light' ? 'light_mode' : 'dark_mode'} className="text-base" />
                {t_ === 'light' ? t('settings.interface.light') : t('settings.interface.dark')}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Data Retention */}
      <SectionCard title={t('settings.retention.title')} subtitle={t('settings.retention.subtitle')}>
        {backendLoading ? (
          <div className="space-y-3">
            <div className="h-14 bg-ui-hover rounded-lg animate-pulse" />
            <div className="h-14 bg-ui-hover rounded-lg animate-pulse" />
          </div>
        ) : (
          <>
            {/* Collect interval */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-base">{t('settings.retention.collect')}</p>
              <p className="text-sm text-text-muted">{t('settings.retention.collectDesc')}</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {(COLLECT_INTERVAL_OPTIONS.includes(collectInterval)
                  ? COLLECT_INTERVAL_OPTIONS
                  : [...COLLECT_INTERVAL_OPTIONS, collectInterval].sort((a, b) => a - b)
                ).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => onCollectIntervalChange(sec)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                      collectInterval === sec
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {intervalLabel(sec, currentLanguage)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ui-border-soft my-3" />

            {/* Metrics */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-base">{t('settings.retention.metrics')}</p>
              <p className="text-sm text-text-muted">{t('settings.retention.metricsDesc')}</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {METRICS_RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onMetricsRetentionChange(opt)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                      metricsRetention === opt
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {retentionLabel(opt, currentLanguage)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-ui-border-soft my-3" />

            {/* Logs */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-base">{t('settings.retention.logs')}</p>
              <p className="text-sm text-text-muted">{t('settings.retention.logsDesc')}</p>
              <div className="flex gap-1 flex-wrap bg-ui-hover p-1 rounded-lg">
                {LOGS_RETENTION_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onLogsRetentionChange(opt)}
                    className={`flex-1 cursor-pointer px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                      logsRetention === opt
                        ? 'bg-ui-raised text-primary shadow-sm'
                        : 'text-text-muted'
                    }`}
                  >
                    {retentionLabel(opt, currentLanguage)}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-3 text-xs text-text-dim">
              {t('settings.retention.shrinkWarning')}
            </p>
          </>
        )}
      </SectionCard>

      {/* Alert threshold — 선택 즉시 저장 */}
      <AlertsSection value={consecutiveFailures} loading={backendLoading} onChange={onConsecutiveFailuresChange} />

      {/* Body access audit log (admin-only) */}
      <AuditLogSection />

      {/* Account Reset — ver2 프로토타입 오마주: 중립 카드 + 붉은 텍스트 액션 */}
      <SectionCard title={t('settings.accountReset.title')} subtitle={t('settings.accountReset.subtitle')}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-text-dim">
            {env.useMock ? t('settings.accountReset.demoNotice') : t('settings.accountReset.confirmDesc')}
          </p>
          <button
            onClick={onResetClick}
            disabled={env.useMock}
            className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {t('settings.accountReset.button')}
          </button>
        </div>
      </SectionCard>

      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={onResetCancel}
        onConfirm={onResetConfirm}
        title={t('settings.accountReset.confirmTitle')}
        message={t('settings.accountReset.confirmDesc')}
        confirmLabel={t('settings.accountReset.confirmButton')}
        cancelLabel={t('settings.accountReset.cancel')}
        isProcessing={resetting}
      />
    </div>
  );
}
