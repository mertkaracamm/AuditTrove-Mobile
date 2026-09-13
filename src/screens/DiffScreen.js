// İki belge sürümünü karşılaştır. Eski ve yeni PDF cihazdan ya da geçmişten seçilir; farklar sunucuda kodla
// bulunur, burada kart kart listelenir. Her kart iki belgede de yerini bilir; dokununca görüntüleyici o satırı boyar.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, ActivityIndicator, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { colors, gradients, fonts } from '../theme';
import { t, getLocale } from '../i18n';
import { compareDocuments } from '../api/client';
import { checkIsPro } from '../api/purchases';
import { getHistory, getDiffCountThisMonth, incrementDiffCount } from '../storage/history';
import { documentExists } from '../storage/documents';
import { tick, thump, thumpThen } from '../feedback';

export const FREE_DIFFS_PER_MONTH = 2;
const LOW_MATCH = 0.3;

const IMPACTS = ['UNFAVORABLE', 'FAVORABLE', 'NEUTRAL'];

function impactStyle(impact) {
  if (impact === 'UNFAVORABLE') return { color: colors.riskHigh, bg: colors.riskHighBg, label: t('diff.unfavorable'), severity: 'HIGH' };
  if (impact === 'FAVORABLE') return { color: colors.riskLow, bg: colors.riskLowBg, label: t('diff.favorable'), severity: 'LOW' };
  return { color: colors.riskMid, bg: colors.riskMidBg, label: t('diff.neutral'), severity: 'MEDIUM' };
}

function kindLabel(kind) {
  return t(`diff.kind.${kind}`);
}

// Ham tablo satırı ("Dönem kârı 88,1 1 520,9") okunur bir kanıt değil: sayısı çok, kelimesi az olan satır
// görüntüleyicide kanıt olarak gösterilmez, kartın kendi cümlesi yeter.
const NUMBER = /\d(?:[\d.,]|[  ](?=\d{3}(?!\d)))*\d|\d/g;
const WORD = /\p{L}{3,}/gu;

function looksLikeRawRow(text) {
  if (!text) return false;
  // Eksi tutarlar parantezle, yüzdeler işaretle biter; bunlar da rakamla biter sayılır.
  let trimmed = text.trim();
  while (trimmed && ')]%”"\''.indexOf(trimmed[trimmed.length - 1]) >= 0) trimmed = trimmed.slice(0, -1);
  if (!trimmed || !/\d/.test(trimmed[trimmed.length - 1])) return false;
  const numbers = (trimmed.match(NUMBER) || []).length;
  const words = (trimmed.match(WORD) || []).length;
  return numbers >= 2 && words < 3 * numbers;
}

export default function DiffScreen({ navigation }) {
  const [oldDoc, setOldDoc] = useState(null); // {uri, name}
  const [newDoc, setNewDoc] = useState(null);
  const [picking, setPicking] = useState(null); // 'old' | 'new' | null → geçmiş listesi açık
  const [historyDocs, setHistoryDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [used, setUsed] = useState(0);

  useEffect(() => {
    let alive = true;
    checkIsPro().then((ok) => { if (alive) setIsPro(Boolean(ok)); }).catch(() => {});
    getDiffCountThisMonth().then((n) => { if (alive) setUsed(n); });
    // Geçmişten yalnızca kopyası hâlâ cihazda duran belgeler seçilebilir.
    getHistory().then(async (items) => {
      const withCopy = [];
      for (const it of items) if (it.localUri && (await documentExists(it.localUri))) withCopy.push(it);
      if (alive) setHistoryDocs(withCopy);
    });
    return () => { alive = false; };
  }, []);

  const remaining = isPro ? Infinity : Math.max(0, FREE_DIFFS_PER_MONTH - used);
  const quotaOut = !isPro && remaining <= 0;

  const pickFromDevice = async (slot) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (res.canceled) return;
      const f = res.assets[0];
      // Seçicinin önbellek kopyası bu oturum için yeter; karşılaştırma geçmişe yazılmaz, kalıcı kopya alınmaz.
      const doc = { uri: f.uri, name: f.name };
      (slot === 'old' ? setOldDoc : setNewDoc)(doc);
      setResult(null);
    } catch (e) {
      setError(t('diff.pickFailed'));
    }
  };

  const pickFromHistory = (item) => {
    tick();
    const doc = { uri: item.localUri, name: item.fileName };
    (picking === 'old' ? setOldDoc : setNewDoc)(doc);
    setPicking(null);
    setResult(null);
  };

  const swap = () => { tick(); setOldDoc(newDoc); setNewDoc(oldDoc); setResult(null); };

  const compare = async () => {
    if (!oldDoc || !newDoc || busy) return;
    if (quotaOut) { thump(); navigation.navigate('Paywall'); return; }
    thump();
    setError('');
    setBusy(true);
    try {
      const res = await compareDocuments(oldDoc.uri, newDoc.uri, getLocale());
      const n = await incrementDiffCount();
      setUsed(n);
      setResult(res);
      setFilter(null);
      tick();
    } catch (e) {
      setError((e && e.message) || t('diff.failed'));
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = { UNFAVORABLE: 0, FAVORABLE: 0, NEUTRAL: 0 };
    for (const ch of (result ? result.changes : [])) c[ch.impact] = (c[ch.impact] || 0) + 1;
    return c;
  }, [result]);

  const visible = useMemo(() => (result ? result.changes.filter((c) => !filter || c.impact === filter) : []), [result, filter]);

  // Görüntüleyici bulgu listesi bekler: farklar o şekle çevrilir, yalnız o tarafta yeri olanlar girer.
  const openSide = (side, change) => {
    tick();
    const doc = side === 'A' ? oldDoc : newDoc;
    const list = result.changes.filter((c) => (side === 'A' ? c.pagesA : c.pagesB).length);
    const risks = list.map((c) => {
      const st = impactStyle(c.impact);
      const text = side === 'A' ? c.oldText : c.newText;
      return {
        title: c.title, severity: st.severity, badge: st.label, finding: c.explanation,
        evidence: looksLikeRawRow(text) ? c.explanation : text,
        pages: side === 'A' ? c.pagesA : c.pagesB, anchors: side === 'A' ? c.anchorsA : c.anchorsB, source: 'rubric',
      };
    });
    const idx = list.indexOf(change);
    const pageCount = side === 'A' ? result.pageCountA : result.pageCountB;
    navigation.navigate('DocumentViewer', {
      uri: doc.uri, fileName: doc.name, initialPage: (side === 'A' ? change.pagesA : change.pagesB)[0],
      focusRisk: idx >= 0 ? idx : undefined, result: { risks, pageCount, language: result.language },
    });
  };

  const Slot = ({ slot, doc, label }) => (
    <View style={styles.slot}>
      <Text style={styles.slotLabel}>{label}</Text>
      <Text style={[styles.slotName, !doc && { color: colors.textSoft, fontStyle: 'italic' }]} numberOfLines={1}>{doc ? doc.name : t('diff.notChosen')}</Text>
      <View style={styles.slotBtns}>
        <Pressable onPress={() => thumpThen(() => pickFromDevice(slot))} style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.8 }]}>
          <Text style={styles.slotBtnText}>{t('diff.pickPdf')}</Text>
        </Pressable>
        {historyDocs.length > 0 && (
          <Pressable onPress={() => { tick(); setPicking(slot); }} style={({ pressed }) => [styles.slotBtn, pressed && { opacity: 0.8 }]}>
            <Text style={styles.slotBtnText}>{t('diff.fromHistory')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>{t('diff.intro')}</Text>

      <Slot slot="old" doc={oldDoc} label={t('diff.oldVersion')} />
      <Pressable onPress={swap} hitSlop={8} style={styles.swap}><Text style={styles.swapText}>⇅ {t('diff.swap')}</Text></Pressable>
      <Slot slot="new" doc={newDoc} label={t('diff.newVersion')} />

      <Text style={styles.quota}>{isPro ? t('diff.quotaPro') : t('diff.quota', { n: remaining })}</Text>
      <Pressable onPress={compare} disabled={!oldDoc || !newDoc || busy}>
        {({ pressed }) => (
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.compareBtn, (!oldDoc || !newDoc || busy) && { opacity: 0.45 }, pressed && { opacity: 0.85 }]}>
            {busy ? <ActivityIndicator color={colors.bgDeep} /> : <Text style={styles.compareText}>{quotaOut ? t('diff.upgrade') : t('diff.compare')}</Text>}
          </LinearGradient>
        )}
      </Pressable>
      {busy ? <Text style={styles.busyNote}>{t('diff.working')}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result && (
        <View style={styles.results}>
          <Text style={styles.summary}>{result.summary}</Text>
          {result.matchedRatio < LOW_MATCH && result.changes.length > 0 ? (
            <View style={styles.warn}><Text style={styles.warnText}>{t('diff.lowMatch')}</Text></View>
          ) : null}
          {result.changes.length > 0 && (
            <View style={styles.chipRow}>
              {IMPACTS.map((imp) => {
                const st = impactStyle(imp);
                const on = filter === imp;
                return (
                  <Pressable key={imp} onPress={() => { tick(); setFilter(on ? null : imp); }}
                    style={[styles.chip, { backgroundColor: st.bg, borderColor: on ? st.color : 'transparent' }]}>
                    <Text style={[styles.chipText, { color: st.color }]}>{counts[imp] || 0} {st.label.toLocaleUpperCase(getLocale() === 'tr' ? 'tr-TR' : 'en-US')}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {visible.map((c, i) => {
            const st = impactStyle(c.impact);
            return (
              <View key={i} style={[styles.card, { borderLeftColor: st.color }]}>
                <View style={styles.cardHead}>
                  <Text style={styles.kind}>{kindLabel(c.kind)}</Text>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.color }]}>{st.label}</Text></View>
                </View>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardText}>{c.explanation}</Text>
                {c.kind === 'NUMBER' && (c.oldNumbers.length || c.newNumbers.length) ? (
                  <Text style={styles.numbers}>{c.oldNumbers.join(', ') || '—'}  →  {c.newNumbers.join(', ') || '—'}</Text>
                ) : null}
                <View style={styles.cardLinks}>
                  {c.pagesA.length ? (
                    <Pressable onPress={() => openSide('A', c)} hitSlop={6}><Text style={styles.link}>{t('diff.seeOld', { n: c.pagesA[0] })} ›</Text></Pressable>
                  ) : null}
                  {c.pagesB.length ? (
                    <Pressable onPress={() => openSide('B', c)} hitSlop={6}><Text style={styles.link}>{t('diff.seeNew', { n: c.pagesB[0] })} ›</Text></Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
          <Text style={styles.disclaimer}>{t('diff.disclaimer')}</Text>
        </View>
      )}

      <Modal visible={picking !== null} animationType="slide" transparent onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.modalBg} onPress={() => setPicking(null)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{t('diff.fromHistoryTitle')}</Text>
            <FlatList
              data={historyDocs}
              keyExtractor={(it) => it.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable onPress={() => pickFromHistory(item)} style={({ pressed }) => [styles.histRow, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.histName} numberOfLines={1}>{item.fileName}</Text>
                  <Text style={styles.histDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setPicking(null)} style={styles.modalClose}><Text style={styles.modalCloseText}>{t('diff.cancel')}</Text></Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 40 },
  intro: { color: colors.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  slot: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14 },
  slotLabel: { color: colors.gold, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  slotName: { color: colors.text, fontSize: 14.5, fontWeight: '600', marginBottom: 10 },
  slotBtns: { flexDirection: 'row', gap: 8 },
  slotBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.cyan + '99', paddingVertical: 9, alignItems: 'center', backgroundColor: colors.cardSoft },
  slotBtnText: { color: colors.cyan, fontSize: 13, fontWeight: '700' },
  swap: { alignSelf: 'center', paddingVertical: 8 },
  swapText: { color: colors.textSoft, fontSize: 12.5 },
  quota: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 10.5, textAlign: 'center', marginTop: 16, marginBottom: 8 },
  compareBtn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  compareText: { color: colors.bgDeep, fontSize: 15.5, fontWeight: '800' },
  busyNote: { color: colors.textSoft, fontSize: 12.5, textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  error: { color: colors.riskHigh, fontSize: 13, textAlign: 'center', marginTop: 10 },
  results: { marginTop: 22 },
  summary: { color: colors.text, fontSize: 14.5, lineHeight: 21, fontFamily: fonts.display, textAlign: 'center', marginBottom: 12 },
  warn: { backgroundColor: colors.riskMidBg, borderRadius: 12, padding: 10, marginBottom: 12 },
  warnText: { color: colors.riskMid, fontSize: 12.5, lineHeight: 18, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 14 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  chipText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  card: { backgroundColor: colors.card, borderRadius: 14, borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  kind: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 0.8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.mono, fontSize: 10.5, fontWeight: '700' },
  cardTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.display, marginBottom: 4 },
  cardText: { color: colors.text, fontSize: 14, lineHeight: 20, opacity: 0.9 },
  numbers: { color: colors.gold, fontFamily: fonts.mono, fontSize: 13, marginTop: 8 },
  cardLinks: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: colors.cyan, fontSize: 13, fontWeight: '700' },
  disclaimer: { color: colors.textSoft, fontSize: 10.5, lineHeight: 14, marginTop: 8, opacity: 0.85 },
  modalBg: { flex: 1, backgroundColor: 'rgba(2,8,32,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 30 },
  modalTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.display, marginBottom: 10 },
  histRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  histName: { color: colors.text, fontSize: 14.5, fontWeight: '600' },
  histDate: { color: colors.textSoft, fontSize: 11.5, marginTop: 2 },
  modalClose: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  modalCloseText: { color: colors.cyan, fontSize: 14, fontWeight: '700' },
});