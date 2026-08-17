// ============================================================
// AuditTrove API istemcisi
//
// SU AN MOCK MODDA CALISIYOR: gercek backend'e istek atmaz,
// ornek bir inceleme sonucu doner. Backend'i mobile actiginda:
//
//   1. USE_MOCK = false yap
//   2. API_BASE_URL'i kendi adresinle degistir
//
// ============================================================

export const USE_MOCK = false;
export const API_BASE_URL = 'https://audittrove-production.up.railway.app';

const MOCK_DELAY_MS = 4500;

// cihaz kaydi + token
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateDeviceId } from './device';
import { t, getLocale } from '../i18n';

const TOKEN_KEY = 'audittrove:deviceToken';

async function getDeviceToken(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await AsyncStorage.getItem(TOKEN_KEY);
    if (cached) return cached;
  }

  const deviceId = await getOrCreateDeviceId();

  const response = await fetch(`${API_BASE_URL}/api/v1/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ deviceId }),
  });
  if (!response.ok) {
    throw new Error(t('cli.deviceRegFail'));
  }
  const data = await response.json();
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

const MOCK_RESULT = {
  riskScore: 81,
  summary:
    'İncelenen faaliyet raporu, dikkatle değerlendirilmesi gereken birden fazla ' +
    'bulgu içermektedir. Kısa vadeli likidite göstergelerindeki zayıflama, tek bir ' +
    'müşteri grubunda yoğunlaşan alacaklar ve raporda sınırlı açıklanan koşullu ' +
    'yükümlülükler, finansal tabloların bir uzman tarafından ayrıntılı incelenmesini ' +
    'gerektirmektedir.',
  risks: [
    {
      title: 'Kısa vadeli likidite göstergelerinde belirgin zayıflama',
      severity: 'HIGH',
      evidence:
        's. 42, Nakit Akış Tablosu: "İşletme faaliyetlerinden nakit akışı önceki döneme göre %38 azalmıştır."',
      explanation:
        'Cari oran ve işletme sermayesindeki eş zamanlı düşüş, kısa vadeli ' +
        'yükümlülüklerin karşılanma kapasitesinin zayıfladığına işaret ediyor. ' +
        'Nakit akış projeksiyonlarının ve kredi limitlerinin gözden geçirilmesi önerilir.',
    },
    {
      title: 'Alacakların tek müşteri grubunda yoğunlaşması',
      severity: 'HIGH',
      evidence:
        's. 57, Ticari Alacaklar dipnotu: "Ticari alacakların %61\u2019i tek bir müşteri grubuna aittir."',
      explanation:
        'Alacak portföyünün bu ölçüde yoğunlaşması, karşı taraf riskini önemli ölçüde ' +
        'artırır. İlgili müşteri grubunun ödeme geçmişi ve teminat yapısı ayrıca incelenmelidir.',
    },
    {
      title: 'Koşullu yükümlülüklere ilişkin sınırlı açıklama',
      severity: 'MEDIUM',
      evidence: 's. 63: "Devam eden davalara ilişkin karşılık ayrılmamıştır."',
      explanation:
        'Devam eden hukuki süreçlerin tutarı ve olasılık değerlendirmesi raporda ' +
        'açıklanmamış. Olası yükümlülüklerin büyüklüğü, finansal tablolar üzerinde ' +
        'önemli etki yaratabilir.',
    },
    {
      title: 'Stok devir hızında yavaşlama',
      severity: 'LOW',
      evidence:
        's. 38: "Stoklar önceki döneme göre %24 artarken satışlar %6 artmıştır."',
      explanation:
        'Stok artışının satış büyümesinin belirgin üzerinde olması, değer düşüklüğü ' +
        'riski taşıyan yavaş hareket eden stokların varlığına işaret edebilir.',
    },
  ],
  recommendations: [
    'Nakit akış projeksiyonlarını ve kullanılabilir kredi limitlerini gözden geçirin.',
    'Yoğunlaşan alacaklar için müşteri grubunun ödeme geçmişini ve teminatları inceleyin.',
    'Devam eden davaların tutarı ve olasılığı hakkında ek bilgi talep edin.',
    'Yavaş hareket eden stoklar için değer düşüklüğü testi yapılmasını değerlendirin.',
  ],
  references: [
    { source: 'Sayfa 42 — Nakit Akış Tablosu', note: 'Likidite bulgusunun kaynağı' },
    { source: 'Sayfa 57 — Ticari Alacaklar dipnotu', note: 'Alacak yoğunlaşması' },
    { source: 'Sayfa 63 — Karşılıklar ve Koşullu Yükümlülükler', note: 'Dava açıklamaları' },
    { source: 'Sayfa 38 — Stoklar', note: 'Stok devir hızı' },
  ],
};

/**
 * Bir PDF dosyasını incelemeye gönderir.
 * @param {{ uri: string, name: string, mimeType?: string }} file
 * @returns {Promise<object>} inceleme sonucu
 */
export async function auditDocument(file, documentType) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return MOCK_RESULT;
  }

  const formData = new FormData();
  formData.append('language', getLocale());
  formData.append('documentType', documentType || 'general');
  formData.append('file', {
    uri: file.uri,
    name: file.name || 'document.pdf',
    type: file.mimeType || 'application/pdf',
  });

  let token = await getDeviceToken();

  let response = await sendAudit(formData, token, file.size);

  // token duserse bir kez yeniden kaydol
  if (response.status === 401) {
    token = await getDeviceToken(true);
    response = await sendAudit(formData, token, file.size);
  }

  if (response.status === 402) {
    const err = new Error(t('cli.monthlyLimit'));
    err.code = 'MONTHLY_LIMIT_REACHED';
    throw err;
  }

  if (response.status === 429) {
    throw new Error(t('cli.hourlyLimit'));
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${t('cli.serverError')} (${response.status}): ${text || t('cli.unknownError')}`);
  }

  return response.json();
}

// Belge boyutuna gore timeout: kucuk belge 90 sn taban, buyuk belgede
// backend chunking devreye girecegi icin MB basina ek sure, tavan 10 dk.
// 288 sayfalik yillik rapor ~10 OpenAI cagrisi = dakikalar surer, sabit 90 sn yetmez.
function auditTimeoutMs(fileSizeBytes) {
  const base = 90000;   // taban 90 sn
  const perMb = 60000;  // her MB icin +60 sn
  const mb = (fileSizeBytes || 0) / (1024 * 1024);
  return Math.min(base + Math.round(mb * perMb), 600000); // tavan 10 dk
}

async function sendAudit(formData, token, fileSizeBytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), auditTimeoutMs(fileSizeBytes));
  try {
    return await fetch(`${API_BASE_URL}/api/v1/audit`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') {
      const err = new Error(t('cli.timeout'));
      err.code = 'TIMEOUT';
      throw err;
    }
    throw new Error(t('cli.networkError'));
  } finally {
    clearTimeout(timer);
  }
}