import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { t } from '../i18n';

// Masaya serilmis belge destesi: her tip kendi renk tonunda, hafif egik bir kart.
// Secilen kart dikleşip buyur ve kendi renginde parlar.
export const DOC_TYPES = [
  { id: 'general', icon: 'document-text-outline', color: '#8FA3D9' },
  { id: 'financial', icon: 'trending-up-outline', color: '#F5C542' },
  { id: 'rental', icon: 'home-outline', color: '#05D9F0' },
  { id: 'subscription', icon: 'repeat-outline', color: '#B48CF2' },
  { id: 'insurance', icon: 'shield-checkmark-outline', color: '#02A5A5' },
  { id: 'vehicle', icon: 'car-outline', color: '#FF9B54' },
  { id: 'employment', icon: 'briefcase-outline', color: '#2FD48E' },
];

export function docTypeLabel(id) {
  return t('doctype.' + id);
}

export function docTypeColor(id) {
  const found = DOC_TYPES.find((d) => d.id === id);
  return found ? found.color : colors.textSoft;
}

function DeckCard({ type, index, selected, onPress }) {
  const dealt = useRef(new Animated.Value(0)).current; // acilis: dagitma
  const lift = useRef(new Animated.Value(selected ? 1 : 0)).current; // secim: dikles+buyu

  useEffect(() => {
    Animated.timing(dealt, {
      toValue: 1,
      duration: 380,
      delay: 90 * index,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [dealt, index]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: selected ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [lift, selected]);

  const restTilt = index % 2 === 0 ? '-3deg' : '3deg';
  const rotate = lift.interpolate({ inputRange: [0, 1], outputRange: [restTilt, '0deg'] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const translateY = dealt.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

  return (
    <Animated.View
      style={{
        opacity: dealt,
        transform: [{ translateY }, { rotate }, { scale }],
      }}
    >
      <Pressable
        onPress={() => onPress(type.id)}
        style={[
          styles.card,
          selected && {
            borderColor: type.color,
            shadowColor: type.color,
            shadowOpacity: 0.55,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={docTypeLabel(type.id)}
      >
        <View style={[styles.iconWrap, { backgroundColor: type.color + '22' }]}>
          <Ionicons name={type.icon} size={22} color={type.color} />
        </View>
        <Text style={[styles.label, selected && { color: colors.text }]} numberOfLines={2}>
          {docTypeLabel(type.id)}
        </Text>
        {selected && (
          <View style={[styles.checkBadge, { backgroundColor: type.color }]}>
            <Ionicons name="checkmark" size={11} color={colors.bg} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function DocTypePicker({ value, onChange }) {
  return (
    <View>
      <Text style={styles.eyebrow}>{t('doctype.title')}</Text>
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
    marginBottom: 10,
    textAlign: 'center',
  },
  deck: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  card: {
    width: 92,
    minHeight: 96,
    backgroundColor: colors.cardSoft,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    shadowOpacity: 0,
    elevation: 2,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 10.5,
    color: colors.textSoft,
    textAlign: 'center',
    lineHeight: 13,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
