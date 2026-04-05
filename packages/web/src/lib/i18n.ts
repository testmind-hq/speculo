import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import zh from '../locales/zh.json'

const savedLang = localStorage.getItem('speculo_lang') ?? 'en'

i18n.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  interpolation: { escapeValue: false },
})

export default i18n
