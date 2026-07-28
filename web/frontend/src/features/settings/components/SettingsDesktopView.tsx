import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, MaterialIcon } from '../../../components/common';
import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';
import { AccountSection } from './AccountSection';
import { AlertsSection } from './AlertsSection';
import { AuditLogSection } from './AuditLogSection';
import { retentionLabel, intervalLabel } from '../retentionLabel';
import { env } from '../../../config/env';

const METRICS_RETENTION_OPTIONS = ['7d', '30d', '90d', '1y'];
const LOGS_RETENTION_OPTIONS = ['1d', '3d', '7d', '30d'];
const COLLECT_INTERVAL_OPTIONS = [15, 30, 60, 300];

// 스크롤스파이 대상 = 좌측 서브내비 항목. 지금은 '일반' 하나로 통일 — 섹션이 늘면 여기에 추가.
const NAV_IDS = ['sec-ui'] as const;

// ver2 프로토타입 오마주: 컴팩트 세그먼티드 (text-xs, 얇은 컨테이너).
const segmentedButtonClass = (active: boolean) =>
  `cursor-pointer px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
    active
      ? 'bg-ui-raised text-primary shadow-sm'
      : 'text-text-muted hover:text-text-secondary'
  }`;

interface SettingsDesktopViewProps {
  currentLanguage: string;
  theme: 'light' | 'dark';
  metricsRetention: string;
  logsRetention: string;
  collectInterval: number;
  consecutiveFailures: number;
  backendLoading: boolean;
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
}

export function SettingsDesktopView({
  currentLanguage,
  theme,
  metricsRetention,
  logsRetention,
  collectInterval,
  consecutiveFailures,
  backendLoading,
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
}: SettingsDesktopViewProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();
  const [active, setActive] = useState<string>(NAV_IDS[0]);
  const rootRef = useRef<HTMLDivElement>(null);

  // 스크롤 컨테이너(overflow-y-auto 조상)를 기준으로 현재 섹션을 추적한다.
  useEffect(() => {
    const scroller = rootRef.current?.closest('.overflow-y-auto') ?? window;
    const onScroll = () => {
      let act: string = NAV_IDS[0];
      for (const id of NAV_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 160) act = id;
      }
      setActive(act);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  // 중첩 스크롤 컨테이너에서 scrollIntoView는 불안정 — 컨테이너를 직접 스크롤한다.
  const jumpTo = (id: string) => {
    const el = document.getElementById(id);
    const scroller = rootRef.current?.closest('.overflow-y-auto');
    if (!el || !(scroller instanceof HTMLElement)) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8;
    scroller.scrollTo({ top }); // 부드러움은 컨테이너의 CSS scroll-smooth가 처리
  };

  const navItems: [string, string][] = [
    ['sec-ui', t('settings.nav.general')],
  ];

  const collectOptions = COLLECT_INTERVAL_OPTIONS.includes(collectInterval)
    ? COLLECT_INTERVAL_OPTIONS
    : [...COLLECT_INTERVAL_OPTIONS, collectInterval].sort((a, b) => a - b);

  return (
    <div ref={rootRef}>
      {/* Page Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-text-base">{t('settings.title')}</h1>
        <p className="text-sm text-text-muted mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="flex gap-10 items-start">
        {/* 좌측 서브내비 (lg+) — 스크롤스파이 */}
        <nav className="hidden lg:flex sticky top-2 w-44 shrink-0 flex-col gap-0.5">
          {navItems.map(([id, label]) => {
            const on = active === id;
            return (
              <button
                key={id}
                onClick={() => jumpTo(id)}
                className={`cursor-pointer text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  on
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:bg-ui-hover'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* 우측 콘텐츠 — ver2: 탭 없는 단일 컬럼 스크롤 */}
        <div className="flex-1 min-w-0 max-w-3xl space-y-3.5">
          {user && (
            <div id="sec-account" className="scroll-mt-4">
              <AccountSection />
            </div>
          )}

          <section id="sec-ui" className="scroll-mt-4">
            <SectionCard title={t('settings.interface.title')} subtitle={t('settings.interface.subtitle')}>
              <SettingRow label={t('settings.interface.language')} description={t('settings.interface.languageDesc')}>
                <div className="flex gap-1 bg-ui-hover p-0.5 rounded-lg">
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
                <div className="flex gap-1 bg-ui-hover p-0.5 rounded-lg">
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
          </section>

          <section id="sec-data" className="scroll-mt-4">
            <SectionCard title={t('settings.retention.title')} subtitle={t('settings.retention.subtitle')}>
              {backendLoading ? (
                <div className="space-y-3">
                  <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
                  <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
                </div>
              ) : (
                <>
                  <SettingRow label={t('settings.retention.collect')} description={t('settings.retention.collectDesc')}>
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
                      {collectOptions.map((sec) => (
                        <button
                          key={sec}
                          onClick={() => onCollectIntervalChange(sec)}
                          className={`font-mono ${segmentedButtonClass(collectInterval === sec)}`}
                        >
                          {intervalLabel(sec, currentLanguage)}
                        </button>
                      ))}
                    </div>
                  </SettingRow>

                  <SettingRow label={t('settings.retention.metrics')} description={t('settings.retention.metricsDesc')}>
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
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
                    <div className="flex gap-1 flex-wrap justify-end bg-ui-hover p-0.5 rounded-lg">
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

                  <p className="pt-3 text-xs text-text-dim">
                    {t('settings.retention.shrinkWarning')}
                  </p>
                </>
              )}
            </SectionCard>
          </section>

          {/* Alert threshold — 선택 즉시 저장 */}
          <section id="sec-alert" className="scroll-mt-4">
            <AlertsSection value={consecutiveFailures} loading={backendLoading} onChange={onConsecutiveFailuresChange} />
          </section>

          {/* Body access audit log — 컴포넌트가 admin 아닐 때 스스로 숨는다 */}
          <AuditLogSection />

          {/* Account Reset — ver2 프로토타입 오마주: 중립 카드 + 우측 붉은 텍스트 액션 */}
          <section id="sec-danger" className="scroll-mt-4">
            <SectionCard title={t('settings.accountReset.title')} subtitle={t('settings.accountReset.subtitle')}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-text-dim">
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
          </section>

        </div>
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
    </div>
  );
}
