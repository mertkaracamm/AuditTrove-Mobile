import translations from './translations';

// Cihaz dili tr ise tr, degilse en. expo-localization henuz native build'e girmediyse
// require patlar, o durumda tr'de kal. Bu "cihaz dili" = varsayilan/uygulama dili.
let deviceLocale = 'tr';
try {
  const Localization = require('expo-localization');
  const code = Localization.getLocales?.()[0]?.languageCode;
  deviceLocale = code === 'tr' ? 'tr' : 'en';
} catch {}

// Aktif locale runtime'da gecici olarak degistirilebilir (or. baska dilde uretilmis
// kayitli bir raporu goruntulerken arayuzu o rapora ait dile sabitlemek icin).
let activeLocale = deviceLocale;

export function getDeviceLocale() {
  return deviceLocale;
}

export function getLocale() {
  return activeLocale;
}

// Gecici override: rapor diline gore arayuzu kilitle. null verilince cihaz diline doner.
export function setActiveLocale(loc) {
  activeLocale = loc === 'tr' || loc === 'en' ? loc : deviceLocale;
}

export function t(key, vars) {
  let s = translations[activeLocale][key] ?? translations.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace('{' + k + '}', String(v));
    }
  }
  return s;
}