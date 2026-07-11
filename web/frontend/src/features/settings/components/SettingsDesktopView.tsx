import { useTranslation } from 'react-i18next';
import { ConfirmDialog, MaterialIcon } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';
import { AccountSection } from './AccountSection';
import { AlertsSection } from './AlertsSection';
import { AuditLogSection } from './AuditLogSection';
import { retentionLabel } from '../retentionLabel';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];

// ver2 프로토타입 오마주: 컴팩트 세그먼티드 (text-xs, 얇은 컨테이너).
const segmentedButtonClass = (active: boolean) =>
  `cursor-pointer px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
    active
      ? 'bg-white dark:bg-ui-active-dark text-primary shadow-sm'
      : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
  }`;

interface SettingsDesktopViewProps {
  currentLanguage: string;
  theme: 'light' | 'dark';
  metricsRetention: string;
  logsRetention: string;
  consecutiveFailures: number;
  backendLoading: boolean;
  savingRetention: boolean;
  showResetConfirm: boolean;
  resetting: boolean;
  onLanguageChange: (lng: string) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onMetricsRetentionChange: (value: string) => void;
  onLogsRetentionChange: (value: string) => void;
  onConsecutiveFailuresChange: (n: number) => void;
  onSaveRetention: () => void;
  onResetClick: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
}

export function SettingsDesktopView({
  currentLanguage,
  theme,
  metricsRetention,
  logsRetention,
  consecutiveFailures,
  backendLoading,
  savingRetention,
  showResetConfirm,
  resetting,
  onLanguageChange,
  onThemeChange,
  onMetricsRetentionChange,
  onLogsRetentionChange,
  onConsecutiveFailuresChange,
  onSaveRetention,
  onResetClick,
  onResetConfirm,
  onResetCancel,
}: SettingsDesktopViewProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();

  return (
    <>
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* ver2 프로토타입 오마주: 탭 없는 단일 컬럼 스크롤 */}
      <div className="max-w-3xl space-y-3.5">
        {user && <AccountSection />}

        <SectionCard title={t('settings.interface.title')} subtitle={t('settings.interface.subtitle')}>
          <SettingRow label={t('settings.interface.language')} description={t('settings.interface.languageDesc')}>
            <div className="flex gap-1 bg-slate-100 dark:bg-ui-hover-dark p-0.5 rounded-lg">
              {(['ko', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => onLanguageChange(lng)}
                  className={segmentedButtonClass(currentLanguage.startsWith(lng))}
                >
                  {lng === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label={t('settings.interface.theme')} description={t('settings.interface.themeDesc')}>
            <div className="flex gap-1 bg-slate-100 dark:bg-ui-hover-dark p-0.5 rounded-lg">
              {(['light', 'dark'] as const).map((t_) => (
                <button
                  key={t_}
                  onClick={() => onThemeChange(t_)}
                  className={`flex items-center gap-1.5 ${segmentedButtonClass(theme === t_)}`}
                >
                  <MaterialIcon name={t_ === 'light' ? 'light_mode' : 'dark_mode'} className="text-sm" />
                  {t_ === 'light' ? t('settings.interface.light') : t('settings.interface.dark')}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        <SectionCard title={t('settings.retention.title')} subtitle={t('settings.retention.subtitle')}>
          {backendLoading ? (
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 dark:bg-ui-hover-dark rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 dark:bg-ui-hover-dark rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              <SettingRow label={t('settings.retention.metrics')} description={t('settings.retention.metricsDesc')}>
                <div className="flex gap-1 flex-wrap justify-end bg-slate-100 dark:bg-ui-hover-dark p-0.5 rounded-lg">
                  {METRICS_RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onMetricsRetentionChange(opt)}
                      className={`font-mono ${segmentedButtonClass(metricsRetention === opt)}`}
                    >
                      {retentionLabel(opt, currentLanguage)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label={t('settings.retention.logs')} description={t('settings.retention.logsDesc')}>
                <div className="flex gap-1 flex-wrap justify-end bg-slate-100 dark:bg-ui-hover-dark p-0.5 rounded-lg">
                  {LOGS_RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onLogsRetentionChange(opt)}
                      className={`font-mono ${segmentedButtonClass(logsRetention === opt)}`}
                    >
                      {retentionLabel(opt, currentLanguage)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <div className="pt-3 flex items-center justify-between gap-4">
                <p className="text-2xs text-slate-400 dark:text-text-dim-dark">
                  {t('settings.retention.shrinkWarning')}
                </p>
                <button
                  onClick={onSaveRetention}
                  disabled={savingRetention}
                  className="cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingRetention ? (
                    <MaterialIcon name="sync" className="text-base animate-spin" />
                  ) : (
                    <MaterialIcon name="save" className="text-base" />
                  )}
                  {t('common.saveChanges')}
                </button>
              </div>
            </>
          )}
        </SectionCard>

        {/* Alert threshold — 선택 즉시 저장 */}
        <AlertsSection value={consecutiveFailures} loading={backendLoading} onChange={onConsecutiveFailuresChange} />

        {/* Body access audit log — 컴포넌트가 admin 아닐 때 스스로 숨는다 */}
        <AuditLogSection />

        {/* Account Reset — ver2 프로토타입 오마주: 중립 카드 + 우측 붉은 텍스트 액션 */}
        <SectionCard title={t('settings.accountReset.title')} subtitle={t('settings.accountReset.subtitle')}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-2xs text-slate-400 dark:text-text-dim-dark">
              {env.useMock ? t('settings.accountReset.demoNotice') : t('settings.accountReset.confirmDesc')}
            </p>
            <button
              onClick={onResetClick}
              disabled={env.useMock}
              className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline cursor-pointer"
            >
              {t('settings.accountReset.button')}
            </button>
          </div>
        </SectionCard>
      </div>

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
    </>
  );
}
