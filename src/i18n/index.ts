import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Settings } from '@/domain/types';

import en from './en.json';
import tr from './tr.json';

export const LANGUAGES = ['en', 'tr'] as const;

function systemLanguage(): string {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return (LANGUAGES as readonly string[]).includes(code) ? code : 'en';
}

export function resolveLanguage(pref: Settings['language']): string {
  return pref === 'system' ? systemLanguage() : pref;
}

// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: systemLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
