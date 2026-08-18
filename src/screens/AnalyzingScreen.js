import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  Image,
  Pressable,
  AppState,
} from 'react-native';
import { colors, fonts } from '../theme';
import { t } from '../i18n';
import { useJob } from '../jobs/JobContext';

const STEPS = [t('an.s1'), t('an.s2'), t('an.s3'), t('an.s4')];
const LIVE_MSGS = [t('an.s5'), t('an.s6'), t('an.s7'), t('an.s3')];

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AnalyzingScreen({ navigation, route }) {
  const { activeJob, completedJob, failedJob, consumeCompleted, clearFailed } = useJob();
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [liveIndex, setLiveIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  // Sayac gercek saate baglanir: arka planda JS dursa da donunce dogru sureyi gosterir
  const startRef = useRef((activeJob && activeJob.startedAt) || Date.now());
  // Sonuc/hata YALNIZCA bir kez islensin (cift navigation'i onler)
  const handledRef = useRef(false);

  const fileName =
    (activeJob && activeJob.fileName) ||
    (route.params && route.params.file && route.params.file.name) ||
    '';

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    const interval = setInterval(() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1)), 1400);
    // Gecen sureyi gercek saatten hesapla (arka plandan donunce dogru olsun)
    if (activeJob && activeJob.startedAt) startRef.current = activeJob.startedAt;
    const computeElapsed = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    computeElapsed();
    const tick = setInterval(computeElapsed, 1000);
    const live = setInterval(() => setLiveIndex((i) => (i + 1) % LIVE_MSGS.length), 3000);
    // Uygulama on plana donunce sureyi hemen guncelle
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') computeElapsed();
    });
    return () => {
      clearInterval(interval);
      clearInterval(tick);
      clearInterval(live);
      appSub.remove();
    };
  }, []);

  // Is bitince otomatik Result'a gec (kullanici bu ekranda bekliyorsa) — bir kez
  useEffect(() => {
    if (handledRef.current) return;
    if (completedJob) {
      handledRef.current = true;
      const c = consumeCompleted();
      if (c) navigation.replace('Result', { result: c.result, fileName: c.fileName, docType: c.docType });
    }
  }, [completedJob]);

  // Is basarisiz olursa: sayacli ekranda takilmadan derhal ana sayfaya don.
  // Hata, ana sayfadaki "İnceleme tamamlanamadı" kartinda gorunur (X ile kapatilir).
  useEffect(() => {
    if (handledRef.current) return;
    if (failedJob) {
      handledRef.current = true;
      navigation.navigate('Home');
    }
  }, [failedJob]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.screen}>
      <View style={styles.sealArea}>
        <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
        <Animated.Image
          source={require('../../assets/logo.png')}
          style={[styles.logo, { transform: [{ scale: pulse }] }]}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.fileName} numberOfLines={1}>
        {fileName}
      </Text>
      <Text style={styles.title}>{t('an.title')}</Text>

      <View style={styles.steps}>
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <View key={label} style={styles.stepRow}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]} />
              <Text style={[styles.stepText, (done || active) && styles.stepTextActive]}>{label}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.liveRow}>
        <Text style={styles.liveText} numberOfLines={1}>
          {LIVE_MSGS[liveIndex]}
        </Text>
        <Text style={styles.elapsed}>{fmtElapsed(elapsed)}</Text>
      </View>

      {elapsed >= 20 && <Text style={styles.hint}>{t('an.longHint')}</Text>}

      <Text style={styles.bgSafe}>{t('an.bgSafe')}</Text>

      {/* Fire-and-forget: is arka planda surerken ana sayfaya don */}
      <Pressable onPress={() => navigation.navigate('Home')} hitSlop={10} style={styles.bgButton}>
        <Text style={styles.bgButtonText}>{t('an.background')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  sealArea: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.line,
    borderTopColor: colors.cyan,
    borderRightColor: colors.teal,
  },
  logo: { width: 72, height: 72 },
  fileName: { fontFamily: fonts.mono, fontSize: 12.5, color: colors.textSoft, marginBottom: 6, maxWidth: '80%' },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.text, marginBottom: 32 },
  steps: { alignSelf: 'stretch', paddingHorizontal: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line, marginRight: 12 },
  stepDotDone: { backgroundColor: colors.riskLow },
  stepDotActive: { backgroundColor: colors.cyan },
  stepText: { fontSize: 14.5, color: colors.textSoft },
  stepTextActive: { color: colors.text, fontWeight: '600' },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginTop: 22,
    paddingHorizontal: 12,
  },
  liveText: { flex: 1, fontSize: 13.5, color: colors.cyan, marginRight: 10 },
  elapsed: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSoft },
  hint: { fontSize: 12.5, color: colors.textSoft, marginTop: 14, paddingHorizontal: 12, textAlign: 'center' },
  bgSafe: {
    fontSize: 12.5,
    color: colors.textSoft,
    marginTop: 8,
    paddingHorizontal: 24,
    textAlign: 'center',
    lineHeight: 17,
  },
  bgButton: { marginTop: 24, paddingVertical: 10, paddingHorizontal: 18 },
  bgButtonText: { fontSize: 14.5, color: colors.cyan, fontWeight: '600' },
});