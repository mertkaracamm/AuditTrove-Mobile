import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts, riskColor, riskBg, riskLabel } from '../theme';
import { getHistory, clearHistory } from '../storage/history';

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setHistory);
    }, [])
  );

  function confirmClear() {
    Alert.alert('Geçmişi temizle', 'Tüm denetim kayıtları silinsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setHistory([]);
        },
      },
    ]);
  }

  if (history.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Henüz denetim yok</Text>
        <Text style={styles.emptyText}>
          İlk PDF belgenizi yüklediğinizde denetim geçmişiniz burada listelenir.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Home')}
          style={({ pressed }) => [
            styles.emptyButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.emptyButtonText}>Belge yükle</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const score = item.result.riskScore;
          return (
            <Pressable
              onPress={() =>
                navigation.navigate('Result', {
                  result: item.result,
                  fileName: item.fileName,
                  fromHistory: true,
                })
              }
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
            >
              <View
                style={[styles.scoreChip, { backgroundColor: riskBg(score) }]}
              >
                <Text style={[styles.scoreChipText, { color: riskColor(score) }]}>
                  {score}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.fileName}
                </Text>
                <Text style={styles.meta}>
                  {riskLabel(score)} ·{' '}
                  {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Pressable onPress={confirmClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Geçmişi temizle</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  scoreChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  scoreChipText: { fontFamily: fonts.mono, fontSize: 17, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12.5, color: colors.textSoft, marginTop: 3 },
  clearButton: { alignItems: 'center', paddingVertical: 16 },
  clearButtonText: { fontSize: 13.5, fontWeight: '600', color: colors.riskHigh },
  empty: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: colors.cyan,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: { color: colors.bgDeep, fontSize: 14.5, fontWeight: '800' },
});
