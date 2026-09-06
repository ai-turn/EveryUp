// 알림 규칙·채널 폼의 공통 레이아웃 프리미티브.
//
// AlertRuleForm과 ChannelForm이 각자 같은 정의를 두고 있었다 — FormStep은 바이트 단위로
// 동일했고 Field는 ChannelForm 쪽만 error를 지원했다. 상위집합인 쪽을 정본으로 삼는다.
//
// alerts 밖에서 쓰는 곳이 생기면 그때 components/common으로 올린다.

import type { ReactNode } from 'react';

/** 번호가 붙은 폼 단계 카드. 헤더 스트립 + 본문. */
export function FormStep({ n, title, subtitle, children }: {
    n: number; title: string; subtitle?: string; children: ReactNode;
}) {
    return (
        <div className="bg-bg-surface border border-ui-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-ui-border bg-ui-hover-soft/50">
                <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs font-mono shrink-0">
                    {n}
                </span>
                <div>
                    <p className="text-sm font-semibold text-text-base uppercase tracking-wider">{title}</p>
                    {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5 space-y-5">{children}</div>
        </div>
    );
}

/** 라벨 + 입력 + 에러/힌트 한 묶음. error가 있으면 hint는 숨긴다.
 *
 * `htmlFor`를 주면 `<label>`로, 없으면 `<span>`으로 렌더한다.
 * 자식이 단일 입력이 아니라 버튼 그리드(카테고리·심각도·채널타입)인 경우가 있어
 * 무조건 `<label>`을 쓰면 안 된다 — `<button>`은 labelable이라 라벨 클릭이 첫 버튼을
 * 눌러버리고, 연결할 컨트롤이 없는 `<label>`은 스크린리더에 아무것도 주지 못한다.
 * 그런 자리는 `<span>` 캡션이 맞고, 그룹 자체에 `role="group"` + `aria-label`을 단다. */
export function Field({ label, hint, required, children, error, htmlFor }: {
    label: string; hint?: string | null; required?: boolean; error?: string;
    children: ReactNode; htmlFor?: string;
}) {
    const LabelTag = htmlFor ? 'label' : 'span';
    return (
        <div>
            <div className="flex items-center gap-1 mb-2">
                <LabelTag
                    {...(htmlFor ? { htmlFor } : {})}
                    className="text-sm font-semibold text-text-muted uppercase tracking-wide"
                >
                    {label}
                </LabelTag>
                {required && <span className="text-red-500 text-xs">*</span>}
            </div>
            {children}
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            {hint && !error && <p className="text-sm text-text-dim mt-1.5 italic">{hint}</p>}
        </div>
    );
}
