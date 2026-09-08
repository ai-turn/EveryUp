// 라벨 있는 액션 버튼의 단일 소스.
// 이전엔 primary 버튼 클래스 문자열만 13종이라 높이·radius·굵기가 화면마다 어긋났다.
//
// 크기는 **높이로 고정**한다 (px/py 조합 금지) — 나란히 놓았을 때 밑변이 맞아야 한다.
// 아이콘 전용 토글 버튼(p-2 rounded-lg + 아이콘 하나)은 이 컴포넌트 대상이 아니다.

import type { ComponentPropsWithRef, ReactNode } from 'react';

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary/90',
  secondary: 'bg-bg-surface border border-ui-border text-text-secondary hover:bg-ui-hover',
  ghost: 'text-text-muted hover:text-text-base hover:bg-ui-hover',
  danger: 'bg-red-600 text-white hover:bg-red-700',
} as const;

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1',
  md: 'h-10 px-4 text-sm gap-1.5',
  lg: 'h-11 px-5 text-sm gap-2',
} as const;

// focus-visible 링은 index.css의 전역 규칙이 처리한다 — 여기서 중복 정의하지 않는다.
const BASE =
  'inline-flex items-center justify-center shrink-0 rounded-lg font-medium ' +
  'transition-all active:scale-95 cursor-pointer ' +
  'disabled:opacity-50 disabled:pointer-events-none';

// ComponentPropsWithRef: React 19는 ref를 일반 prop으로 넘긴다 (forwardRef 불필요).
interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
