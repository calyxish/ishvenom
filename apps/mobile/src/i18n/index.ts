import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import ha from './locales/ha.json';
import sw from './locales/sw.json';
import tw from './locales/tw.json';

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
const supported = ['en', 'fr', 'ar', 'ha', 'sw', 'tw'] as const;
const initial = supported.includes(deviceLocale as (typeof supported)[number])
  ? deviceLocale
  : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
    ha: { translation: ha },
    sw: { translation: sw },
    tw: { translation: tw },
  },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // Hermes (React Native JS engine) doesn't ship Intl.PluralRules —
  // use the built-in v3 plural format to avoid the runtime warning.
  compatibilityJSON: 'v3',
});

export default i18n;
