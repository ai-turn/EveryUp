import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Korean
import koCommon from './locales/ko/common.json';
import koAuth from './locales/ko/auth.json';
import koDashboard from './locales/ko/dashboard.json';
import koLogs from './locales/ko/logs.json';
import koInfra from './locales/ko/infra.json';
import koAlerts from './locales/ko/alerts.json';
import koSettings from './locales/ko/settings.json';
import koErrors from './locales/ko/errors.json';

// English
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enLogs from './locales/en/logs.json';
import enInfra from './locales/en/infra.json';
import enAlerts from './locales/en/alerts.json';
import enSettings from './locales/en/settings.json';
import enErrors from './locales/en/errors.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: {
        common: koCommon,
        auth: koAuth,
        dashboard: koDashboard,
        logs: koLogs,
        infra: koInfra,
        alerts: koAlerts,
        settings: koSettings,
        errors: koErrors,
      },
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        logs: enLogs,
        infra: enInfra,
        alerts: enAlerts,
        settings: enSettings,
        errors: enErrors,
      },
    },
    defaultNS: 'common',
    fallbackNS: 'common',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },
  });

export default i18n;
