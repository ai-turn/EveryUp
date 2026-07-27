// 폼 셀렉트 — Input과 같은 셸을 쓴다. 나란히 쌓았을 때 높이·radius·배경이 맞아야 한다.
//
// 툴바 필터 셀렉트(`px-2 py-1.5 bg-bg-surface rounded-md …`)는 이 컴포넌트 대상이 아니다.
// 그쪽은 이미 5곳이 같은 문자열이고 폼 필드와 목적·크기가 다르다.

import type { ComponentPropsWithRef } from 'react';
import { FIELD_SHELL, FIELD_HEIGHT } from './Input';

const BASE = `${FIELD_SHELL} ${FIELD_HEIGHT} border-ui-border cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`;

export function Select({ className = '', ...props }: ComponentPropsWithRef<'select'>) {
  return <select className={`${BASE} ${className}`} {...props} />;
}
