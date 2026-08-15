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
import { colors, fonts } from '../theme';

const appJson = require('../../app.json');
const VERSION = appJson.expo.version;

const PRIVACY_URL = 'https://audittrove.com/privacy';
const WEBSITE_URL = 'https://audittrove.com';

function openUrl(url) {
  Linking.openURL(url).catch(() =>
    Alert.alert('Bağlantı açılamadı', 'Lütfen daha sonra tekrar deneyin.')
  );
}

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.aboutCard}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>AuditTrove</Text>
        <Text style={styles.aboutText}>
          Finansal raporlarınız için yapay zekâ destekli inceleme. PDF
          raporunuzu yükleyin; risk skoru, yönetici özeti ve sayfa referanslı
          bulgular hazırlansın.
        </Text>
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>BAĞLANTILAR
      </Text>
      <View style={styles.card}>
        <Pressable style={styles.row} onPress={() => openUrl(PRIVACY_URL)}>
          <Text style={styles.rowText}>Gizlilik Politikası</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowDivider]}
          onPress={() => openUrl(WEBSITE_URL)}
        >
          <Text style={styles.rowText}>Web sitesi</Text>
          <Text style={styles.rowChevron}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionEyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>UYGULAMA
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowText}>Versiyon</Text>
          <Text style={styles.rowValue}>{VERSION}</Text>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        AuditTrove bir karar destek aracıdır; finansal, muhasebe, yatırım,
        vergi veya hukuk danışmanlığı değildir. Bulgular, uzman incelemesinden
        geçirilmeden esas alınmamalıdır.
      </Text>
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