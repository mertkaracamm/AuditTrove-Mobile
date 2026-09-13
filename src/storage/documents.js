// İncelenen belgenin cihazdaki kalıcı kopyası. Görüntüleyici bu dosyayı açar; sunucuya hiçbir şey
// yazılmaz, "belgeler saklanmaz" taahhüdü cihaz dışına çıkmadığı için korunur. Kayıt geçmişten
// silinince dosya da silinir.
import * as FileSystem from 'expo-file-system/legacy';

const DIR = FileSystem.documentDirectory + 'documents/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

/** Seçilen/taranan PDF'i kalıcı klasöre kopyalar, kalıcı URI döner; kopyalanamazsa null. */
export async function keepDocumentCopy(sourceUri, key) {
  try {
    if (!sourceUri) return null;
    await ensureDir();
    const safeKey = String(key || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const target = `${DIR}${safeKey}.pdf`;
    await FileSystem.copyAsync({ from: sourceUri, to: target });
    return target;
  } catch (e) {
    return null;
  }
}

// Sayfa metinleri incelemeyle birlikte iner; soru-cevap her soruda ilgili sayfaları sunucuya geri gönderir.
// AsyncStorage'a değil dosyaya yazılır: uzun belgede yüzlerce KB tutar, geçmiş listesini şişirmesin.
export async function savePageTexts(key, pages) {
  try {
    if (!pages || !pages.length) return null;
    await ensureDir();
    const safeKey = String(key || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '');
    const target = `${DIR}${safeKey}.pages.json`;
    await FileSystem.writeAsStringAsync(target, JSON.stringify(pages));
    return target;
  } catch (e) {
    return null;
  }
}

export async function loadPageTexts(uri) {
  try {
    if (!uri) return [];
    const raw = await FileSystem.readAsStringAsync(uri);
    const pages = JSON.parse(raw);
    return Array.isArray(pages) ? pages : [];
  } catch (e) {
    return [];
  }
}

export async function documentExists(uri) {
  try {
    if (!uri) return false;
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch (e) {
    return false;
  }
}

export async function deleteDocument(uri) {
  try {
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch (e) {}
}

export async function deleteAllDocuments() {
  try {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch (e) {}
}
