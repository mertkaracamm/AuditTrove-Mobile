import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { t } from '../i18n';

// Masaya serilmis belge destesi: her tip kendi renginde bir kart.
// Secilen kart dikleşir, buyur ve kendi renk gradientiyle dolar.
export const DOC_TYPES = [
  { id: 'general', icon: 'document-text', color: '#8FA3D9', dark: '#5B72B8' },
  { id: 'financial', icon: 'trending-up', color: '#F5C542', dark: '#D99A1B' },
  { id: 'rental', icon: 'home', color: '#05D9F0', dark: '#0397C4' },
  { id: 'subscription', icon: 'repeat', color: '#B48CF2', dark: '#8557D6' },
  { id: 'insurance', icon: 'shield-checkmark', color: '#1FC3C3', dark: '#028585' },
  { id: 'vehicle', icon: 'car-sport', color: '#FF9B54', dark: '#E06A1F' },
  { id: 'employment', icon: 'briefcase', color: '#2FD48E', dark: '#149A61' },
];

export function docTypeLabel(id) {
  return t('doctype.' + id);
}

export function docTypeColor(id) {
  const found = DOC_TYPES.find((d) => d.id === id);
  return found ? found.color : colors.textSoft;
}

function DeckCard({ type, index, selected, onPress }) {
  const dealt = useRef(new Animated.Value(0)).current; // acilis: desteden dagitma
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current; // secim: dikles + buyu

  useEffect(() => {
    Animated.timing(dealt, {
      toValue: 1,
      duration: 400,
      delay: 80 * index,
      easing: Easing.out(Easing.back(1.5)),
      useNativeDriver: true,
    }).start();
  }, [dealt, index]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [lift, selected]);

  const restTilt = index % 2 === 0 ? '-3.5deg' : '3.5deg';
  const rotate = lift.interpolate({ inputRange: [0, 1], outputRange: [restTilt, '0deg'] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const translateY = dealt.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });

  const face = selected ? (
    <LinearGradient
      colors={[type.color, type.dark]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.face, styles.faceSelected]}
    >
      <View style={styles.iconWrapSelected}>
        <Ionicons name={type.icon} size={24} color={type.dark} />
      </View>
      <Text style={styles.labelSelected} numberOfLines={2}>
        {docTypeLabel(type.id)}
      </Text>
      <View style={styles.checkBadge}>
        <Ionicons name="checkmark" size={12} color={type.dark} />
      </View>
    </LinearGradient>
  ) : (
    <View style={[styles.face, styles.faceIdle]}>
      <View style={[styles.iconWrap, { backgroundColor: type.color + '1F' }]}>
        <Ionicons name={type.icon + '-outline'} size={24} color={type.color} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {docTypeLabel(type.id)}
      </Text>
    </View>
  );

  return (
    <Animated.View
      style={{
        opacity: dealt,
        transform: [{ translateY }, { rotate }, { scale }],
        ...(selected && {
          shadowColor: type.color,
          shadowOpacity: 0.6,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }),
      }}
    >
      <Pressable
        onPress={() => onPress(type.id)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={docTypeLabel(type.id)}
      >
        {face}
      </Pressable>
    </Animated.View>
  );
}

export default function DocTypePicker({ value, onChange }) {
  return (
    <View>
      <Text style={styles.eyebrow}>
        <Text style={styles.eyebrowStar}>◆ </Text>
        {t('doctype.title')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deck}
      >
        {DOC_TYPES.map((type, i) => (
          <DeckCard
            key={type.id}
            type={type}
            index={i}
            selected={value === type.id}
            onPress={onChange}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.textSoft,
    marginBottom: 12,
    textAlign: 'center',
  },
  eyebrowStar: { color: colors.gold },
  deck: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
  },
  face: {
    width: 106,
    minHeight: 118,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  faceIdle: {
    backgroundColor: colors.cardSoft,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  faceSelected: {
    borderWidth: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconWrapSelected: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 11.5,
    color: colors.textSoft,
    textAlign: 'center',
    lineHeight: 14.5,
  },
  labelSelected: {
    fontSize: 11.5,
    color: '#081233',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14.5,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
