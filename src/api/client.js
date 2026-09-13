// ============================================================
// AuditTrove API istemcisi (async job tabanli)
//
// Is /audit/async ile baslatilir (jobId), /audit/jobs/{id} sorgulanir.
// Polling'i JobContext yurutur; burada tekil "baslat" ve "bir kez sorgula" var.
// USE_MOCK = true iken gercek backend'e gidilmez.
// ============================================================

export const USE_MOCK = false;
export const API_BASE_URL = 'https://audittrove-staging-production.up.railway.app';

const MOCK_DELAY_MS = 4500;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateDeviceId } from './device';
import { t, getLocale } from '../i18n';
import * as FileSystem from 'expo-file-system/legacy';

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

// SDK 54+ / New Architecture: RN fetch, FormData'ya {uri} objesiyle dosya eklemeyi
// desteklemiyor ("Unsupported FormDataPart implementation"); upload uploadAsync ile yapilir.
async function submitOnce(file, documentType, token, language) {
  const task = FileSystem.createUploadTask(
    `${API_BASE_URL}/api/v1/audit/async`,
    file.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.mimeType || 'application/pdf',
      parameters: {
        language: language || getLocale(),
        documentType: documentType || 'general',
      },
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }
  );

  let timer;
  let response;
  try {
    response = await Promise.race([
      task.uploadAsync(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          task.cancelAsync().catch(() => {});
          const err = new Error(t('cli.timeout'));
          err.code = 'TIMEOUT';
          reject(err);
        }, SUBMIT_TIMEOUT_MS);
      }),
    ]);
  } catch (e) {
    if (e && e.code === 'TIMEOUT') throw e;
    throw new Error(t('cli.networkError'));
  } finally {
    clearTimeout(timer);
  }

  if (!response) throw new Error(t('cli.networkError'));
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
    throw new Error(`${t('cli.serverError')} (${response.status}): ${response.body || t('cli.unknownError')}`);
  }
  let data = null;
  try { data = JSON.parse(response.body); } catch {}
  if (!data || !data.id) throw new Error(t('cli.serverError'));
  return data.id;
}
/**
 * Inceleme isini baslatir, jobId doner. (Mock modda 'mock:...' doner.)
 * @returns {Promise<{ id: string }>}
 */
export async function startAuditJob(file, documentType, language) {
  if (USE_MOCK) {
    return { id: `mock:${Date.now()}` };
  }
  // Rapor dili telefon dilidir; belge dili değil.
  const lang = language || getLocale();
  let token = await getDeviceToken();
  let id = await submitOnce(file, documentType, token, lang);
  if (id === UNAUTHORIZED) {
    token = await getDeviceToken(true);
    id = await submitOnce(file, documentType, token, lang);
    if (id === UNAUTHORIZED) throw new Error(t('cli.serverError'));
  }
  return { id };
}

/**
 * Is durumunu BIR kez sorgular. Polling'i cagiran yonetir.
 * @returns {Promise<{ status: 'PENDING'|'PROCESSING'|'DONE'|'FAILED'|'INTERRUPTED'|'GONE', result?: object, error?: string }>}
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

/**
 * Push token uretilemediginde sebebi backend'e bildirir; sunucu loguna duser.
 * Cihazda hicbir sey gostermez, akisi etkilemez.
 */
export async function reportPushFailure(reason) {
  if (USE_MOCK) return;
  try {
    const token = await getDeviceToken();
    await fetch(`${API_BASE_URL}/api/v1/devices/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ pushToken: '', error: String(reason || 'unknown').slice(0, 300) }),
    });
  } catch (e) {
    // sessiz
  }
}

/**
 * Devam eden async incelemeyi iptal eder (backend push/kota gondermesin). Sessiz basarisiz olur.
 */
export async function cancelAuditJob(jobId) {
  if (USE_MOCK || !jobId || (typeof jobId === 'string' && jobId.startsWith('mock:'))) return;
  try {
    const token = await getDeviceToken();
    await fetch(`${API_BASE_URL}/api/v1/audit/jobs/${jobId}/cancel`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    // sessiz
  }
}

const CHAT_TIMEOUT_MS = 60000;

// Sunucuya giden rapor küçültülür: sayfa metinleri ayrıca `pages` ile gider, konum kutuları soruya gerekmez.
function slimReport(report) {
  if (!report) return null;
  const { pageTexts, ...rest } = report;
  return {
    ...rest,
    risks: (rest.risks || []).map(({ anchors, ...r }) => r),
  };
}

async function chatOnce(body, token) {
  let response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/audit/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      CHAT_TIMEOUT_MS
    );
  } catch (e) {
    const err = new Error(t('cli.networkError'));
    err.code = e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    throw err;
  }
  if (response.status === 401) return UNAUTHORIZED;
  if (response.status === 429) {
    const err = new Error(t('chat.hourlyLimit'));
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (!response.ok) {
    const err = new Error(t('chat.failed'));
    err.code = 'SERVER';
    throw err;
  }
  const data = await response.json().catch(() => null);
  if (!data || typeof data.answer !== 'string') {
    const err = new Error(t('chat.failed'));
    err.code = 'SERVER';
    throw err;
  }
  return { answer: data.answer, pages: Array.isArray(data.pages) ? data.pages : [], grounded: Boolean(data.grounded) };
}

/**
 * Rapora soru sorar. Durumsuz: soru + rapor + sayfa metinleri her seferinde gider, sunucu saklamaz.
 * @returns {Promise<{answer:string, pages:number[], grounded:boolean}>}
 */
export async function askReportQuestion({ question, language, report, pages }) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1200));
    return { answer: 'Örnek cevap: aylık kira bedeli 42.500 TL olarak belirtilmiş.', pages: [2], grounded: true };
  }
  const body = { question, language: language || getLocale(), report: slimReport(report), pages: pages || [] };
  let token = await getDeviceToken();
  let out = await chatOnce(body, token);
  if (out === UNAUTHORIZED) {
    token = await getDeviceToken(true);
    out = await chatOnce(body, token);
    if (out === UNAUTHORIZED) throw new Error(t('cli.serverError'));
  }
  return out;
}

const DIFF_TIMEOUT_MS = 120000;

// İki dosya tek multipart'a sığmadığı için (uploadAsync tek dosya taşır) PDF'ler base64 JSON gövdeyle gider.
// Sunucu ikisini işler, saklamaz. 15 MB'a kadar belgeler için yeterli; daha büyüğü zaten inceleme sınırı dışında.
async function diffOnce(body, token) {
  let response;
  try {
    response = await fetchWithTimeout(
      `${API_BASE_URL}/api/v1/audit/diff`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      DIFF_TIMEOUT_MS
    );
  } catch (e) {
    const err = new Error(e && e.name === 'AbortError' ? t('cli.timeout') : t('cli.networkError'));
    err.code = e && e.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK';
    throw err;
  }
  if (response.status === 401) return UNAUTHORIZED;
  if (response.status === 429) {
    const err = new Error(t('diff.hourlyLimit'));
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (response.status === 400) {
    const data = await response.json().catch(() => null);
    const err = new Error((data && data.error) || t('diff.failed'));
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!response.ok) {
    const err = new Error(t('diff.failed'));
    err.code = 'SERVER';
    throw err;
  }
  const data = await response.json().catch(() => null);
  if (!data || !Array.isArray(data.changes)) {
    const err = new Error(t('diff.failed'));
    err.code = 'SERVER';
    throw err;
  }
  return data;
}

/**
 * İki belge sürümünü karşılaştırır (eski → yeni). Dosyalar cihazdaki URI'lerdir.
 * @returns {Promise<{language:string, summary:string, changes:object[], matchedRatio:number, pageCountA:number, pageCountB:number}>}
 */
export async function compareDocuments(oldUri, newUri, language) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 1500));
    return { language: 'tr', summary: '1 değişiklik', changes: [], matchedRatio: 1, pageCountA: 1, pageCountB: 1, unchangedUnits: 5 };
  }
  const [oldFile, newFile] = await Promise.all([
    FileSystem.readAsStringAsync(oldUri, { encoding: 'base64' }),
    FileSystem.readAsStringAsync(newUri, { encoding: 'base64' }),
  ]);
  const body = { oldFile, newFile, language: language || getLocale() };
  let token = await getDeviceToken();
  let out = await diffOnce(body, token);
  if (out === UNAUTHORIZED) {
    token = await getDeviceToken(true);
    out = await diffOnce(body, token);
    if (out === UNAUTHORIZED) throw new Error(t('cli.serverError'));
  }
  return out;
}
