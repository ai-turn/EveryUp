import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/common';
import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';
import { AccountSection } from './AccountSection';
import { AuditLogSection } from './AuditLogSection';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];

function retentionLabel(v: string) {
  if (v === '1y') return '1년 / 1 Year';
  const n = parseInt(v);
  const unit = v.endsWith('d') ? `일 / ${n === 1 ? 'Day' : 'Days'}` : '';
  return `${n} ${unit}`;
}

interface SettingsDesktopViewProps {
  currentLanguage: string;
  theme: 'light' | 'dark';
  metricsRetention: string;
  logsRetention: string;
  backendLoading: boolean;
  savingRetention: boolean;
  showResetConfirm: boolean;
  resetting: boolean;
  onLanguageChange: (lng: string) => void;
  onThemeChange: (theme: 'light' | 'dark') => void;
  onMetricsRetentionChange: (value: string) => void;
  onLogsRetentionChange: (value: string) => void;
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
  backendLoading,
  savingRetention,
  showResetConfirm,
  resetting,
  onLanguageChange,
  onThemeChange,
  onMetricsRetentionChange,
  onLogsRetentionChange,
  onSaveRetention,
  onResetClick,
  onResetConfirm,
  onResetCancel,
}: SettingsDesktopViewProps) {
  const { t } = useTranslation(['settings', 'common']);

  return (
    <>
      {/* ver2: settings column caps at ~840px, left-aligned */}
      <div className="space-y-5 max-w-4xl">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-text-muted-dark mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Account (ver2: 계정 · 인증) */}
        <AccountSection />

        {/* Interface */}
        <SectionCard icon="palette" title={t('settings.interface.title')} subtitle={t('settings.interface.subtitle')}>
          <SettingRow label={t('settings.interface.language')} description={t('settings.interface.languageDesc')}>
            <div className="flex gap-1 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg">
              {(['ko', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  onClick={() => onLanguageChange(lng)}
                  className={`cursor-pointer px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                    currentLanguage.startsWith(lng)
                      ? 'bg-white dark:bg-ui-active-dark text-primary shadow-sm'
                      : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
                  }`}
                >
                  {lng === 'ko' ? '한국어' : 'English'}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label={t('settings.interface.theme')} description={t('settings.interface.themeDesc')}>
            <div className="flex gap-1 bg-slate-100 dark:bg-ui-hover-dark p-1 rounded-lg">
              {(['light', 'dark'] as const).map((t_) => (
                <button
                  key={t_}
                  onClick={() => onThemeChange(t_)}
                  className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${
                    theme === t_
                      ? 'bg-white dark:bg-ui-active-dark text-primary shadow-sm'
                      : 'text-slate-500 dark:text-text-muted-dark hover:text-slate-700 dark:hover:text-text-secondary-dark'
                  }`}
                >
                  <MaterialIcon name={t_ === 'light' ? 'light_mode' : 'dark_mode'} className="text-base" />
                  {t_ === 'light' ? t('settings.interface.light') : t('settings.interface.dark')}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>

        {/* Data Retention */}
        <SectionCard icon="archive" title={t('settings.retention.title')} subtitle={t('settings.retention.subtitle')}>
          {backendLoading ? (
            <div className="space-y-3">
              <div className="h-14 bg-slate-100 dark:bg-ui-hover-dark rounded-lg animate-pulse" />
              <div className="h-14 bg-slate-100 dark:bg-ui-hover-dark rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              <SettingRow label={t('settings.retention.metrics')} description={t('settings.retention.metricsDesc')}>
                <div className="flex gap-1 flex-wrap justify-end">
                  {METRICS_RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onMetricsRetentionChange(opt)}
                      className={`cursor-pointer px-3 py-1 rounded-full text-sm font-semibold border transition-all ${
                        metricsRetention === opt
                          ? 'bg-primary text-white border-primary'
                          : 'bg-transparent text-slate-500 dark:text-text-muted-dark border-slate-200 dark:border-ui-border-dark hover:border-primary/50'
                      }`}
                    >
                      {retentionLabel(opt)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <SettingRow label={t('settings.retention.logs')} description={t('settings.retention.logsDesc')}>
                <div className="flex gap-1 flex-wrap justify-end">
                  {LOGS_RETENTION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => onLogsRetentionChange(opt)}
                      className={`cursor-pointer px-3 py-1 rounded-full text-sm font-semibold border transition-all ${
                        logsRetention === opt
                          ? 'bg-primary text-white border-primary'
                          : 'bg-transparent text-slate-500 dark:text-text-muted-dark border-slate-200 dark:border-ui-border-dark hover:border-primary/50'
                      }`}
                    >
                      {retentionLabel(opt)}
                    </button>
                  ))}
                </div>
              </SettingRow>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={onSaveRetention}
                  disabled={savingRetention}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {savingRetention ? (
                    <MaterialIcon name="sync" className="text-lg animate-spin" />
                  ) : (
                    <MaterialIcon name="save" className="text-lg" />
                  )}
                  {t('common.saveChanges')}
                </button>
              </div>
            </>
          )}
        </SectionCard>

        {/* Body access audit log (admin-only) */}
        <AuditLogSection />

        {/* Account Reset */}
        <SectionCard icon="person_off" title={t('settings.accountReset.title')} subtitle={t('settings.accountReset.subtitle')}>
          {env.useMock && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <MaterialIcon name="info" className="text-sm text-amber-500 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{t('settings.accountReset.demoNotice')}</p>
            </div>
          )}
          <SettingRow label={t('settings.accountReset.title')} description={t('settings.accountReset.subtitle')}>
            <button
              onClick={onResetClick}
              disabled={env.useMock}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-sm font-semibold text-red-600 dark:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <MaterialIcon name="restart_alt" className="text-lg" />
              {t('settings.accountReset.button')}
            </button>
          </SettingRow>
        </SectionCard>
      </div>

      {/* Reset Confirm Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title-desktop" className="bg-white dark:bg-bg-surface-dark rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
                <MaterialIcon name="warning" className="text-2xl text-red-600 dark:text-red-400" />
              </div>
              <h3 id="reset-dialog-title-desktop" className="text-base font-bold text-slate-900 dark:text-white">
                {t('settings.accountReset.confirmTitle')}
              </h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-text-muted-dark mb-6">
              {t('settings.accountReset.confirmDesc')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={onResetCancel}
                disabled={resetting}
                className="cursor-pointer px-4 py-2 rounded-lg border border-slate-200 dark:border-ui-border-dark text-sm font-semibold text-slate-700 dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-ui-hover-dark transition-colors disabled:opacity-50"
              >
                {t('settings.accountReset.cancel')}
              </button>
              <button
                onClick={onResetConfirm}
                disabled={resetting}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {resetting && <MaterialIcon name="sync" className="text-lg animate-spin" />}
                {t('settings.accountReset.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
