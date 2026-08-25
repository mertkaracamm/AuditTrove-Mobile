import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { t } from '../i18n';

// Duzenli ikon sirasi + secime gore donusen inceleme paneli.
// Bir tipe dokununca panel o tipin rengine burunur ve "nelere bakilir" satiri degisir.
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

function IconChip({ type, selected, onPress }) {
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(pop, {
      toValue: selected ? 1 : 0,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [pop, selected]);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View style={{ transform: [{ scale }], flexBasis: '21%' }}>
      <Pressable
        onPress={() => onPress(type.id)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={docTypeLabel(type.id)}
        style={[
          styles.chip,
          selected && {
            backgroundColor: type.color,
            borderColor: type.color,
            shadowColor: type.color,
            shadowOpacity: 0.55,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          },
        ]}
      >
        <Ionicons
          name={selected ? type.icon : type.icon + '-outline'}
          size={21}
          color={selected ? '#081233' : type.color}
        />
        <Text
          style={[styles.chipLabel, selected && { color: '#081233', fontWeight: '700' }]}
          numberOfLines={1}
        >
          {t('doctype.short.' + type.id)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function DocTypePicker({ value, onChange }) {
  const type = DOC_TYPES.find((d) => d.id === value) || DOC_TYPES[0];
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reveal, value]);

  const slide = reveal.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View>
      <Text style={styles.eyebrow}>
        <Text style={{ color: colors.gold }}>◆ </Text>
        {t('doctype.title')}
      </Text>

      <View style={styles.chipGrid}>
        {DOC_TYPES.map((d) => (
          <IconChip key={d.id} type={d} selected={value === d.id} onPress={onChange} />
        ))}
      </View>

      <Animated.View style={{ opacity: reveal, transform: [{ translateY: slide }] }}>
        <LinearGradient
          colors={[type.color + '2E', type.color + '10']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { borderColor: type.color + '66' }]}
        >
          <View style={[styles.heroIcon, { backgroundColor: type.color }]}>
            <Ionicons name={type.icon} size={26} color="#081233" />
          </View>
          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { color: type.color }]}>
              {docTypeLabel(type.id)}
            </Text>
            <Text style={styles.heroFocus}>{t('doctype.focus.' + type.id)}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 11,
  },
  chip: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.cardSoft,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 9,
    color: colors.textSoft,
    marginTop: 3,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 12,
    marginHorizontal: 2,
    gap: 12,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1 },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    marginBottom: 3,
  },
  heroFocus: {
    fontSize: 11.5,
    color: colors.textSoft,
    lineHeight: 15.5,
  },
});
