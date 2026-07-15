import { MaterialIcon } from '../../../components/common';
import type { ConnectedAgent } from '../../../services/api';

interface Props {
  agent: ConnectedAgent;
  onDelete: (id: string) => void;
  onViewKey: () => void;
}

function relativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return '방금';
  if (secs < 3600) return `${Math.floor(secs / 60)}분 전`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}시간 전`;
  return `${Math.floor(secs / 86400)}일 전`;
}

// Card for an agent that's been created but hasn't reported any service yet —
// gives the "it was created" feeling while making clear no data has arrived.
export function PendingServiceCard({ agent, onDelete, onViewKey }: Props) {
  return (
    <div className="bg-bg-surface border border-ui-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header: status + name */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0 mt-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 dark:bg-slate-600 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
          </span>
          <h3 className="font-semibold text-base text-text-base truncate leading-tight">
            {agent.name}
          </h3>
        </div>
        <span className="shrink-0 px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 text-slate-500 dark:bg-ui-hover-dark dark:text-text-muted-dark">
          대기 중
        </span>
      </div>

      {/* No-data placeholder */}
      <div className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg border border-dashed border-ui-border text-center">
        <MaterialIcon name="cloud_off" className="text-2xl text-text-dim" />
        <p className="text-sm font-medium text-text-muted">
          아직 수신된 데이터가 없습니다
        </p>
        <p className="text-xs text-text-dim max-w-[15rem]">
          API 키로 에이전트를 연결하면 데이터 수집이 시작됩니다
        </p>
      </div>

      {/* Footer: created time + delete */}
      <div className="flex items-center justify-between gap-2 text-xs text-text-dim">
        <span className="flex items-center gap-1 truncate">
          <MaterialIcon name="schedule" className="text-sm shrink-0" />
          <span className="truncate">생성 {relativeTime(agent.createdAt)}</span>
        </span>
        <div className="flex items-center gap-0.5 -mr-1.5">
          <button
            onClick={onViewKey}
            title="API 키 보기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <MaterialIcon name="key" className="text-base" />
          </button>
          <button
            onClick={() => onDelete(agent.id)}
            title="프로젝트 비활성화"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <MaterialIcon name="delete_outline" className="text-base" />
          </button>
        </div>
      </div>
    </div>
  );
}
