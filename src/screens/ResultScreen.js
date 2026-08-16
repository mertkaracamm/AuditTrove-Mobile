import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, fonts, severityMap } from '../theme';
import ScoreSeal from '../components/ScoreSeal';
import { t } from '../i18n';

export default function ResultScreen({ navigation, route }) {
  const { result, fileName } = route.params;
  const risks = result.risks || [];
  const recommendations = result.recommendations || [];
  const references = result.references || [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.fileName} numberOfLines={1}>
        {fileName}
      </Text>

      <View style={styles.sealWrap}>
        <ScoreSeal score={result.riskScore} />
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>{t('res.summary')}
      </Text>
      <View style={styles.card}>
        <Text style={styles.summary}>{result.summary}</Text>
      </View>

      {risks.length > 0 && (
        <>
          <Text style={styles.sectionEyebrow}>
            <Text style={styles.eyebrowStar}>◆ </Text>{t('res.findings')} ({risks.length})
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
  disclaimer: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
