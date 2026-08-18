// ============================================================
// AuditTrove API istemcisi (async job tabanli)
//
// Is /audit/async ile baslatilir (jobId), /audit/jobs/{id} sorgulanir.
// Polling'i JobContext yurutur; burada tekil "baslat" ve "bir kez sorgula" var.
// USE_MOCK = true iken gercek backend'e gidilmez.
// ============================================================

export const USE_MOCK = false;
export const API_BASE_URL = 'https://audittrove-production.up.railway.app';

const MOCK_DELAY_MS = 4500;

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
  if (!response.ok) throw new Error(t('cli.deviceRegFail'));
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
        'yükümlülüklerin karşılanma kapasitesinin zayıfladığına işaret ediyor.',
    },
    {
      title: 'Alacakların tek müşteri grubunda yoğunlaşması',
      severity: 'HIGH',
      evidence:
        's. 57, Ticari Alacaklar dipnotu: "Ticari alacakların %61\u2019i tek bir müşteri grubuna aittir."',
      explanation:
        'Alacak portföyünün bu ölçüde yoğunlaşması, karşı taraf riskini önemli ölçüde artırır.',
    },
    {
      title: 'Koşullu yükümlülüklere ilişkin sınırlı açıklama',
      severity: 'MEDIUM',
      evidence: 's. 63: "Devam eden davalara ilişkin karşılık ayrılmamıştır."',
      explanation:
        'Devam eden hukuki süreçlerin tutarı ve olasılık değerlendirmesi raporda açıklanmamış.',
    },
    {
      title: 'Stok devir hızında yavaşlama',
      severity: 'LOW',
      evidence:
        's. 38: "Stoklar önceki döneme göre %24 artarken satışlar %6 artmıştır."',
      explanation:
        'Stok artışının satış büyümesinin belirgin üzerinde olması, değer düşüklüğü riskine işaret edebilir.',
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

const SUBMIT_TIMEOUT_MS = 90000; // buyuk PDF upload'u icin genis
const POLL_REQUEST_TIMEOUT_MS = 20000; // tek durum sorgusu

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const UNAUTHORIZED = Symbol('unauthorized');

async function submitOnce(file, documentType, token) {
  const formData = new FormData();
  formData.append('language', getLocale());
  formData.append('documentType', documentType || 'general');
  formData.append('file', {
    uri: file.uri,
    name: file.name || 'document.pdf',
    type: file.mimeType || 'application/pdf',
  });

  let response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/audit/async`,
      { method: 'POST', body: formData, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      SUBMIT_TIMEOUT_MS
    );
  } catch (e) {
    if (e && e.name === 'AbortError') {
      const err = new Error(t('cli.timeout'));
      err.code = 'TIMEOUT';
      throw err;
    }
    throw new Error(t('cli.networkError'));
  }

  if (response.status === 401) return UNAUTHORIZED;
  if (response.status === 402) {
    const err = new Error(t('cli.monthlyLimit'));
    err.code = 'MONTHLY_LIMIT_REACHED';
    throw err;
  }
  if (response.status === 429) {
    const err = new Error(t('cli.hourlyLimit'));
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (response.status !== 200 && response.status !== 202) {
    const text = await response.text().catch(() => '');
    throw new Error(`${t('cli.serverError')} (${response.status}): ${text || t('cli.unknownError')}`);
  }
  const data = await response.json();
  if (!data || !data.id) throw new Error(t('cli.serverError'));
  return data.id;
}

/**
 * Inceleme isini baslatir, jobId doner. (Mock modda 'mock:...' doner.)
 * @returns {Promise<{ id: string }>}
 */
export async function startAuditJob(file, documentType) {
  if (USE_MOCK) {
    return { id: `mock:${Date.now()}` };
  }
  let token = await getDeviceToken();
  let id = await submitOnce(file, documentType, token);
  if (id === UNAUTHORIZED) {
    token = await getDeviceToken(true);
    id = await submitOnce(file, documentType, token);
    if (id === UNAUTHORIZED) throw new Error(t('cli.serverError'));
  }
  return { id };
}

/**
 * Is durumunu BIR kez sorgular. Polling'i cagiran yonetir.
 * @returns {Promise<{ status: 'PENDING'|'PROCESSING'|'DONE'|'FAILED'|'GONE', result?: object, error?: string }>}
 */
export async function pollAuditJobOnce(jobId) {
  if (typeof jobId === 'string' && jobId.startsWith('mock:')) {
    const started = parseInt(jobId.slice(5), 10) || 0;
    if (Date.now() - started >= MOCK_DELAY_MS) return { status: 'DONE', result: MOCK_RESULT };
    return { status: 'PROCESSING' };
  }

  const token = await getDeviceToken();
  let response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/audit/jobs/${jobId}`,
      { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      POLL_REQUEST_TIMEOUT_MS
    );
  } catch (e) {
    return { status: 'PROCESSING' }; // gecici hata → sonraki turda tekrar
  }

  if (response.status === 404) return { status: 'GONE' };
  if (!response.ok) return { status: 'PROCESSING' };

  const data = await response.json().catch(() => null);
  if (!data || !data.status) return { status: 'PROCESSING' };
  return { status: data.status, result: data.result, error: data.error };
}

/**
 * Cihazin Expo push token'ini backend'e kaydeder (auth'lu). Sessiz basarisiz olur.
 */
export async function registerPushToken(pushToken) {
  if (USE_MOCK || !pushToken) return;
  try {
    const token = await getDeviceToken();
    await fetch(`${API_BASE_URL}/api/v1/devices/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pushToken }),
    });
  } catch (e) {
    // sessiz
  }
}