import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, fonts, severityMap } from '../theme';
import ScoreSeal from '../components/ScoreSeal';
import { t, getLocale } from '../i18n';

export default function ResultScreen({ navigation, route }) {
  const { result, fileName, docType } = route.params;
  const isFinancial = !docType || docType === 'financial';
  const isScanned = typeof fileName === 'string' && fileName.startsWith('tarama-');
  const risks = result.risks || [];
  const recommendations = result.recommendations || [];
  const references = result.references || [];
  const keyMetrics = result.keyMetrics || [];
  const advisorQuestions = result.advisorQuestions || [];

  const sevCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of risks) {
    const key = r.severity === 'CRITICAL' ? 'HIGH' : r.severity;
    if (sevCounts[key] !== undefined) sevCounts[key] += 1;
  }
  const chipOrder = ['HIGH', 'MEDIUM', 'LOW'];

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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.fileName} numberOfLines={1}>
        {fileName}
      </Text>

      <View style={styles.sealWrap}>
        <ScoreSeal score={result.riskScore} />
      </View>

      {result.scoreRationale ? (
        <Text style={styles.rationale}>{result.scoreRationale}</Text>
      ) : null}

      {risks.length > 0 && (
        <View style={styles.chipRow}>
          {chipOrder.map((key) => {
            const sev = severityMap[key];
            return (
              <View
                key={key}
                style={[styles.sevChip, { backgroundColor: sev.bg }]}
              >
                <Text style={[styles.sevChipText, { color: sev.color }]}>
                  {sevCounts[key]}{' '}
                  {sev.label.toLocaleUpperCase(getLocale() === 'tr' ? 'tr-TR' : 'en-US')}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {keyMetrics.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>
            <Text style={styles.eyebrowStar}>◆ </Text>{t('res.metrics')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsRow}
          >
            {keyMetrics.map((m, i) => (
              <View key={i} style={styles.metricCard}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  {(m.label || '').toLocaleUpperCase(
                    getLocale() === 'tr' ? 'tr-TR' : 'en-US'
                  )}
                </Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {m.value}
                </Text>
                {m.note ? (
                  <Text style={styles.metricNote} numberOfLines={2}>
                    {m.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>{t('res.summary')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.summary}>{result.summary}</Text>
      </View>

      {risks.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>
            <Text style={styles.eyebrowStar}>◆ </Text>{t(isFinancial ? 'res.findings' : 'res.attention')} ({risks.length})
          </Text>
          {risks.map((risk, i) => {
            const sev = severityMap[risk.severity] || severityMap.MEDIUM;
            return (
              <View
                key={i}
                style={[styles.card, { borderLeftWidth: 3, borderLeftColor: sev.color }]}
              >
                <View style={styles.riskHeader}>
                  <Text style={styles.riskIndex}>
                    {String(i + 1).padStart(2, '0')}
                  </Text>
                  <View
                    style={[styles.severityBadge, { backgroundColor: sev.bg }]}
                  >
                    <Text style={[styles.severityText, { color: sev.color }]}>
                      {sev.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.riskTitle}>{risk.title}</Text>
                {risk.evidence ? (
                  <View style={styles.evidence}>
                    <Text style={styles.evidenceText}>{risk.evidence}</Text>
                  </View>
                ) : null}
                {risk.explanation ? (
                  <Text style={styles.riskExplanation}>{risk.explanation}</Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      {recommendations.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>
            <Text style={styles.eyebrowStar}>◆ </Text>{t('res.steps')}
          </Text>
          <View style={styles.card}>
            {recommendations.map((rec, i) => (
              <View key={i} style={[styles.recRow, i > 0 && styles.rowDivider]}>
                <Text style={styles.recIndex}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {advisorQuestions.length > 0 && (
        <>
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
        </>
      )}

      {references.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>
            <Text style={styles.eyebrowStar}>◆ </Text>{t('res.refs')}
          </Text>
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
        </>
      )}

      <Pressable onPress={shareReport} style={styles.shareButton}>
        <Text style={styles.shareButtonText}>{t('res.share')}</Text>
      </Pressable>

      <Pressable onPress={() => navigation.popToTop()}>
        {({ pressed }) => (
          <LinearGradient
            colors={gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.doneButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.doneButtonText}>{t('res.newReview')}</Text>
          </LinearGradient>
        )}
      </Pressable>

      {isScanned && (
        <Text style={styles.scanNote}>{t('res.scanNote')}</Text>
      )}
      <Text style={styles.disclaimer}>{t('res.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  fileName: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: 4,
  },
  sealWrap: { alignItems: 'center', marginVertical: 20 },
  rationale: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSoft,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 14,
    paddingHorizontal: 12,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 22,
  },
  sevChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sevChipText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricsRow: { gap: 10, paddingBottom: 4, marginBottom: 18 },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 130,
    maxWidth: 180,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.textSoft,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: fonts.mono,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  metricNote: { fontSize: 11, color: colors.textSoft, marginTop: 4 },
  questionMark: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.gold,
    width: 22,
  },
  shareButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 10,
  },
  shareButtonText: { color: colors.cyan, fontSize: 14.5, fontWeight: '600' },
  sectionEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSoft,
    marginBottom: 8,
    marginTop: 8,
  },
  eyebrowStar: { color: colors.gold },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 16,
  },
  summary: { fontSize: 14.5, lineHeight: 22, color: colors.text },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskIndex: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSoft },
  severityBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  riskTitle: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.text,
    marginBottom: 10,
    lineHeight: 23,
  },
  evidence: {
    borderLeftWidth: 3,
    borderLeftColor: colors.line,
    paddingLeft: 12,
    marginBottom: 10,
  },
  evidenceText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSoft,
    fontStyle: 'italic',
  },
  riskExplanation: { fontSize: 13.5, lineHeight: 20, color: colors.text },
  recRow: { flexDirection: 'row', paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  recIndex: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.cyan,
    marginRight: 12,
    marginTop: 1,
  },
  recText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  refRow: { paddingVertical: 10 },
  refSource: { fontSize: 13.5, fontWeight: '600', color: colors.text },
  refNote: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  doneButton: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  doneButtonText: { color: colors.bgDeep, fontSize: 15.5, fontWeight: '800' },
  scanNote: {
    fontSize: 11.5,
    color: colors.riskMid,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 14,
    paddingHorizontal: 18,
    lineHeight: 16,
  },
  disclaimer: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});