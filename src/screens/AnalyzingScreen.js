import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Alert,
  Image,
} from 'react-native';
import { colors, fonts } from '../theme';
import { t } from '../i18n';
import { auditDocument } from '../api/client';
import { addToHistory } from '../storage/history';
import { incrementMonthlyUsage } from '../storage/usage';

const STEPS = [t('an.s1'), t('an.s2'), t('an.s3'), t('an.s4')];

export default function AnalyzingScreen({ navigation, route }) {
  const { file, docType } = route.params;
  const [stepIndex, setStepIndex] = useState(0);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1400);

    let cancelled = false;
    (async () => {
      try {
        const result = await auditDocument(file, docType);
        if (cancelled) return;
        await addToHistory({ fileName: file.name, result, docType });
        await incrementMonthlyUsage();
        navigation.replace('Result', { result, fileName: file.name, docType });
      } catch (e) {
        if (cancelled) return;
        if (e.code === 'MONTHLY_LIMIT_REACHED') {
          navigation.replace('Paywall');
          return;
        }
        Alert.alert(t('an.failTitle'), e.message, [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ]);
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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
        {file.name}
      </Text>
      <Text style={styles.title}>{t('an.title')}</Text>

      <View style={styles.steps}>
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <View key={label} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  active && styles.stepDotActive,
                ]}
              />
              <Text
                style={[
                  styles.stepText,
                  (done || active) && styles.stepTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
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
  sealArea: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
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
  fileName: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    color: colors.textSoft,
    marginBottom: 6,
    maxWidth: '80%',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: 32,
  },
  steps: { alignSelf: 'stretch', paddingHorizontal: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.line,
    marginRight: 12,
  },
  stepDotDone: { backgroundColor: colors.riskLow },
  stepDotActive: { backgroundColor: colors.cyan },
  stepText: { fontSize: 14.5, color: colors.textSoft },
  stepTextActive: { color: colors.text, fontWeight: '600' },
});