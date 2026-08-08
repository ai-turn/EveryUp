import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { MaterialIcon } from '../../../components/common/MaterialIcon';
import type { ConnectedAgent } from '../../../services/api';

interface Props {
  agent: ConnectedAgent;
  onDelete: (id: string) => void;
  onViewKey: () => void;
  onInstall: () => void;
}

// Card for an agent that's been created but hasn't reported any service yet —
// gives the "it was created" feeling while making clear no data has arrived.
export function PendingServiceCard({ agent, onDelete, onViewKey, onInstall }: Props) {
  const { i18n } = useTranslation('common');
  const dateLocale = useMemo(
    () => (i18n.language.startsWith('ko') ? ko : enUS),
    [i18n.language],
  );
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header: status + name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 dark:bg-slate-600 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
          </span>
          <h3 className="text-base font-bold text-text-base truncate leading-tight">
            {agent.name}
          </h3>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark">
          대기 중
        </span>
      </div>

      {/* Keep the onboarding state visible from the project grid. */}
      <div className="rounded-lg border border-dashed border-ui-border p-3">
        <div className="mb-3 grid grid-cols-3 gap-1">
          {[
            { label: '에이전트', complete: true },
            { label: 'Agent', complete: false },
            { label: '기능 확인', complete: false },
          ].map((step, index) => (
            <div key={step.label} className="flex min-w-0 items-center gap-1">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${step.complete ? 'bg-emerald-500 text-white' : index === 1 ? 'bg-primary text-white' : 'bg-ui-hover text-text-dim'}`}>
                {step.complete ? <MaterialIcon name="check" className="text-xs" /> : index + 1}
              </span>
              <span className={`truncate text-2xs font-semibold ${index === 1 ? 'text-primary' : 'text-text-dim'}`}>{step.label}</span>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-text-muted">Agent 설치를 기다리고 있습니다</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-xs text-text-dim">
            명령 한 줄을 실행하면 연결과 기능 진단을 자동으로 확인합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
        >
          설정 계속하기
          <MaterialIcon name="arrow_forward" className="text-sm" />
        </button>
      </div>

      {/* Footer: created time + delete */}
      <div className="flex items-center justify-between gap-2 text-xs text-text-dim">
        <span className="flex items-center gap-1 truncate">
          <MaterialIcon name="schedule" className="text-sm shrink-0" />
          <span className="truncate">생성 {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true, locale: dateLocale })}</span>
        </span>
        <div className="flex items-center gap-1 -mr-1.5">
          <button
            type="button"
            onClick={onViewKey}
            aria-label="API 키 보기" title="API 키 보기"
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <MaterialIcon name="key" className="text-base" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(agent.id)}
            aria-label="에이전트 비활성화" title="에이전트 비활성화"
            className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <MaterialIcon name="delete_outline" className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}
