import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { colors, gradients, fonts, riskColor } from '../theme';
import { getHistory } from '../storage/history';
import { USE_MOCK } from '../api/client';
import { checkIsPro } from '../api/purchases';
import { getMonthlyUsage, FREE_MONTHLY_LIMIT } from '../storage/usage';
import { t } from '../i18n';
import DocTypePicker from '../components/DocTypePicker';
import { SCAN_ENABLED, PHOTOS_ENABLED, scanToPdf, pickPhotosToPdf } from '../scan/scanner';
import { useJob } from '../jobs/JobContext';

const SUPPORTED = [
  t('home.supported1'),
  t('home.supported2'),
  t('home.supported3'),
  t('home.supported4'),
];

const PIPELINE = [
  { step: 'PDF', label: t('home.pipeExtract') },
  { step: 'AI', label: t('home.pipeAnalyze') },
  { step: 'RPR', label: t('home.pipeFindings') },
];

export default function HomeScreen({ navigation }) {
  const [docType, setDocType] = React.useState('general');
  const [recent, setRecent] = useState([]);
  const { activeJob, completedJob, failedJob, startJob, consumeCompleted, clearFailed } = useJob();

  // Belge gonderilmeden once, iceriginin analiz icin OpenAI'ye gonderilecegini
  // acikca bildirir ve onay ister. App Review 5.1.2(i) geregi bu onay HER belge
  // gonderiminde istenir (kayit tutulmaz); onay verilene kadar hicbir veri cihazdan cikmaz.
  function ensureAiConsent() {
    return new Promise((resolve) => {
      Alert.alert(
        t('consent.title'),
        t('consent.body'),
        [
          { text: t('consent.cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: t('consent.accept'), onPress: () => resolve(true) },
        ],
        { cancelable: false }
      );
    });
  }

  // Isi baslat: JobContext arka planda takip eder; Analyzing sadece gosterir.
  async function launchJob(file) {
    if (activeJob) {
      Alert.alert(t('home.jobActive'), t('home.jobBusy'));
      return;
    }
    if (!(await ensureAiConsent())) return;
    const r = await startJob(file, docType);
    if (r.ok) {
      navigation.navigate('Analyzing');
      return;
    }
    if (r.code === 'MONTHLY_LIMIT_REACHED') {
      navigation.navigate('Paywall');
      return;
    }
    if (r.code === 'RATE_LIMITED') {
      // Saatlik hiz siniri — abonelik cozmez, Paywall'a GITME; sadece bilgilendir.
      Alert.alert(t('home.rateLimitTitle'), (r.error && r.error.message) || t('cli.hourlyLimit'));
      return;
    }
    Alert.alert(t('home.pickError'), (r.error && r.error.message) || t('cli.serverError'));
  }

  useFocusEffect(
    useCallback(() => {
      getHistory().then((h) => setRecent(h.slice(0, 3)));
    }, [])
  );

  async function ensureQuota() {
    const pro = await checkIsPro();
    if (pro) return true;
    const used = await getMonthlyUsage();
    if (used >= FREE_MONTHLY_LIMIT) {
      navigation.navigate('Paywall');
      return false;
    }
    return true;
  }

  async function pickDocument() {
    try {
      if (!(await ensureQuota())) return;
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      await launchJob({ uri: file.uri, name: file.name, mimeType: file.mimeType });
    } catch (e) {
      Alert.alert(t('home.pickError'), e.message);
    }
  }

  async function runOcrFlow(producer) {
    try {
      if (!(await ensureQuota())) return;
      const file = await producer();
      if (!file) return; // iptal
      await launchJob(file);
    } catch (e) {
      if (e && e.code === 'SCAN_NO_TEXT') {
        Alert.alert(t('home.scanNoTextTitle'), t('home.scanNoText'));
        return;
      }
      if (e && e.code === 'PHOTOS_DENIED') {
        Alert.alert(t('home.photosDeniedTitle'), t('home.photosDenied'));
        return;
      }
      Alert.alert(t('home.pickError'), e.message);
    }
  }

  const scanDocument = () => runOcrFlow(scanToPdf);
  const pickPhotos = () => runOcrFlow(pickPhotosToPdf);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient colors={gradients.hero} style={styles.hero}>
          <Pressable
            style={styles.settingsButton}
            hitSlop={12}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </Pressable>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>AuditTrove</Text>
          <Text style={styles.tagline}>{t('home.tagline')}</Text>
          {USE_MOCK && (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>{t('home.demo')}</Text>
            </View>
          )}
        </LinearGradient>

        {activeJob && (
          <Pressable style={styles.jobCard} onPress={() => navigation.navigate('Analyzing')}>
            <View style={[styles.jobDot, { backgroundColor: colors.cyan }]} />
            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle}>{t('home.jobActive')}</Text>
              <Text style={styles.jobName} numberOfLines={1}>{activeJob.fileName}</Text>
            </View>
            <Text style={styles.jobAction}>{t('home.jobTap')}</Text>
          </Pressable>
        )}

        {!activeJob && completedJob && (
          <Pressable
            style={styles.jobCard}
            onPress={() => {
              const c = consumeCompleted();
              if (c) navigation.navigate('Result', { result: c.result, fileName: c.fileName, docType: c.docType, language: c.language });
            }}
          >
            <View style={[styles.jobDot, { backgroundColor: colors.riskLow }]} />
            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle}>{t('home.jobReady')}</Text>
              <Text style={styles.jobName} numberOfLines={1}>{completedJob.fileName}</Text>
            </View>
            <Text style={[styles.jobAction, { color: colors.riskLow }]}>{t('home.jobView')}</Text>
          </Pressable>
        )}

        {!activeJob && failedJob && (
          <Pressable style={styles.jobCard} onPress={() => clearFailed()}>
            <View style={[styles.jobDot, { backgroundColor: colors.riskHigh }]} />
            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle}>{t('home.jobFailed')}</Text>
              <Text style={styles.jobName} numberOfLines={1}>{failedJob.fileName}</Text>
            </View>
            <Text style={[styles.jobAction, { color: colors.textSoft }]}>✕</Text>
          </Pressable>
        )}

        <View style={styles.uploadCard}>
          <View style={styles.pipeline}>
            {PIPELINE.map((p, i) => (
              <React.Fragment key={p.step}>
                {i > 0 && <View style={styles.pipelineLine} />}
                <View style={styles.pipelineItem}>
                  <View style={styles.pipelineChip}>
                    <Text style={styles.pipelineStep}>{p.step}</Text>
                  </View>
                  <Text style={styles.pipelineLabel}>{p.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.uploadTitle}>{t('home.uploadTitle')}</Text>
          <Text style={styles.uploadHint}>{t('home.uploadHint')}</Text>
          <DocTypePicker value={docType} onChange={setDocType} />
          <Text style={styles.promise}>{t('home.promise')}</Text>
          <Pressable onPress={pickDocument}>
            {({ pressed }) => (
              <LinearGradient
                colors={gradients.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.uploadButton, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.uploadButtonText}>{t('home.pickPdf')}</Text>
              </LinearGradient>
            )}
          </Pressable>
          {(SCAN_ENABLED || PHOTOS_ENABLED) && (
            <View style={styles.altRow}>
              {SCAN_ENABLED && (
                <Pressable onPress={scanDocument} style={{ flex: 1 }}>
                  {({ pressed }) => (
                    <View style={[styles.scanButton, pressed && { opacity: 0.8 }]}>
                      <Text style={styles.scanButtonText}>{t('home.scan')}</Text>
                    </View>
                  )}
                </Pressable>
              )}
              {PHOTOS_ENABLED && (
                <Pressable onPress={pickPhotos} style={{ flex: 1 }}>
                  {({ pressed }) => (
                    <View style={[styles.scanButton, pressed && { opacity: 0.8 }]}>
                      <Text style={styles.scanButtonText}>{t('home.photos')}</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          )}
          <Text style={styles.trustNote}>{t('home.trustNote')}</Text>
        </View>

        <Text style={styles.sectionEyebrow}>
          <Text style={styles.eyebrowStar}>◆ </Text>{t('home.supportedTitle')}
        </Text>
        <View style={styles.card}>
          {SUPPORTED.map((item, i) => (
            <View
              key={item}
              style={[styles.supportedRow, i > 0 && styles.rowDivider]}
            >
              <View style={styles.dot} />
              <Text style={styles.supportedText}>{item}</Text>
            </View>
          ))}
        </View>

        {recent.length > 0 && (
          <>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionEyebrow}>
                <Text style={styles.eyebrowStar}>◆ </Text>{t('home.recent')}
              </Text>
              <Pressable onPress={() => navigation.navigate('History')}>
                <Text style={styles.seeAll}>{t('home.all')}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {recent.map((item, i) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    navigation.navigate('Result', {
                      result: item.result,
                      fileName: item.fileName,
                      docType: item.docType,
                      language: item.language,
                      fromHistory: true,
                    })
                  }
                  style={[styles.recentRow, i > 0 && styles.rowDivider]}
                >
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    <Text style={styles.recentDate}>
                      {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.recentScore,
                      { color: riskColor(item.result.riskScore) },
                    ]}
                  >
                    {item.result.riskScore}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.disclaimer}>{t('set.disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 48 },
  hero: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logo: { width: 84, height: 84, marginBottom: 10 },
  settingsButton: {
    position: 'absolute',
    top: 58,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 17, color: colors.textSoft },
  brand: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.text,
    letterSpacing: 0.3,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: 'center',
  },
  demoBadge: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  demoBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    color: colors.gold,
    letterSpacing: 1,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  jobDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  jobInfo: { flex: 1 },
  jobTitle: { fontSize: 13, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  jobName: { fontFamily: fonts.mono, fontSize: 12, color: colors.textSoft, marginTop: 2 },
  jobAction: { fontSize: 13.5, fontWeight: '600', color: colors.cyan, marginLeft: 10 },
  uploadCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 22,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 28,
  },
  pipeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pipelineItem: { alignItems: 'center', width: 84 },
  pipelineChip: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 5,
  },
  pipelineStep: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: colors.cyan,
  },
  pipelineLabel: { fontSize: 10.5, color: colors.textSoft, textAlign: 'center' },
  pipelineLine: {
    width: 22,
    height: 1,
    backgroundColor: colors.line,
    marginTop: 14,
  },
  promise: {
    fontSize: 11.5,
    color: colors.textSoft,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: 8,
    lineHeight: 16,
  },
  uploadTitle: {
    fontFamily: fonts.display,
    fontSize: 21,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  trustNote: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSoft,
    textAlign: 'center',
    marginBottom: 18,
  },
  uploadButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadButtonText: { color: colors.bgDeep, fontSize: 15.5, fontWeight: '800' },
  altRow: { flexDirection: 'row', gap: 10 },
  scanButton: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  scanButtonText: { color: colors.cyan, fontSize: 14.5, fontWeight: '700' },
  sectionEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSoft,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  eyebrowStar: { color: colors.gold },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  supportedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
    marginRight: 10,
  },
  supportedText: { fontSize: 14.5, color: colors.text },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 20,
  },
  seeAll: { fontSize: 13, fontWeight: '700', color: colors.cyan, marginBottom: 8 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  recentInfo: { flex: 1, marginRight: 12 },
  recentName: { fontSize: 14.5, fontWeight: '600', color: colors.text },
  recentDate: { fontSize: 12, color: colors.textSoft, marginTop: 2 },
  recentScore: { fontFamily: fonts.mono, fontSize: 20, fontWeight: '700' },
  disclaimer: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 28,
  },
});
