import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, gradients, fonts } from '../theme';
import { t } from '../i18n';

const { width } = Dimensions.get('window');

export const ONBOARDING_KEY = 'audittrove:onboardingDone';

const SLIDES = [
  { id: '1', art: 'inputs', titleKey: 'ob.t1', bodyKey: 'ob.b1' },
  { id: '2', art: 'background', titleKey: 'ob.t2', bodyKey: 'ob.b2' },
  { id: '3', art: 'report', titleKey: 'ob.t3', bodyKey: 'ob.b3' },
  { id: '4', art: 'privacy', titleKey: 'ob.t4', bodyKey: 'ob.b4' },
];

/* ---------- SVG ikonlar (marka cyan, ince cizgi) ---------- */
const S = { stroke: colors.cyan, strokeWidth: 1.8, fill: 'none' };

const IconDoc = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" {...S} strokeLinejoin="round" />
    <Path d="M14 3v5h5" {...S} strokeLinejoin="round" />
    <Line x1="8.5" y1="13" x2="15.5" y2="13" {...S} strokeLinecap="round" />
    <Line x1="8.5" y1="16.5" x2="13.5" y2="16.5" {...S} strokeLinecap="round" />
  </Svg>
);

const IconCamera = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="3" y="7" width="18" height="13" rx="2.4" {...S} strokeLinejoin="round" />
    <Path d="M8 7l1.3-2.2h5.4L16 7" {...S} strokeLinejoin="round" />
    <Circle cx="12" cy="13.2" r="3.4" {...S} />
  </Svg>
);

const IconGallery = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="3" y="4" width="18" height="16" rx="2.4" {...S} strokeLinejoin="round" />
    <Circle cx="8.5" cy="9" r="1.8" {...S} />
    <Path d="M4 18l5-5 3.5 3.5L16 13l4 4" {...S} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const IconBell = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 9a6 6 0 1 1 12 0c0 4.5 2 5.5 2 5.5H4S6 13.5 6 9z" {...S} strokeLinejoin="round" />
    <Path d="M10 19.5a2 2 0 0 0 4 0" {...S} strokeLinecap="round" />
  </Svg>
);

const IconShield = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3l7 3v5c0 5-3.4 8-7 9-3.6-1-7-4-7-9V6z" {...S} strokeLinejoin="round" />
    <Path d="M9 12l2 2 4-4" {...S} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ---------- Slayt gorselleri ---------- */
function InputTile({ icon, label }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileIcon}>{icon}</View>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function ArtInputs() {
  return (
    <View style={styles.tileRow}>
      <InputTile icon={<IconDoc />} label={t('ob.pdf')} />
      <InputTile icon={<IconCamera />} label={t('ob.camera')} />
      <InputTile icon={<IconGallery />} label={t('ob.gallery')} />
    </View>
  );
}

function ArtBackground() {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <IconDoc size={26} />
        <View style={styles.readyChip}>
          <IconBell size={14} />
          <Text style={styles.readyChipText}>{t('ob.badgeReady')}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={gradients.button}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.progressFill, { width: '68%' }]}
        />
      </View>
      <View style={styles.bgChip}>
        <View style={styles.pulseDot} />
        <Text style={styles.bgChipText}>{t('ob.badgeBg')}</Text>
      </View>
    </View>
  );
}

const REPORT_GRAD = ['#E0453A', '#FF8A5B', '#F5C542', '#2FD48E'];

function DemoRow({ label }) {
  return (
    <View style={styles.demoRow}>
      <View style={styles.demoBullet} />
      <Text style={styles.demoRowText} numberOfLines={1}>{label}</Text>
      <View style={styles.pageTag}>
        <Text style={styles.pageTagText}>{t('ob.demoPage')}</Text>
      </View>
    </View>
  );
}

function ArtReport() {
  return (
    <View style={styles.panel}>
      <View style={styles.scoreLine}>
        <Text style={styles.scoreNum}>79</Text>
        <Text style={styles.scoreMax}>/ 100</Text>
      </View>
      <View style={styles.scoreTrackWrap}>
        <LinearGradient
          colors={REPORT_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreTrack}
        />
        <View style={[styles.scoreMarker, { left: '79%' }]} />
      </View>
      <DemoRow label={t('ob.demoRow1')} />
      <DemoRow label={t('ob.demoRow2')} />
    </View>
  );
}

function ArtPrivacy() {
  return (
    <View style={styles.emblemWrap}>
      <IconShield size={40} />
    </View>
  );
}

function SlideArt({ kind }) {
  switch (kind) {
    case 'inputs': return <ArtInputs />;
    case 'background': return <ArtBackground />;
    case 'report': return <ArtReport />;
    default: return <ArtPrivacy />;
  }
}

export default function OnboardingScreen({ navigation }) {
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      // yazilamazsa sorun degil - bir sonraki acilista tekrar gosterilir
    }
    navigation.replace('Home');
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  };

  const onMomentumEnd = (e) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(i);
  };

  return (
    <LinearGradient colors={gradients.hero} style={styles.root}>
      {!isLast && (
        <TouchableOpacity style={styles.skip} onPress={finish} hitSlop={12}>
          <Text style={styles.skipText}>{t('ob.skip')}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.stage}>
              <LinearGradient colors={gradients.sealGlow} style={styles.stageGlow} />
              <SlideArt kind={item.art} />
            </View>
            <Text style={styles.title}>{t(item.titleKey)}</Text>
            <Text style={styles.body}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity onPress={next} activeOpacity={0.85}>
          <LinearGradient
            colors={gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{isLast ? t('ob.start') : t('ob.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    color: colors.textSoft,
    fontSize: 15,
  },
  slide: {
    width,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Gorsel sahne */
  stage: {
    width: '100%',
    height: 230,
    marginBottom: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },

  /* Slayt 4 - kalkan amblemi */
  emblemWrap: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Slayt 1 - giris kutucuklari */
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    width: 92,
    height: 104,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.cardSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Slayt 2 & 3 - panel kart */
  panel: {
    width: 268,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 20,
    gap: 16,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.riskLowBg,
  },
  readyChipText: {
    color: colors.riskLow,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.cardSoft,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
  },
  bgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.cardSoft,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cyan,
  },
  bgChipText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },

  /* Slayt 3 - mini rapor */
  scoreLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  scoreNum: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  scoreMax: {
    color: colors.textSoft,
    fontSize: 15,
    fontFamily: fonts.mono,
  },
  scoreTrackWrap: {
    justifyContent: 'center',
  },
  scoreTrack: {
    height: 12,
    borderRadius: 6,
  },
  scoreMarker: {
    position: 'absolute',
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: colors.text,
    marginLeft: -2,
  },
  demoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  demoBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  demoRowText: {
    flex: 1,
    color: colors.textSoft,
    fontSize: 13,
  },
  pageTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pageTagText: {
    color: colors.cyan,
    fontSize: 11,
    fontFamily: fonts.mono,
  },

  /* Metin */
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSoft,
    textAlign: 'center',
  },

  /* Alt bar */
  footer: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotActive: {
    backgroundColor: colors.cyan,
    width: 20,
  },
  cta: {
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    color: colors.bgDeep,
    fontSize: 16,
    fontWeight: '700',
  },
});