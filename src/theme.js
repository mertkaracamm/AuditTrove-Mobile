import { t } from './i18n';
import { Platform } from 'react-native';

// AuditTrove marka teması — logo ve banner'dan türetildi.
// Koyu lacivert zemin, cyan ana renk, teal ikincil, altın "trove" vurgusu.
export const colors = {
  bg: '#050F33',          // ana zemin (koyu lacivert)
  bgDeep: '#020820',      // gradient koyu ucu
  card: '#0C1D4A',        // kartlar
  cardSoft: '#122455',    // kart üstü ikinci katman
  line: '#1D3263',        // kenarlıklar
  text: '#F1F6FF',        // ana metin
  textSoft: '#8DA2C8',    // ikincil metin

  cyan: '#05D9F0',        // ana marka rengi (logo belgesi)
  teal: '#02A5A5',        // ikincil (logo elmas)
  mint: '#5EEAD4',
  gold: '#F5C542',        // "trove" altın yıldız

  riskLow: '#2FD48E',
  riskMid: '#F5C542',
  riskHigh: '#FF6B5E',
  riskLowBg: 'rgba(47,212,142,0.14)',
  riskMidBg: 'rgba(245,197,66,0.14)',
  riskHighBg: 'rgba(255,107,94,0.14)',
  riskCritical: '#E0453A',
  riskCriticalBg: 'rgba(224,69,58,0.18)',
};

export const gradients = {
  hero: ['#0A2B5E', '#050F33'],            // ana ekran üst kısmı
  button: ['#05D9F0', '#02A5A5'],          // cyan → teal aksiyon butonu
  sealGlow: ['rgba(5,217,240,0.25)', 'rgba(5,217,240,0)'],
};

export const fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace' }),
};

// Eşikler backend'deki calibrateScore bantlarıyla birebir aynı:
// YUKSEK skor = temiz/guvenli (yesil), DUSUK skor = dikkat (kirmizi).
// Kullanici sezgisi: 100'e yakin iyi, 0'a yakin dikkat gerektiriyor.
// 80-100 temiz, 55-79 gozden gecir, 30-54 dikkatle, 0-29 madde madde.
export function riskColor(score) {
  if (score >= 80) return colors.riskLow;      // yesil — temiz
  if (score >= 55) return colors.riskMid;      // sari — gozden gecir
  if (score >= 30) return colors.riskHigh;     // turuncu — dikkatle
  return colors.riskCritical;                  // kirmizi — madde madde
}

export function riskBg(score) {
  if (score >= 80) return colors.riskLowBg;
  if (score >= 55) return colors.riskMidBg;
  if (score >= 30) return colors.riskHighBg;
  return colors.riskCriticalBg;
}

export function riskLabel(score) {
  if (score >= 80) return t('risk.lowLabel');       // Genel olarak temiz
  if (score >= 55) return t('risk.midLabel');       // Gözden geçir
  if (score >= 30) return t('risk.highLabel');      // Dikkatle incele
  return t('risk.criticalLabel');                   // Madde madde incele
}

// Render-zamaninda cozulur ki aktif dile (rapor diline) uysun.
// Modul yuklenirken t() dondurmak severity etiketlerini yanlis dile sabitliyordu.
export function getSeverityMap() {
  return {
    HIGH: { label: t('risk.high'), color: colors.riskHigh, bg: colors.riskHighBg },
    MEDIUM: { label: t('risk.mid'), color: colors.riskMid, bg: colors.riskMidBg },
    LOW: { label: t('risk.low'), color: colors.riskLow, bg: colors.riskLowBg },
  };
}