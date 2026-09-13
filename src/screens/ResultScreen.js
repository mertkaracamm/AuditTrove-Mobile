import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Share, Animated, Easing,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { colors, fonts, getSeverityMap } from '../theme';
import ScoreSeal from '../components/ScoreSeal';
import { t, getLocale, setActiveLocale, getDeviceLocale } from '../i18n';
import { useFocusEffect } from '@react-navigation/native';
import { formatMetricValue, formatPages, isSymbolUnit } from '../utils/reportFormat';
import { documentExists } from '../storage/documents';
import { tick, thump } from '../feedback';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Bölümler ekrana sırayla süzülerek gelir; uzun raporda göz akışı yukarıdan aşağı kurulur.
function Reveal({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

const SEV_ORDER = ['HIGH', 'MEDIUM', 'LOW'];
const sevKey = (s) => (s === 'CRITICAL' ? 'HIGH' : s);

export default function ResultScreen({ navigation, route }) {
  const { result, fileName, docType, localUri, historyId, pagesUri } = route.params;
  // Raporun dili raporun kendisinden gelir (backend `language` alanı); eski kayıtlarda iş
  // parametresine, o da yoksa cihaz diline düşülür. Arayüz bu dile kilitlenir, çıkışta geri döner.
  const reportLang = result.language || route.params?.language || getDeviceLocale();
  setActiveLocale(reportLang);
  useFocusEffect(
    useCallback(() => {
      setActiveLocale(reportLang);
      return () => setActiveLocale(getDeviceLocale());
    }, [reportLang])
  );
  const severityMap = getSeverityMap();
  const isFinancial = !docType || docType === 'financial';
  useLayoutEffect(() => {
    navigation.setOptions({
      title: t(isFinancial ? 'nav.report' : 'nav.review'),
      headerBackTitle: t('nav.back'),
    });
  }, [navigation, reportLang, isFinancial]);

  // Belgenin cihazdaki kopyası duruyorsa "Belgede gör" açılır; eski kayıtlarda kopya yok, düğme çıkmaz.
  const [canView, setCanView] = useState(false);
  useEffect(() => {
    let alive = true;
    documentExists(localUri).then((ok) => { if (alive) setCanView(ok); });
    return () => { alive = false; };
  }, [localUri]);
  const openViewer = (page, riskIndex) => navigation.navigate('DocumentViewer', {
    uri: localUri, result, fileName, initialPage: page, focusRisk: riskIndex,
  });

  const isScanned = typeof fileName === 'string' && fileName.startsWith('tarama-');
  const risks = result.risks || [];
  const recommendations = result.recommendations || [];
  const references = result.references || [];
  const keyMetrics = result.keyMetrics || [];
  const advisorQuestions = result.advisorQuestions || [];
  const upper = (s) => (s || '').toLocaleUpperCase(getLocale() === 'tr' ? 'tr-TR' : 'en-US');

  // Çipler yalnız skora giren bulguları sayar; ek gözlemler (model kaynaklı) ayrı gri çipte gösterilir.
  const isExtra = (r) => r.source === 'model';
  const sevCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of risks) if (!isExtra(r) && sevCounts[sevKey(r.severity)] !== undefined) sevCounts[sevKey(r.severity)] += 1;
  const scoredCount = sevCounts.HIGH + sevCounts.MEDIUM + sevCounts.LOW;
  const extraCount = risks.filter(isExtra).length;

  // Önem çipleri filtre: birine dokununca yalnız o grup kalır, tekrar dokununca hepsi.
  const [filter, setFilter] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (i) => {
    tick();
    LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setExpanded((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const setFilterAnimated = (f) => {
    tick();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFilter((cur) => (cur === f ? null : f));
  };
  const passesFilter = (r) => {
    if (!filter) return true;
    if (filter === 'extra') return isExtra(r);
    return !isExtra(r) && sevKey(r.severity) === filter;
  };
  const groups = useMemo(() => SEV_ORDER
    .map((k) => ({ key: k, items: risks.map((r, i) => ({ r, i })).filter(({ r }) => sevKey(r.severity) === k && passesFilter(r)) }))
    .filter((g) => g.items.length), [risks, filter]);

  // Bölüm sekmeleri: yapışkan çubuk, dokununca ilgili bölüme kayar; kaydırınca aktif sekme değişir.
  const scrollRef = useRef(null);
  const offsets = useRef({});
  const [activeTab, setActiveTab] = useState('summary');
  const tabs = [
    { key: 'summary', label: t('res.tabSummary') },
    keyMetrics.length ? { key: 'metrics', label: t('res.tabMetrics') } : null,
    risks.length ? { key: 'findings', label: `${t('res.tabFindings')} ${risks.length}` } : null,
    recommendations.length ? { key: 'steps', label: t('res.tabSteps') } : null,
    advisorQuestions.length ? { key: 'questions', label: t('res.tabQuestions') } : null,
  ].filter(Boolean);
  const TAB_BAR_H = 52;
  const onSection = (key) => (e) => { offsets.current[key] = e.nativeEvent.layout.y; };
  const jumpTo = (key) => {
    tick();
    const y = offsets.current[key];
    if (y == null || !scrollRef.current) return;
    scrollRef.current.scrollTo({ y: Math.max(0, y - TAB_BAR_H - 6), animated: true });
  };
  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y + TAB_BAR_H + 24;
    let cur = tabs[0] && tabs[0].key;
    for (const tab of tabs) if (offsets.current[tab.key] != null && offsets.current[tab.key] <= y) cur = tab.key;
    if (cur !== activeTab) setActiveTab(cur);
  };

  function shareReport() {
    const lines = [
      `AuditTrove · ${fileName}`,
      `${t('res.shareScore')}: ${result.riskScore}/100`,
      '',
      result.summary,
      '',
      `${t('res.shareFindings')}:`,
      ...risks.map((r, i) => `${i + 1}. ${r.title}`),
      '',
      t('res.shareFooter'),
    ];
    Share.share({ message: lines.join('\n') }).catch(() => {});
  }

  const firstMarkedPage = () => {
    const pages = risks.flatMap((r) => r.pages || []).filter((p) => p > 0);
    return pages.length ? Math.min(...pages) : 1;
  };
  // Belgenin üstünde işaretlenebilen (sayfası bilinen) bulgu sayısı.
  const markedCount = risks.filter((r) => (r.pages || []).length).length;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      stickyHeaderIndices={[1]}
      onScroll={onScroll}
      scrollEventThrottle={48}
    >
      {/* 0: Kapak — skor, gerekçe, ana eylemler */}
      <Reveal>
        <View style={styles.hero}>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          <View style={styles.sealWrap}>
            <ScoreSeal score={result.riskScore} />
          </View>
          {result.scoreRationale ? <Text style={styles.rationale}>{result.scoreRationale}</Text> : null}

          {risks.length > 0 && (
            <View style={styles.chipRow}>
              {scoredCount > 0 && SEV_ORDER.map((key) => {
                const sev = severityMap[key];
                const on = filter === key;
                return (
                  <Pressable key={key} onPress={() => { setFilterAnimated(key); jumpTo('findings'); }}
                    style={[styles.sevChip, { backgroundColor: sev.bg, borderColor: on ? sev.color : 'transparent' }]}>
                    <Text style={[styles.sevChipText, { color: sev.color }]}>{sevCounts[key]} {upper(sev.label)}</Text>
                  </Pressable>
                );
              })}
              {extraCount > 0 && (
                <Pressable onPress={() => { setFilterAnimated('extra'); jumpTo('findings'); }}
                  style={[styles.sevChip, { backgroundColor: colors.card, borderColor: filter === 'extra' ? colors.textSoft : colors.line }]}>
                  <Text style={[styles.sevChipText, { color: colors.textSoft }]}>{extraCount} {upper(t('res.extraChip'))}</Text>
                </Pressable>
              )}
            </View>
          )}

          {canView ? (
            <Pressable onPress={() => openViewer(firstMarkedPage(), undefined)}
              style={({ pressed }) => [styles.viewDocRow, pressed && { opacity: 0.85 }]}>
              <View style={styles.viewDocIcon}>
                <View style={styles.viewDocIconPage} />
                <View style={[styles.viewDocIconMark, { backgroundColor: colors.riskHigh }]} />
                <View style={[styles.viewDocIconMark, { top: 12, width: 8, backgroundColor: colors.riskMid }]} />
              </View>
              <View style={{ flex: 1 }}>
                {/* Bulgu yoksa "0 bulgu işaretli" demek yerine sadece belgeyi açmayı teklif ediyoruz. */}
                {markedCount > 0 ? (
                  <>
                    <Text style={styles.viewDocTitle}>{t('viewer.open')}</Text>
                    <Text style={styles.viewDocSub}>{t('res.viewDocSub', { n: markedCount })}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.viewDocTitle}>{t('viewer.openPlain')}</Text>
                    <Text style={styles.viewDocSub}>{t('res.viewDocNone')}</Text>
                  </>
                )}
              </View>
              <Text style={styles.viewDocChevron}>›</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={() => { thump(); navigation.navigate('Chat', { result, fileName, localUri, historyId, pagesUri, language: reportLang }); }}
            style={({ pressed }) => [styles.viewDocRow, styles.askRow, pressed && { opacity: 0.85 }]}>
            <View style={[styles.viewDocIcon, styles.askIcon]}>
              <Text style={styles.askIconText}>?</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.viewDocTitle}>{t('res.askTitle')}</Text>
              <Text style={styles.viewDocSub}>{t('res.askSub')}</Text>
            </View>
            <Text style={styles.viewDocChevron}>›</Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable onPress={shareReport} hitSlop={8}><Text style={styles.linkText}>{t('res.share')}</Text></Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable onPress={() => navigation.popToTop()} hitSlop={8}><Text style={styles.linkText}>{t('res.newReview')}</Text></Pressable>
          </View>
        </View>
      </Reveal>

      {/* 1: Yapışkan bölüm sekmeleri */}
      <View style={styles.tabBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable key={tab.key} onPress={() => jumpTo(tab.key)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2: Özet */}
      <View onLayout={onSection('summary')}>
        <Reveal delay={80}>
          <Text style={styles.sectionEyebrow}><Text style={styles.eyebrowStar}>◆ </Text>{t('res.summary')}</Text>
          <View style={styles.card}>
            <Text style={styles.summary}>{result.summary}</Text>
          </View>
        </Reveal>
      </View>

      {/* 3: Göstergeler */}
      {keyMetrics.length > 0 && (
        <View onLayout={onSection('metrics')}>
          <Reveal delay={140}>
            <Text style={styles.sectionEyebrow}><Text style={styles.eyebrowStar}>◆ </Text>{t('res.metrics')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
              {keyMetrics.map((m, i) => (
                <View key={i} style={styles.metricCard}>
                  <Text style={styles.metricLabel} numberOfLines={2}>{upper(m.label)}</Text>
                  <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {formatMetricValue(m.value, reportLang)}{isSymbolUnit(m.unit) ? m.unit : ''}
                  </Text>
                  {m.unit && !isSymbolUnit(m.unit) ? <Text style={styles.metricUnit} numberOfLines={1}>{m.unit}</Text> : null}
                  {m.note ? <Text style={styles.metricNote} numberOfLines={2}>{m.note}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </Reveal>
        </View>
      )}

      {/* 4: Bulgular */}
      {risks.length > 0 && (
        <View onLayout={onSection('findings')}>
          <Reveal delay={200}>
            <Text style={styles.sectionEyebrow}>
              <Text style={styles.eyebrowStar}>◆ </Text>{t(isFinancial ? 'res.findings' : 'res.attention')} ({risks.length})
            </Text>
            {filter ? (
              <Pressable onPress={() => setFilterAnimated(null)} style={styles.filterNote}>
                <Text style={styles.filterNoteText}>{upper(filter === 'extra' ? t('res.extraChip') : severityMap[filter].label)} · {t('res.showAll')} ✕</Text>
              </Pressable>
            ) : null}

            {groups.map((g) => {
              const sev = severityMap[g.key];
              return (
                <View key={g.key} style={styles.group}>
                  <View style={styles.groupHead}>
                    <View style={[styles.groupDot, { backgroundColor: sev.color }]} />
                    <Text style={[styles.groupTitle, { color: sev.color }]}>{upper(sev.label)}</Text>
                    <Text style={styles.groupCount}>{g.items.length}</Text>
                  </View>
                  {g.items.map(({ r: risk, i }) => {
                    const open = expanded.has(i);
                    const pages = risk.pages || [];
                    return (
                      <Pressable key={i} onPress={() => toggle(i)}
                        style={({ pressed }) => [styles.card, styles.findingCard, { borderLeftColor: sev.color }, pressed && { opacity: 0.92 }]}>
                        <View style={styles.riskHeader}>
                          <Text style={styles.riskIndex}>{String(i + 1).padStart(2, '0')}</Text>
                          <View style={styles.riskHeaderRight}>
                            {pages.length ? <Text style={styles.pagePill}>{formatPages(pages, reportLang, t)}</Text> : null}
                            <Text style={[styles.chevron, open && styles.chevronOpen]}>›</Text>
                          </View>
                        </View>
                        <Text style={styles.riskTitle}>{risk.title}</Text>
                        {risk.source === 'model' ? <Text style={styles.extraTag}>{t('res.extraNote')}</Text> : null}
                        {open && (
                          <View style={styles.riskBody}>
                            {risk.evidence ? (
                              <View style={styles.evidence}>
                                <Text style={styles.evidenceText}>{risk.evidence}</Text>
                              </View>
                            ) : null}
                            {risk.explanation ? <Text style={styles.riskExplanation}>{risk.explanation}</Text> : null}
                            {canView && pages.length ? (
                              <Pressable onPress={() => openViewer(pages[0], i)} style={({ pressed }) => [styles.viewInDoc, pressed && { opacity: 0.8 }]}>
                                <Text style={styles.viewInDocText}>{t('viewer.showHere')} · {formatPages(pages, reportLang, t)} ›</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </Reveal>
        </View>
      )}

      {/* 5: Adımlar */}
      {recommendations.length > 0 && (
        <View onLayout={onSection('steps')}>
          <Reveal delay={260}>
            <Text style={styles.sectionEyebrow}><Text style={styles.eyebrowStar}>◆ </Text>{t('res.steps')}</Text>
            <View style={styles.card}>
              {recommendations.map((rec, i) => (
                <View key={i} style={[styles.recRow, i > 0 && styles.rowDivider]}>
                  <Text style={styles.recIndex}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={styles.recText}>{rec}</Text>
                </View>
              ))}
            </View>
          </Reveal>
        </View>
      )}

      {/* 6: Sorular */}
      {advisorQuestions.length > 0 && (
        <View onLayout={onSection('questions')}>
          <Reveal delay={320}>
            <Text style={styles.sectionEyebrow}>
              <Text style={styles.eyebrowStar}>◆ </Text>{t(isFinancial ? 'res.questions' : 'res.askBeforeSign')}
            </Text>
            <View style={styles.card}>
              {advisorQuestions.map((q, i) => (
                <View key={i} style={[styles.recRow, i > 0 && styles.rowDivider]}>
                  <Text style={styles.questionMark}>?</Text>
                  <Text style={styles.recText}>{q}</Text>
                </View>
              ))}
            </View>
          </Reveal>
        </View>
      )}

      {references.length > 0 && (
        <Reveal delay={360}>
          <Text style={styles.sectionEyebrow}><Text style={styles.eyebrowStar}>◆ </Text>{t('res.refs')}</Text>
          <View style={styles.card}>
            {references.map((ref, i) => {
              const source = typeof ref === 'string' ? ref : ref.source;
              const note = typeof ref === 'string' ? null : ref.note;
              return (
                <View key={i} style={[styles.refRow, i > 0 && styles.rowDivider]}>
                  <Text style={styles.refSource}>{source}</Text>
                  {note ? <Text style={styles.refNote}>{note}</Text> : null}
                </View>
              );
            })}
          </View>
        </Reveal>
      )}

      {isScanned && <Text style={styles.scanNote}>{t('res.scanNote')}</Text>}
      <Text style={styles.disclaimer}>{t('res.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  hero: { paddingHorizontal: 20, paddingTop: 8 },
  fileName: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSoft, textAlign: 'center', marginTop: 4 },
  sealWrap: { alignItems: 'center', marginVertical: 18 },
  rationale: { fontSize: 13, lineHeight: 19, color: colors.textSoft, textAlign: 'center', fontStyle: 'italic', marginBottom: 16, paddingHorizontal: 12 },

  viewDocRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cyan + '99', marginTop: 4,
  },
  viewDocIcon: { width: 30, height: 36, borderRadius: 5, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center' },
  viewDocIconPage: { width: 18, height: 24, borderRadius: 2, backgroundColor: '#F1F6FF' },
  viewDocIconMark: { position: 'absolute', left: 8, top: 8, width: 12, height: 3, borderRadius: 2, opacity: 0.95 },
  viewDocTitle: { color: colors.cyan, fontSize: 14.5, fontWeight: '700' },
  viewDocSub: { color: colors.textSoft, fontSize: 11.5, marginTop: 1 },
  viewDocChevron: { color: colors.cyan, fontSize: 24, fontWeight: '300', marginTop: -2 },
  askRow: { marginTop: 8, borderColor: colors.line },
  askIcon: { height: 30, borderRadius: 15 },
  askIconText: { color: colors.cyan, fontFamily: fonts.mono, fontSize: 17, fontWeight: '800' },
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12, marginBottom: 2 },
  linkText: { color: colors.cyan, fontSize: 13.5, fontWeight: '600' },
  linkDot: { color: colors.textSoft },
  filterNote: { alignSelf: 'flex-start', marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  filterNoteText: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 11, fontWeight: '700' },

  tabBarWrap: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, marginTop: 8, marginBottom: 14 },
  tabBar: { paddingHorizontal: 16, paddingVertical: 9, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  tabText: { color: colors.textSoft, fontSize: 12.5, fontWeight: '700' },
  tabTextActive: { color: colors.bgDeep },

  sectionEyebrow: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.2, color: colors.textSoft, marginBottom: 8, marginTop: 8, paddingHorizontal: 20 },
  eyebrowStar: { color: colors.gold },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, marginBottom: 12, marginHorizontal: 20 },
  summary: { fontSize: 14.5, lineHeight: 22, color: colors.text },

  metricsRow: { gap: 10, paddingHorizontal: 20, paddingBottom: 4, marginBottom: 14 },
  metricCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, minWidth: 130, maxWidth: 180 },
  metricLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.textSoft, marginBottom: 4, lineHeight: 14, minHeight: 28 },
  metricValue: { fontFamily: fonts.mono, fontSize: 16, fontWeight: '700', color: colors.text },
  metricUnit: { fontSize: 11, color: colors.textSoft, marginTop: 2 },
  metricNote: { fontSize: 11, color: colors.textSoft, marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 14 },
  sevChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'transparent' },
  sevChipText: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  group: { marginBottom: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, marginBottom: 8, marginTop: 4 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1 },
  groupCount: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 11.5 },
  findingCard: { borderLeftWidth: 3, paddingVertical: 14 },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  riskHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riskIndex: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSoft },
  pagePill: { fontFamily: fonts.mono, fontSize: 11, color: colors.gold, backgroundColor: 'rgba(245,197,66,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  chevron: { color: colors.textSoft, fontSize: 22, lineHeight: 22, transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  riskTitle: { fontFamily: fonts.display, fontSize: 16.5, color: colors.text, lineHeight: 22 },
  extraTag: { fontSize: 11, color: colors.textSoft, marginTop: 4, letterSpacing: 0.4 },
  riskBody: { marginTop: 10 },
  evidence: { borderLeftWidth: 3, borderLeftColor: colors.line, paddingLeft: 12, marginBottom: 8 },
  evidenceText: { fontSize: 13, lineHeight: 19, color: colors.textSoft, fontStyle: 'italic' },
  riskExplanation: { fontSize: 13.5, lineHeight: 20, color: colors.text },
  viewInDoc: { alignSelf: 'flex-start', marginTop: 4, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.cyan },
  viewInDocText: { color: colors.cyan, fontSize: 12.5, fontWeight: '700' },

  recRow: { flexDirection: 'row', paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  recIndex: { fontFamily: fonts.mono, fontSize: 13, color: colors.cyan, marginRight: 12, marginTop: 1 },
  recText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  questionMark: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '700', color: colors.gold, width: 22 },
  refRow: { paddingVertical: 10 },
  refSource: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  refNote: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  scanNote: { fontSize: 11.5, color: colors.riskMid, textAlign: 'center', fontStyle: 'italic', marginTop: 14, paddingHorizontal: 28, lineHeight: 16 },
  disclaimer: { fontSize: 11.5, lineHeight: 16, color: colors.textSoft, textAlign: 'center', paddingHorizontal: 28, marginTop: 14 },
});
