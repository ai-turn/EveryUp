import { useTranslation } from 'react-i18next';
import { SectionCard } from './SectionCard';
import { SettingRow } from './SettingRow';

const OPTIONS = [1, 2, 3, 5];

// 알림 발송 조건(연속 실패 횟수). 백엔드 /settings의 alerts.consecutiveFailures와
// 1:1 — 선택 즉시 저장된다 (별도 저장 버튼 없음).
export function AlertsSection({ value, loading, onChange }: {
  value: number;
  loading: boolean;
  onChange: (n: number) => void;
}) {
  const { t } = useTranslation('settings');
  // 표준 옵션 밖의 값(config 직접 수정 등)도 선택지로 노출해 현재값이 숨지 않게 한다.
  const options = OPTIONS.includes(value) ? OPTIONS : [...OPTIONS, value].sort((a, b) => a - b);

  return (
    <SectionCard title={t('settings.alertThreshold.title')} subtitle={t('settings.alertThreshold.subtitle')}>
      {loading ? (
        <div className="h-10 bg-ui-hover rounded-lg animate-pulse" />
      ) : (
        <SettingRow
          label={t('settings.alertThreshold.consecutiveFailures')}
          description={t('settings.alertThreshold.consecutiveFailuresDesc')}
        >
          <div className="flex gap-1 bg-ui-hover p-0.5 rounded-lg">
            {options.map((n) => (
              <button
                key={n}
                onClick={() => onChange(n)}
                className={`cursor-pointer px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition-all ${
                  value === n
                    ? 'bg-ui-raised text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {n}{t('settings.alertThreshold.times')}
              </button>
            ))}
          </div>
        </SettingRow>
      )}
    </SectionCard>
  );
}
