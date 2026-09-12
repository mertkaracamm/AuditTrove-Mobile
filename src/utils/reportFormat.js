// Rapor ekranı için biçimlendirme yardımcıları. Backend sayıyı belgede yazıldığı gibi gönderir;
// kullanıcı hangi dilde rapor aldıysa sayı o dilin biçimiyle gösterilir.

const LOCALE = { tr: 'tr-TR', en: 'en-US' };

export function localeOf(lang) {
  return LOCALE[lang] || LOCALE.en;
}

// "28.984.491", "28,984,491", "12,345.6", "74,7", "(2.609,7)", "-8.799.018" biçimlerini sayıya çevirir.
// İki ayraç türü varsa sağdaki ondalıktır; tek tür ayraç birden fazla geçiyorsa ya da tam üç hane
// izliyorsa binliktir, aksi halde ondalıktır. Sayı değilse null döner (tarih, oran, metin).
export function parsePrintedNumber(raw) {
  if (raw == null) return null;
  let t = String(raw).trim();
  if (!/^[-(−]?\s*\d[\d.,\s]*\d\s*\)?$|^[-(−]?\d\)?$/.test(t)) return null;
  const negative = /^\(.*\)$/.test(t) || /^[-−]/.test(t);
  t = t.replace(/[()\-−\s]/g, '');
  const hasDot = t.includes('.');
  const hasComma = t.includes(',');
  let v;
  if (hasDot && hasComma) {
    const dotDecimal = t.lastIndexOf('.') > t.lastIndexOf(',');
    v = Number(dotDecimal ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.'));
  } else if (hasDot || hasComma) {
    const sep = hasDot ? '.' : ',';
    const first = t.indexOf(sep);
    const last = t.lastIndexOf(sep);
    const groups = t.split(sep);
    // Tek tür ayraç: binlikse ilk grup hariç her grup tam üç hane olmalı; "31.12.2024" gibi tarih sayı değildir.
    const allTriples = groups.slice(1).every((g) => g.length === 3);
    if (first !== last && !allTriples) return null;
    const thousands = first !== last || t.length - last - 1 === 3;
    v = Number(thousands ? groups.join('') : t.replace(sep, '.'));
  } else {
    // Ayraçsız kısa sayı (yıl, dipnot no, adet) biçimlendirilmez; "2024" → "2.024" olmasın.
    if (t.length <= 4) return null;
    v = Number(t);
  }
  if (!Number.isFinite(v)) return null;
  return negative ? -v : v;
}

// Sayıysa rapor diline göre biçimlendirir, değilse (tarih, "%80", "12 ay") olduğu gibi bırakır.
export function formatMetricValue(raw, lang) {
  const n = parsePrintedNumber(raw);
  if (n === null) return raw == null ? '' : String(raw);
  const bare = String(raw).replace(/[()\s]/g, '');
  const digits = Number.isInteger(n) ? 0 : Math.min(2, (bare.match(/[.,](\d{1,2})$/) || ['', ''])[1].length);
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return String(raw);
  }
}

// Sayfa listesini rapor dilinde tek etikete çevirir: "Sayfa 13", "Sayfa 5, 11" / "Page 13", "Pages 5, 11".
export function formatPages(pages, lang, t) {
  if (!Array.isArray(pages) || pages.length === 0) return '';
  const label = t(pages.length > 1 ? 'res.pages' : 'res.page');
  return `${label} ${pages.join(', ')}`;
}

// "%", "‰", "x" gibi tek karakterlik birimler değerin yanına yapışık yazılır ("80%"); kelime birimler ayrı satıra.
export function isSymbolUnit(unit) {
  return typeof unit === 'string' && /^[%‰x×]$/.test(unit.trim());
}