// Kamerayla belge tarama: tarayici -> sayfa goruntuleri -> cihazda OCR -> metinli PDF.
// Native moduller mevcut degilse (eski build) SCAN_ENABLED=false olur ve buton gizlenir;
// uygulama calismaya devam eder. Yeni EAS build sonrasi otomatik aktiflesir.
let DocumentScanner = null;
let TextRecognition = null;
let Print = null;

try {
  DocumentScanner = require('react-native-document-scanner-plugin').default;
} catch (e) {}
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch (e) {}
try {
  Print = require('expo-print');
} catch (e) {}

export const SCAN_ENABLED = Boolean(DocumentScanner && TextRecognition && Print);

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Kamerayi acar, taranan sayfalari OCR'dan gecirir ve metin katmanli bir PDF uretir.
 * @returns {Promise<{uri:string,name:string,mimeType:string}|null>} kullanici iptal ederse null
 * @throws {{code:'SCAN_NO_TEXT'}} hicbir sayfada okunur metin bulunamazsa
 */
export async function scanToPdf() {
  const result = await DocumentScanner.scanDocument({ croppedImageQuality: 90 });
  const images = result && result.scannedImages;
  if (!images || images.length === 0) {
    return null; // iptal
  }

  const pageTexts = [];
  for (const imageUri of images) {
    const uri = imageUri.startsWith('file://') ? imageUri : 'file://' + imageUri;
    try {
      const recognized = await TextRecognition.recognize(uri);
      pageTexts.push((recognized && recognized.text) || '');
    } catch (e) {
      pageTexts.push('');
    }
  }

  const totalChars = pageTexts.join('').replace(/\s/g, '').length;
  if (totalChars < 40) {
    const err = new Error('scan_no_text');
    err.code = 'SCAN_NO_TEXT';
    throw err;
  }

  // Her taranan sayfa PDF'te ayri sayfa olur; boylece backend'in
  // [REPORT PAGE n] isaretcileri fiziksel sayfalarla eslesir.
  const pagesHtml = pageTexts
    .map(
      (text) =>
        '<div style="page-break-after: always;">' +
        '<pre style="white-space: pre-wrap; word-wrap: break-word; ' +
        'font-family: -apple-system, Roboto, sans-serif; font-size: 12px; margin: 24px;">' +
        escapeHtml(text) +
        '</pre></div>'
    )
    .join('');
  const html = '<html><head><meta charset="utf-8"></head><body>' + pagesHtml + '</body></html>';

  const { uri } = await Print.printToFileAsync({ html });
  const stamp = new Date();
  const name =
    'tarama-' +
    stamp.getFullYear() +
    String(stamp.getMonth() + 1).padStart(2, '0') +
    String(stamp.getDate()).padStart(2, '0') +
    '-' +
    String(stamp.getHours()).padStart(2, '0') +
    String(stamp.getMinutes()).padStart(2, '0') +
    '.pdf';
  return { uri, name, mimeType: 'application/pdf' };
}
