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

// Keep <html lang> and text direction (RTL for Arabic) in sync with the language
function updateHtmlAttributes(lng: string) {
  if (typeof document === 'undefined') return;
  const base = (lng || 'de').split('-')[0];
  document.documentElement.lang = base;
  document.documentElement.dir = base === 'ar' ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', updateHtmlAttributes);

// Set initial language + direction
if (i18n.language) {
  updateHtmlAttributes(i18n.language);
}

export default i18n;
