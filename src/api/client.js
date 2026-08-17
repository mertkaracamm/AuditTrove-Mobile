// ============================================================
// AuditTrove API istemcisi
//
// Akis ASYNC: belge /audit/async ile is olarak baslatilir, jobId alinir,
// /audit/jobs/{id} kisa aralikli sorgulanir (polling). Boylece uzun belgelerde
// tek uzun istek + timeout derdi kalkar; her sorgu birkac saniyedir.
//
// USE_MOCK = true iken gercek backend'e gidilmez, ornek sonuc doner.
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

// Async is baslatma icin upload timeout'u (buyuk PDF yuklemesi icin genis)
const SUBMIT_TIMEOUT_MS = 90000;
// Polling: her sorgu araligi ve toplam bekleme tavani
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_MS = 20 * 60 * 1000; // 20 dk: buyuk belge tam islenirken (~18 bolum) yeterli sure
const POLL_REQUEST_TIMEOUT_MS = 20000; // tek durum sorgusu icin

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bir PDF dosyasını incelemeye gönderir (async akış).
 * @param {{ uri: string, name: string, mimeType?: string }} file
 * @returns {Promise<object>} inceleme sonucu
 */
export async function auditDocument(file, documentType) {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return MOCK_RESULT;
  }

  let token = await getDeviceToken();

  // 1) Isi baslat (jobId al). Token duserse bir kez yeniden kaydol.
  let jobId = await submitJob(file, documentType, token);
  if (jobId === UNAUTHORIZED) {
    token = await getDeviceToken(true);
    jobId = await submitJob(file, documentType, token);
    if (jobId === UNAUTHORIZED) throw new Error(t('cli.serverError'));
  }

  // 2) Bitene kadar durumu sorgula
  return await pollJob(jobId, token);
}

const UNAUTHORIZED = Symbol('unauthorized');

async function submitJob(file, documentType, token) {
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
      {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      },
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
  if (response.status === 429) throw new Error(t('cli.hourlyLimit'));
  if (response.status !== 200 && response.status !== 202) {
    const text = await response.text().catch(() => '');
    throw new Error(`${t('cli.serverError')} (${response.status}): ${text || t('cli.unknownError')}`);
  }

  const data = await response.json();
  if (!data || !data.id) throw new Error(t('cli.serverError'));
  return data.id;
}

async function pollJob(jobId, token) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_MAX_MS) {
    await sleep(POLL_INTERVAL_MS);

    let response;
    try {
      response = await fetchWithTimeout(
        `${API_BASE_URL}/api/v1/audit/jobs/${jobId}`,
        { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
        POLL_REQUEST_TIMEOUT_MS
      );
    } catch (e) {
      // Tek sorgu takilirsa/kesilirse pes etme; sonraki turda tekrar dene
      continue;
    }

    if (response.status === 404) {
      // Is dustu ya da TTL ile silindi
      throw new Error(t('cli.timeout'));
    }
    if (!response.ok) {
      continue; // gecici hata olabilir, tekrar dene
    }

    const data = await response.json().catch(() => null);
    if (!data) continue;

    if (data.status === 'DONE') {
      if (!data.result) throw new Error(t('cli.serverError'));
      return data.result;
    }
    if (data.status === 'FAILED') {
      throw new Error(data.error || t('cli.serverError'));
    }
    // PENDING / PROCESSING → beklemeye devam
  }

  const err = new Error(t('cli.timeout'));
  err.code = 'TIMEOUT';
  throw err;
}