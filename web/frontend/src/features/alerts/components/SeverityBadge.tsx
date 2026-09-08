// 알림 severity 배지 — 규칙 표와 발송 이력 표가 같은 상수·같은 클래스를 각자 갖고 있었다.
//
// 알림 severity는 서비스 상태(status-*)와 다른 축이라 primitive를 그대로 쓴다.
// info 역할에 대응하는 status 토큰도 없다 (DESIGN.md §1.4).
//
// AlertRuleForm의 severity 표시는 이 배지가 아니다 — 알림이 어떻게 보일지 시뮬레이션하는
// 미리보기 카드(틴트 배경 + 점 + 보더)라 목적과 형태가 다르다.

import { severityLabel } from '../utils/severityLabel';

const TONE: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

export function SeverityBadge({ severity }: { severity: string }) {
    return (
        <span
            className={`badge ${TONE[severity] ?? TONE.info}`}
        >
            {severityLabel(severity)}
        </span>
    );
}
