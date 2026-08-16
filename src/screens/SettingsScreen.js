import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../theme';
import { ONBOARDING_KEY } from './OnboardingScreen';
import { PURCHASES_ENABLED, restorePurchases } from '../api/purchases';
import { t } from '../i18n';

const appJson = require('../../app.json');
const VERSION = appJson.expo.version;

const PRIVACY_URL = 'https://audittrove.com/privacy';
const WEBSITE_URL = 'https://audittrove.com';

function openUrl(url) {
  Linking.openURL(url).catch(() =>
    Alert.alert(t('set.linkError'), t('set.linkErrorMsg'))
  );
}

export default function SettingsScreen({ navigation }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.aboutCard}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>AuditTrove</Text>
        <Text style={styles.aboutText}>{t('set.about')}</Text>
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>{t('set.subs')}
      </Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => navigation.navigate('Paywall')}>
          <Text style={styles.rowText}>{t('set.pro')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowDivider]}
          onPress={async () => {
            if (!PURCHASES_ENABLED) {
              Alert.alert(t('iap.testMode'), t('iap.restoreOnlyReal'));
              return;
            }
            try {
              const isPro = await restorePurchases();
              Alert.alert(
                isPro ? t('iap.restored') : t('iap.notFound'),
                isPro ? t('iap.activeMsg') : t('iap.notFoundMsg')
              );
            } catch (e) {
              Alert.alert(t('iap.restoreFail'), e.message);
            }
          }}
        >
          <Text style={styles.rowText}>{t('set.restore')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>{t('set.links')}
      </Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => openUrl(PRIVACY_URL)}>
          <Text style={styles.rowText}>{t('set.privacy')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowDivider]}
          onPress={() => openUrl(WEBSITE_URL)}
        >
          <Text style={styles.rowText}>{t('set.website')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>{t('set.app')}
      </Text>
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          onPress={async () => {
            try {
              await AsyncStorage.removeItem(ONBOARDING_KEY);
            } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          }}
        >
          <Text style={styles.rowText}>{t('set.showIntro')}</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <View style={[styles.row, styles.rowDivider]}>
          <Text style={styles.rowText}>{t('set.version')}</Text>
          <Text style={styles.rowValue}>{VERSION}</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>{t('set.disclaimer')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  aboutCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  logo: { width: 72, height: 72, marginBottom: 10 },
  appName: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  aboutText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  sectionEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSoft,
    marginBottom: 8,
  },
  eyebrowStar: { color: colors.gold },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowText: { fontSize: 14.5, color: colors.text },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textSoft,
  },
  rowChevron: { fontSize: 20, color: colors.textSoft, marginTop: -2 },
  disclaimer: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});