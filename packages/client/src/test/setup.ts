import '@testing-library/jest-dom';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// jsdom does not implement matchMedia; the responsive hooks (useIsDesktop /
// useIsShortViewport) rely on it. Provide a no-match stub.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

import common from '../../public/locales/en/common.json';
import game from '../../public/locales/en/game.json';
import home from '../../public/locales/en/home.json';
import profile from '../../public/locales/en/profile.json';
import shop from '../../public/locales/en/shop.json';
import settings from '../../public/locales/en/settings.json';
import rules from '../../public/locales/en/rules.json';

// Initialize i18next synchronously with bundled English resources so components
// using `useTranslation` render real strings in tests (no HTTP backend, no Suspense).
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'game', 'home', 'profile', 'shop', 'settings', 'rules'],
  resources: { en: { common, game, home, profile, shop, settings, rules } },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});
