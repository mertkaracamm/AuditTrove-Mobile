import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, {
  Circle,
  Line,
  G,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from 'react-native-svg';
import { colors, fonts, riskColor, riskLabel } from '../theme';
import { getLocale } from '../i18n';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// İmza öğesi: parlayan denetim mührü.
// Cyan→teal gradient yay, mühür dişleri, tepede altın "trove" yıldızı,
// skor yükleme animasyonuyla dolar.
export default function ScoreSeal({ score, size = 220 }) {
  const stroke = 13;
  const r = (size - stroke) / 2 - 16;
  const c = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(100, score)) / 100;
  const color = riskColor(score);
  const center = size / 2;

  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: target,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [target]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [c, 0],
  });

  const ticks = [];
  const tickOuter = size / 2 - 2;
  const tickInner = size / 2 - 10;
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI;
    ticks.push(
      <Line
        key={i}
        x1={center + tickInner * Math.cos(angle)}
        y1={center + tickInner * Math.sin(angle)}
        x2={center + tickOuter * Math.cos(angle)}
        y2={center + tickOuter * Math.sin(angle)}
        stroke={colors.line}
        strokeWidth={1.5}
      />
    );
  }

  // Tepedeki küçük altın yıldız (logodaki "trove" motifi)
  const starY = center - r - 2;
  const s = 7;
  const star = `M ${center} ${starY - s} L ${center + s * 0.35} ${starY - s * 0.35} L ${center + s} ${starY} L ${center + s * 0.35} ${starY + s * 0.35} L ${center} ${starY + s} L ${center - s * 0.35} ${starY + s * 0.35} L ${center - s} ${starY} L ${center - s * 0.35} ${starY - s * 0.35} Z`;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View style={[styles.glow, { backgroundColor: color }]} />
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.cyan} />
            <Stop offset="1" stopColor={color} />
          </LinearGradient>
        </Defs>
        <G>{ticks}</G>
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={colors.line}
          strokeWidth={stroke}
          fill="none"
          opacity={0.6}
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#arc)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <Path d={star} fill={colors.gold} />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.score, { color: colors.text }]}>{score}</Text>
        <Text style={styles.of}>/ 100</Text>
        <View style={[styles.labelChip, { borderColor: color }]}>
          <Text style={[styles.label, { color }]}>{riskLabel(score).toLocaleUpperCase(getLocale() === 'tr' ? 'tr-TR' : 'en-US')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.12,
    transform: [{ scale: 1.4 }],
  },
  center: { position: 'absolute', alignItems: 'center' },
  score: {
    fontFamily: fonts.mono,
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  of: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSoft, marginTop: -2 },
  labelChip: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});