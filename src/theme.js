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

export function riskColor(score) {
  if (score >= 70) return colors.riskHigh;
  if (score >= 40) return colors.riskMid;
  return colors.riskLow;
}

export function riskBg(score) {
  if (score >= 70) return colors.riskHighBg;
  if (score >= 40) return colors.riskMidBg;
  return colors.riskLowBg;
}

export function riskLabel(score) {
  if (score >= 70) return t('risk.highLabel');
  if (score >= 40) return t('risk.midLabel');
  return t('risk.lowLabel');
}

export const severityMap = {
  HIGH: { label: t('risk.high'), color: colors.riskHigh, bg: colors.riskHighBg },
  MEDIUM: { label: t('risk.mid'), color: colors.riskMid, bg: colors.riskMidBg },
  LOW: { label: t('risk.low'), color: colors.riskLow, bg: colors.riskLowBg },
};
