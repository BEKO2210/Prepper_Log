import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import de from './locales/de/translation.json';
import en from './locales/en/translation.json';
import pt from './locales/pt/translation.json';
import ar from './locales/ar/translation.json';
import it from './locales/it/translation.json';
import fr from './locales/fr/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
      pt: { translation: pt },
      ar: { translation: ar },
      it: { translation: it },
      fr: { translation: fr },
    },
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'preptrack-language',
      caches: ['localStorage'],
    },
  });

// Set dir attribute for RTL languages (Arabic)
function updateDirection(lng: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  }
}

i18n.on('languageChanged', updateDirection);

// Set initial direction
if (i18n.language) {
  updateDirection(i18n.language);
}

export default i18n;
