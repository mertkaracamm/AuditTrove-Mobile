import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, fonts } from '../theme';
import {
  PURCHASES_ENABLED,
  getPaywallPackages,
  purchasePackage,
  restorePurchases,
} from '../api/purchases';
import { FREE_MONTHLY_LIMIT } from '../storage/usage';
import { t } from '../i18n';

const FEATURES = [t('pw.f1'), t('pw.f2'), t('pw.f3'), t('pw.f4')];

// Paketler yuklenemezse (or. Expo Go) gosterilecek yedek fiyatlar
const FALLBACK_PLANS = [
  { key: 'annual', title: t('pw.yearly'), price: '$49.99', note: t('pw.perYear') },
  { key: 'monthly', title: t('pw.monthly'), price: '$6.99', note: t('pw.perMonth') },
];

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://audittrove.com/privacy';

export default function PaywallScreen({ navigation }) {
  const [packages, setPackages] = useState([]);
  const [selected, setSelected] = useState('annual');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPaywallPackages().then(setPackages);
  }, []);

  const plans =
    packages.length > 0
      ? packages.map((p) => ({
          key: p.packageType === 'ANNUAL' ? 'annual' : 'monthly',
          title: p.packageType === 'ANNUAL' ? t('pw.yearly') : t('pw.monthly'),
          price: p.product?.priceString ?? '',
          note: p.packageType === 'ANNUAL' ? t('pw.perYear') : t('pw.perMonth'),
          pkg: p,
        }))
      : FALLBACK_PLANS;

  async function buy() {
    const plan = plans.find((p) => p.key === selected);
    if (!PURCHASES_ENABLED || !plan?.pkg) {
      Alert.alert(t('iap.testMode'), t('iap.purchaseOnlyReal'));
      return;
    }
    setBusy(true);
    try {
      const { isPro, cancelled } = await purchasePackage(plan.pkg);
      if (cancelled) return;
      if (isPro) {
        Alert.alert(t('iap.welcome'), t('iap.activeMsg'), [
          { text: t('common.ok'), onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e) {
      Alert.alert(t('iap.purchaseFail'), e.message);
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!PURCHASES_ENABLED) {
      Alert.alert(t('iap.testMode'), t('iap.restoreOnlyReal'));
      return;
    }
    setBusy(true);
    try {
      const isPro = await restorePurchases();
      Alert.alert(
        isPro ? t('iap.restored') : t('iap.notFound'),
        isPro ? t('iap.activeMsg') : t('iap.notFoundMsg'),
        isPro ? [{ text: t('common.ok'), onPress: () => navigation.goBack() }] : undefined
      );
    } catch (e) {
      Alert.alert(t('iap.restoreFail'), e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={gradients.hero} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>
          <Text style={styles.eyebrowStar}>✦ </Text>{t('pw.eyebrow')}
        </Text>
        <Text style={styles.title}>{t('pw.title')}</Text>
        <Text style={styles.subtitle}>
          {t('pw.subtitle', { limit: FREE_MONTHLY_LIMIT })}
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureTick}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {plans.map((plan) => {
          const active = selected === plan.key;
          return (
            <Pressable
              key={plan.key}
              onPress={() => setSelected(plan.key)}
              style={[styles.plan, active && styles.planActive]}
            >
              <View style={styles.planInfo}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <Text style={styles.planNote}>{plan.note}</Text>
              </View>
              <View style={styles.planRight}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                {plan.key === 'annual' && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t('pw.badge')}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}

        <View style={styles.trialPill}>
          <Text style={styles.trialText}>{t('pw.trial')}</Text>
        </View>

        <Pressable onPress={buy} disabled={busy}>
          {({ pressed }) => (
            <LinearGradient
              colors={gradients.button}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.bgDeep} />
              ) : (
                <Text style={styles.ctaText}>{t('pw.cta')}</Text>
              )}
            </LinearGradient>
          )}
        </Pressable>

        <Text style={styles.renewNote}>{t('pw.renewNote')}</Text>

        <Pressable onPress={restore} hitSlop={8}>
          <Text style={styles.restore}>{t('pw.restore')}</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.legalLink}>{t('pw.terms')}</Text>
          </Pressable>
          <Text style={styles.legalDot}>·</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.legalLink}>{t('pw.privacy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textSoft,
    marginBottom: 8,
  },
  eyebrowStar: { color: colors.gold },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSoft,
    marginBottom: 20,
  },
  features: { marginBottom: 24 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureTick: {
    color: colors.mint,
    fontSize: 15,
    fontWeight: '700',
    width: 24,
  },
  featureText: { color: colors.text, fontSize: 14.5 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 12,
  },
  planActive: { borderColor: colors.cyan },
  planInfo: { flex: 1 },
  planTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.text,
  },
  planNote: { fontSize: 12.5, color: colors.textSoft, marginTop: 2 },
  planRight: { alignItems: 'flex-end' },
  planPrice: {
    fontFamily: fonts.mono,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.gold,
  },
  trialPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245,197,66,0.14)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
    marginBottom: 14,
  },
  trialText: { color: colors.gold, fontSize: 13, fontWeight: '700' },
  cta: {
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: { color: colors.bgDeep, fontSize: 16, fontWeight: '800' },
  renewNote: {
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 18,
  },
  restore: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 18,
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: { color: colors.textSoft, fontSize: 12.5 },
  legalDot: { color: colors.textSoft },
});