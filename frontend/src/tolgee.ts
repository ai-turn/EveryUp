import { Tolgee, DevTools, FormatSimple } from '@tolgee/react';

import koSource from './locales/source/ko.json';
import enSource from './locales/source/en.json';

/**
 * Tolgee — source-as-key i18n for new/migrated code.
 *
 * Operation mode: JSON only (no Tolgee server). Source strings are in Korean;
 * the key IS the Korean source. English translations live in `locales/source/en.json`.
 *
 * Coexists with `src/i18n.ts` (react-i18next) during the gradual migration.
 * Tolgee handles only content that has been converted to source-as-key.
 * react-i18next continues hosting `common`, `errors`, and not-yet-migrated
 * feature namespaces.
 *
 * Placeholder syntax: Tolgee FormatSimple uses `{name}` (not `{{name}}`).
 */
export const tolgee = Tolgee()
  .use(DevTools())
  .use(FormatSimple())
  .init({
    language:
      (typeof localStorage !== 'undefined' && localStorage.getItem('i18nextLng')) || 'ko',
    fallbackLanguage: 'ko',
    staticData: {
      ko: koSource,
      en: enSource,
    },
  });
