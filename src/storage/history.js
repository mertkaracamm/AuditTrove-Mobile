import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteDocument, deleteAllDocuments, savePageTexts } from './documents';

const KEY = 'audittrove:history';
const QUESTIONS_KEY = 'audittrove:questionsUsed';
const MAX_ITEMS = 50;

export async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Kayıtla birlikte belgenin cihazdaki kopyası (localUri) da tutulur; listeden düşen kaydın dosyası silinir.
export async function addToHistory(entry) {
  const history = await getHistory();
  const id = String(Date.now());
  // Sayfa metinleri kayıttan ayrılıp dosyaya yazılır; kayıt yalnızca dosyanın yerini (pagesUri) tutar.
  const { pageTexts, ...report } = entry.result || {};
  const pagesUri = await savePageTexts(id, pageTexts);
  const item = {
    id,
    createdAt: new Date().toISOString(),
    ...entry,
    result: report,
    pagesUri,
  };
  const all = [item, ...history];
  const next = all.slice(0, MAX_ITEMS);
  for (const dropped of all.slice(MAX_ITEMS)) {
    if (dropped.localUri) deleteDocument(dropped.localUri);
    if (dropped.pagesUri) deleteDocument(dropped.pagesUri);
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return item;
}

// Geçmişi temizlemek soru ve karşılaştırma sayaçlarını da sıfırlar; kayıt gidince sayacın bağlanacağı şey kalmaz.
export async function clearHistory() {
  await AsyncStorage.removeItem(KEY);
  await AsyncStorage.removeItem(QUESTIONS_KEY);
  await AsyncStorage.removeItem('audittrove:diffUsed');
  await deleteAllDocuments();
}

// İnceleme başına sorulan soru sayısı (ücretsiz hak buna göre). Sunucu raporu tanımadığı için sayaç cihazda.
async function readQuestionCounts() {
  try {
    const raw = await AsyncStorage.getItem(QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function getQuestionCount(historyId) {
  if (!historyId) return 0;
  const counts = await readQuestionCounts();
  return counts[historyId] || 0;
}

export async function incrementQuestionCount(historyId) {
  if (!historyId) return 0;
  const counts = await readQuestionCounts();
  counts[historyId] = (counts[historyId] || 0) + 1;
  try { await AsyncStorage.setItem(QUESTIONS_KEY, JSON.stringify(counts)); } catch (e) {}
  return counts[historyId];
}

// Karşılaştırma hakkı: ayda 2 ücretsiz (cihazda, ay anahtarıyla). Pro'da sayılmaz.
const DIFF_KEY = 'audittrove:diffUsed';

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getDiffCountThisMonth() {
  try {
    const raw = await AsyncStorage.getItem(DIFF_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data.month === monthKey() ? data.count || 0 : 0;
  } catch {
    return 0;
  }
}

export async function incrementDiffCount() {
  const count = (await getDiffCountThisMonth()) + 1;
  try { await AsyncStorage.setItem(DIFF_KEY, JSON.stringify({ month: monthKey(), count })); } catch (e) {}
  return count;
}
