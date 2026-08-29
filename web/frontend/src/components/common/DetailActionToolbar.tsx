import type { ReactNode } from 'react';

interface DetailActionToolbarProps {
  controls: ReactNode;
  actions: ReactNode;
}

// 상세 화면의 조회 제어와 변경 액션을 분리한다.
// 모바일에서는 두 그룹이 제목 아래에서 순서대로 쌓이고, md 이상에서는 양 끝에 고정된다.
export function DetailActionToolbar({ controls, actions }: DetailActionToolbarProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {controls}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {actions}
      </div>
    </div>
  );
}
