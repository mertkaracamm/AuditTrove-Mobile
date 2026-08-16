import translations from './translations';

// cihaz dili tr ise tr, degilse en. expo-localization henuz
// native build'e girmediyse require patlar, o durumda tr'de kal.
let locale = 'tr';
try {
  const Localization = require('expo-localization');
  const code = Localization.getLocales?.()[0]?.languageCode;
  locale = code === 'tr' ? 'tr' : 'en';
} catch {}

export function getLocale() {
  return locale;
}

export function t(key, vars) {
  let s = translations[locale][key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace('{' + k + '}', String(v));
    }
  }
  return s;
}
