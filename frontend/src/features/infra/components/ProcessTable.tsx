import { useState, useMemo, useRef, useEffect } from 'react';
import { MaterialIcon } from '../../../components/common';
import { useMonitoringProcesses } from '../../../hooks/useInfra';
import { Skeleton } from '../../../components/skeleton';
import type { Process } from '../../../types/infra';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function parseCpuPct(val: string): number {
  return Math.max(0, parseFloat(val.replace('%', '')) || 0);
}

function parseMemoryToMB(val: string): number {
  const m = val.match(/([\d.]+)\s*(B|KB|MB|GB|TB)?/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  switch ((m[2] ?? 'MB').toUpperCase()) {
    case 'B':  return n / 1_048_576;
    case 'KB': return n / 1_024;
    case 'MB': return n;
    case 'GB': return n * 1_024;
    case 'TB': return n * 1_048_576;
    default:   return n;
  }
}

function formatMemMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1)    return `${Math.round(mb)} MB`;
  return `${Math.round(mb * 1024)} KB`;
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface ProcessGroup {
  name:            string;
  icon:            string;
  count:           number;
  totalCpuPct:     number;
  totalMemMB:      number;
  dominantStatus:  Process['status'];
  procs:           Process[];
}

const STATUS_DOT: Record<Process['status'], string> = {
  RUNNING: 'bg-emerald-500',
  IDLE:    'bg-amber-400',
  STOPPED: 'bg-red-500',
};

const STATUS_LABEL: Record<Process['status'], string> = {
  RUNNING: '실행 중',
  IDLE:    '유휴',
  STOPPED: '정지',
};

const COL = 'minmax(0,1fr) 130px 150px 72px 32px';

// ─── 루트 컴포넌트 ───────────────────────────────────────────────────────────

export function ProcessTable({ hostId, refreshKey = 0 }: { hostId: string; refreshKey?: number }) {
  const { data: processes, loading } = useMonitoringProcesses(hostId, refreshKey);

  const [topN,          setTopN]          = useState<5 | 10 | 20>(10);
  const [sortBy,        setSortBy]        = useState<'cpu' | 'memory'>('cpu');
  const [search,        setSearch]        = useState('');
  const [groupByName,   setGroupByName]   = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [openMenu,      setOpenMenu]      = useState<string | null>(null);

  const list = useMemo(() => processes ?? [], [processes]);

  const filtered = useMemo(() =>
    search.trim()
      ? list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : list,
    [list, search]);

  // 그룹화
  const groups = useMemo((): ProcessGroup[] => {
    const map = new Map<string, Process[]>();
    for (const p of filtered) {
      const arr = map.get(p.name) ?? [];
      arr.push(p);
      map.set(p.name, arr);
    }
    return [...map.entries()].map(([name, procs]) => ({
      name,
      icon:           procs[0].icon,
      count:          procs.length,
      totalCpuPct:    procs.reduce((s, p) => s + parseCpuPct(p.cpu), 0),
      totalMemMB:     procs.reduce((s, p) => s + parseMemoryToMB(p.memory), 0),
      dominantStatus: procs[0].status,
      procs,
    }));
  }, [filtered]);

  // 정렬 + Top-N (그룹 단위)
  const sortedGroups = useMemo(() =>
    [...groups]
      .sort((a, b) => sortBy === 'cpu'
        ? b.totalCpuPct - a.totalCpuPct
        : b.totalMemMB  - a.totalMemMB)
      .slice(0, topN),
    [groups, sortBy, topN]);

  // 정렬 + Top-N (개별 — 그룹 해제 시)
  const sortedProcs = useMemo(() =>
    [...filtered]
      .sort((a, b) => sortBy === 'cpu'
        ? parseCpuPct(b.cpu)        - parseCpuPct(a.cpu)
        : parseMemoryToMB(b.memory) - parseMemoryToMB(a.memory))
      .slice(0, topN),
    [filtered, sortBy, topN]);

  // 메모리 바 정규화 기준: 화면에 표시되는 최대값
  const maxMemMB = useMemo(() => {
    const vals = groupByName
      ? sortedGroups.map((g) => g.totalMemMB)
      : sortedProcs.map((p) => parseMemoryToMB(p.memory));
    return Math.max(...vals, 1);
  }, [groupByName, sortedGroups, sortedProcs]);

  // 요약
  const totalCpuPct = useMemo(() => list.reduce((s, p) => s + parseCpuPct(p.cpu), 0), [list]);
  const totalMemMB  = useMemo(() => list.reduce((s, p) => s + parseMemoryToMB(p.memory), 0), [list]);

  const toggleGroup = (name: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          프로세스
        </h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 검색 */}
          <div className="relative">
            <MaterialIcon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
            <input
              type="text"
              placeholder="이름으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-bg-surface-dark border border-slate-200 dark:border-ui-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary/50 dark:text-white dark:placeholder-text-muted-dark w-36"
            />
          </div>

          {/* 그룹화 토글 */}
          <button
            type="button"
            onClick={() => setGroupByName((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              groupByName
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-white dark:bg-bg-surface-dark border-slate-200 dark:border-ui-border-dark text-slate-500 dark:text-text-muted-dark'
            }`}
          >
            <MaterialIcon name="folder_copy" className="text-sm" />
            그룹
          </button>

          {/* Top-N */}
          <div className="flex bg-slate-100 dark:bg-ui-hover-dark rounded-lg p-0.5">
            {([5, 10, 20] as const).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTopN(n)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  topN === n
                    ? 'bg-white dark:bg-bg-surface-dark text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-text-muted-dark'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 요약 바 */}
      <div className="mb-3 flex items-center gap-4 px-3 py-2 rounded-lg bg-slate-50 dark:bg-ui-hover-dark/40 border border-slate-100 dark:border-ui-border-dark/50 text-xs flex-wrap">
        <span className="text-slate-400 dark:text-text-dim-dark">전체 {list.length}개 프로세스</span>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-text-dim-dark">CPU 합계</span>
          <span className="font-bold tabular-nums text-slate-700 dark:text-text-base-dark">{totalCpuPct.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-400 dark:text-text-dim-dark">메모리 합계</span>
          <span className="font-bold tabular-nums text-slate-700 dark:text-text-base-dark">{formatMemMB(totalMemMB)}</span>
        </div>
      </div>

      {/* 테이블 */}
      <div className="rounded-xl border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark overflow-hidden shadow-sm">
        {/* 컬럼 헤더 */}
        <div
          className="grid gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-ui-hover-dark/50 border-b border-slate-100 dark:border-ui-border-dark text-[11px] font-semibold text-slate-500 dark:text-text-muted-dark uppercase tracking-wide"
          style={{ gridTemplateColumns: COL }}
        >
          <span>프로세스</span>
          <SortHeader label="CPU" col="cpu" sortBy={sortBy} onSort={setSortBy} />
          <SortHeader label="메모리" col="memory" sortBy={sortBy} onSort={setSortBy} />
          <span>상태</span>
          <span />
        </div>

        {/* 행 */}
        <div className="divide-y divide-slate-50 dark:divide-ui-border-dark/30">
          {groupByName ? (
            sortedGroups.length === 0 ? <EmptyRow search={search} /> : (
              sortedGroups.map((group) => (
                <GroupRow
                  key={group.name}
                  group={group}
                  maxMemMB={maxMemMB}
                  sortBy={sortBy}
                  expanded={expandedGroups.has(group.name)}
                  onToggle={() => toggleGroup(group.name)}
                  openMenu={openMenu}
                  onMenuToggle={setOpenMenu}
                />
              ))
            )
          ) : (
            sortedProcs.length === 0 ? <EmptyRow search={search} /> : (
              sortedProcs.map((proc) => (
                <FlatRow
                  key={proc.id}
                  proc={proc}
                  maxMemMB={maxMemMB}
                  sortBy={sortBy}
                  openMenu={openMenu}
                  onMenuToggle={setOpenMenu}
                />
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ───────────────────────────────────────────────────────────

function SortHeader({
  label, col, sortBy, onSort,
}: {
  label: string;
  col: 'cpu' | 'memory';
  sortBy: 'cpu' | 'memory';
  onSort: (col: 'cpu' | 'memory') => void;
}) {
  const active = sortBy === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 cursor-pointer transition-colors hover:text-slate-900 dark:hover:text-white ${
        active ? 'text-primary font-bold' : ''
      }`}
    >
      {label}
      <MaterialIcon name={active ? 'arrow_downward' : 'unfold_more'} className="text-[11px]" />
    </button>
  );
}

function EmptyRow({ search }: { search: string }) {
  return (
    <div className="py-10 text-center text-sm text-slate-400 dark:text-text-muted-dark">
      {search ? `"${search}" 검색 결과 없음` : '프로세스 없음'}
    </div>
  );
}

function GroupRow({
  group, maxMemMB, sortBy, expanded, onToggle, openMenu, onMenuToggle,
}: {
  group:        ProcessGroup;
  maxMemMB:     number;
  sortBy:       'cpu' | 'memory';
  expanded:     boolean;
  onToggle:     () => void;
  openMenu:     string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const memPct = (group.totalMemMB / maxMemMB) * 100;
  const cpuPct = Math.min(group.totalCpuPct, 100);
  const multiProc = group.count > 1;

  return (
    <>
      <div
        className="grid gap-3 px-4 py-2.5 items-center transition-colors hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30"
        style={{ gridTemplateColumns: COL }}
      >
        {/* 프로세스명 */}
        <button
          type="button"
          onClick={multiProc ? onToggle : undefined}
          className={`flex items-center gap-2.5 min-w-0 text-left ${multiProc ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="w-7 h-7 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
            <MaterialIcon name={group.icon} className="text-sm text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-text-base-dark truncate">{group.name}</p>
          </div>
          {multiProc && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              ×{group.count}
            </span>
          )}
          {multiProc && (
            <MaterialIcon
              name={expanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              className="text-sm text-slate-400 shrink-0"
            />
          )}
        </button>

        {/* CPU */}
        <MetricBar value={group.totalCpuPct} pct={cpuPct} unit="%" active={sortBy === 'cpu'} isCpu />

        {/* Memory */}
        <MetricBar value={group.totalMemMB} pct={memPct} unit="" active={sortBy === 'memory'} formatFn={formatMemMB} />

        {/* 상태 */}
        <StatusDot status={group.dominantStatus} />

        {/* 액션 */}
        <ActionMenu
          id={`g-${group.name}`}
          openMenu={openMenu}
          onMenuToggle={onMenuToggle}
        />
      </div>

      {/* 펼쳐진 개별 행 */}
      {expanded && multiProc && group.procs.map((proc) => (
        <div
          key={proc.id}
          className="grid gap-3 px-4 py-2 items-center bg-slate-50/40 dark:bg-ui-hover-dark/20 border-t border-slate-50 dark:border-ui-border-dark/20"
          style={{ gridTemplateColumns: COL }}
        >
          {/* 들여쓰기 */}
          <div className="flex items-center gap-2.5 min-w-0 pl-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-600 dark:text-text-muted-dark truncate">{proc.name}</p>
              <p className="text-[10px] font-mono text-slate-400 dark:text-text-dim-dark">PID {proc.pid}</p>
            </div>
          </div>
          <MetricBar value={parseCpuPct(proc.cpu)} pct={Math.min(parseCpuPct(proc.cpu), 100)} unit="%" active={sortBy === 'cpu'} isCpu dim />
          <MetricBar value={parseMemoryToMB(proc.memory)} pct={(parseMemoryToMB(proc.memory) / maxMemMB) * 100} unit="" active={sortBy === 'memory'} formatFn={formatMemMB} dim />
          <StatusDot status={proc.status} />
          <ActionMenu id={proc.id} openMenu={openMenu} onMenuToggle={onMenuToggle} />
        </div>
      ))}
    </>
  );
}

function FlatRow({
  proc, maxMemMB, sortBy, openMenu, onMenuToggle,
}: {
  proc:         Process;
  maxMemMB:     number;
  sortBy:       'cpu' | 'memory';
  openMenu:     string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const cpuPct = Math.min(parseCpuPct(proc.cpu), 100);
  const memMB  = parseMemoryToMB(proc.memory);
  const memPct = (memMB / maxMemMB) * 100;

  return (
    <div
      className="grid gap-3 px-4 py-2.5 items-center transition-colors hover:bg-slate-50/60 dark:hover:bg-ui-hover-dark/30"
      style={{ gridTemplateColumns: COL }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 shrink-0 rounded-md bg-primary/10 flex items-center justify-center">
          <MaterialIcon name={proc.icon} className="text-sm text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-text-base-dark truncate">{proc.name}</p>
          <p className="text-[10px] font-mono text-slate-400 dark:text-text-dim-dark">PID {proc.pid}</p>
        </div>
      </div>

      <MetricBar value={parseCpuPct(proc.cpu)} pct={cpuPct} unit="%" active={sortBy === 'cpu'} isCpu />
      <MetricBar value={memMB} pct={memPct} unit="" active={sortBy === 'memory'} formatFn={formatMemMB} />
      <StatusDot status={proc.status} />
      <ActionMenu id={proc.id} openMenu={openMenu} onMenuToggle={onMenuToggle} />
    </div>
  );
}

function MetricBar({
  value, pct, unit, active, isCpu, formatFn, dim,
}: {
  value:     number;
  pct:       number;
  unit:      string;
  active:    boolean;
  isCpu?:    boolean;
  formatFn?: (v: number) => string;
  dim?:      boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));

  // 색상: CPU는 % 기반, 메모리는 bar 비율 기반
  const barColor =
    clamped >= 80 ? 'bg-red-500' :
    clamped >= 60 ? 'bg-amber-500' :
    isCpu && value >= 15 ? 'bg-lime-500' :
    'bg-primary';

  const textColor =
    clamped >= 80 ? 'text-red-600 dark:text-red-400' :
    clamped >= 60 ? 'text-amber-600 dark:text-amber-400' :
    isCpu && value >= 15 ? 'text-lime-600 dark:text-lime-400' :
    'text-slate-700 dark:text-text-base-dark';

  const label = formatFn ? formatFn(value) : `${value.toFixed(1)}${unit}`;

  return (
    <div className={dim ? 'opacity-70' : ''}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className={`text-xs font-bold tabular-nums ${active ? textColor : 'text-slate-500 dark:text-text-muted-dark'}`}>
          {label}
        </span>
      </div>
      <div className={`rounded-full bg-slate-100 dark:bg-ui-hover-dark overflow-hidden ${active ? 'h-2' : 'h-1 opacity-60'}`}>
        <div
          className={`h-full rounded-full ${active ? barColor : 'bg-slate-300 dark:bg-ui-hover-dark'}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Process['status'] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status]}`} />
      <span className="text-[11px] text-slate-500 dark:text-text-muted-dark font-medium">
        {STATUS_LABEL[status]}
      </span>
    </div>
  );
}

function ActionMenu({
  id, openMenu, onMenuToggle,
}: {
  id:           string;
  openMenu:     string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const isOpen = openMenu === id;
  const ref    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onMenuToggle(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onMenuToggle]);

  return (
    <div ref={ref} className="relative flex justify-center">
      <button
        type="button"
        onClick={() => onMenuToggle(isOpen ? null : id)}
        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-ui-hover-dark transition-colors"
      >
        <MaterialIcon name="more_vert" className="text-sm" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-7 z-20 w-32 rounded-lg border border-slate-200 dark:border-ui-border-dark bg-white dark:bg-bg-surface-dark shadow-lg py-1">
          <button
            type="button"
            onClick={() => onMenuToggle(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <MaterialIcon name="cancel" className="text-sm" />
            종료 (Terminate)
          </button>
        </div>
      )}
    </div>
  );
}
