import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, riskColor, riskLabel } from '../theme';

// Yatay skor gostergesi: kirmizi→turuncu→sari→yesil gradient uzerinde,
// skora gore 0'dan dolan parlak bir bar. YUKSEK skor (temiz) sagda/yesilde,
// DUSUK skor (dikkat) solda/kirmizida — sezgisel: dolu bar = temiz belge.
const GRAD = ['#E0453A', '#FF8A5B', '#F5C542', '#2FD48E']; // kirmizi→turuncu→sari→yesil

export default function ScoreSeal({ score }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = riskColor(score);
  const [barW, setBarW] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (barW <= 0) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: clamped / 100,
      duration: 1150,
      useNativeDriver: false,
    }).start();
  }, [clamped, barW]);

  const fillWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });
  const markerLeft = anim.interpolate({ inputRange: [0, 1], outputRange: [0, barW] });

  return (
    <View style={styles.wrap}>
      <View style={styles.numRow}>
        <Text style={styles.num}>{score}</Text>
        <Text style={styles.of}>/ 100</Text>
      </View>

      <View
        style={styles.track}
        onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      >
        {/* Tum skala — soluk gradient (nerede oldugunu baglamlar) */}
        <LinearGradient
          colors={GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.rounded, { opacity: 0.2 }]}
        />
        {/* Dolan parlak kisim: 0 → skor. Ic gradient tam bar genisligindedir ki
            renkler skalaya sabitli kalsin (dolan kisim gercek rengini gostersin). */}
        <Animated.View style={[styles.fillClip, { width: fillWidth }]}>
          <LinearGradient
            colors={GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: barW, height: '100%' }}
          />
        </Animated.View>
        {/* Skorun tam yerini gosteren isaretci */}
        <Animated.View
          style={[styles.marker, { left: markerLeft, backgroundColor: color }]}
        />
      </View>

      <View style={[styles.chip, { borderColor: color }]}>
        <Text style={[styles.chipText, { color }]} numberOfLines={1}>
          {riskLabel(score)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%', paddingHorizontal: 6 },
  numRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 },
  num: { fontFamily: fonts.mono, fontSize: 60, fontWeight: '700', letterSpacing: -1.5, color: colors.text },
  of: { fontFamily: fonts.mono, fontSize: 16, color: colors.textSoft, marginBottom: 12, marginLeft: 5 },
  track: {
    width: '100%',
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  rounded: { borderRadius: 999 },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  marker: {
    position: 'absolute',
    width: 5,
    height: 28,
    borderRadius: 3,
    marginLeft: -2.5,
    top: -6,
    borderWidth: 2,
    borderColor: colors.bg,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  chip: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  chipText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
});