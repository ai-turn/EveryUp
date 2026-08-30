import { Tolgee, DevTools, FormatSimple } from '@tolgee/react';

import koSource from './locales/source/ko.json';

/**
 * Tolgee — source-as-key i18n for new/migrated code.
 *
 * Operation mode: JSON only (no Tolgee server). 한국어 전용이라 키(=한국어 원문)가
 * 그대로 렌더된다. `locales/source/ko.json`은 사전이 아니라 잔존 항목일 뿐이다.
 *
 * Placeholder syntax: Tolgee FormatSimple uses `{name}` (not `{{name}}`).
 */
export const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatSimple())
  .init({
    language: 'ko',
    fallbackLanguage: 'ko',
    staticData: { ko: koSource },
  });
