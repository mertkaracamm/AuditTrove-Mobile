// Tanıtım turu: ürünün ne yaptığını ve sıradan bir sohbet botundan farkını yedi slaytta anlatır.
// Görseller kodla çizilir (marka renkleri), ekran görüntüsü kullanılmaz. Anahtar v2: eski kullanıcılar da yeni turu bir kez görür.
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

export const ONBOARDING_KEY = 'audittrove:onboardingDone:v2';

const SLIDES = [
  { id: '1', art: 'inputs', titleKey: 'ob.t1', bodyKey: 'ob.b1' },
  { id: '2', art: 'consensus', titleKey: 'ob.t2', bodyKey: 'ob.b2' },
  { id: '3', art: 'report', titleKey: 'ob.t3', bodyKey: 'ob.b3' },
  { id: '4', art: 'viewer', titleKey: 'ob.t5', bodyKey: 'ob.b5' },
  { id: '5', art: 'chat', titleKey: 'ob.t6', bodyKey: 'ob.b6' },
  { id: '6', art: 'diff', titleKey: 'ob.t7', bodyKey: 'ob.b7' },
  { id: '7', art: 'privacy', titleKey: 'ob.t4', bodyKey: 'ob.b4' },
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

const IconShield = ({ size = 30 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 3l7 3v5c0 5-3.4 8-7 9-3.6-1-7-4-7-9V6z" {...S} strokeLinejoin="round" />
    <Path d="M9 12l2 2 4-4" {...S} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ---------- Slayt 1: giriş kutucukları ---------- */
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

/* ---------- Slayt 2: üç model, tek karar ---------- */
// Logolar kullanılmaz (marka kuralları); renkli nokta + isim yeter. Üçü de onaylı gösterilir, kural metinde anlatılır.
function ModelChip({ name, tint }) {
  return (
    <View style={styles.modelChip}>
      <View style={[styles.modelDot, { backgroundColor: tint }]} />
      <Text style={styles.modelName}>{name}</Text>
      <View style={styles.voteDot}><Text style={styles.voteMark}>✓</Text></View>
    </View>
  );
}

function ArtConsensus() {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelQuestion}>{t('ob.consensusQ')}</Text>
      <View style={styles.modelRow}>
        <ModelChip name="OpenAI" tint="#1F8F7A" />
        <ModelChip name="Claude" tint="#C9743B" />
        <ModelChip name="Gemini" tint="#3D6FE0" />
      </View>
      <View style={styles.convergeLine} />
      <View style={styles.verdict}>
        <View style={styles.verdictTag}><Text style={styles.verdictTagText}>3 / 3</Text></View>
        <Text style={styles.verdictText} numberOfLines={1}>{t('ob.consensusFinding')}</Text>
        <Text style={styles.verdictPage}>{t('ob.demoPage')}</Text>
      </View>
    </View>
  );
}

/* ---------- Slayt 3: rapor ---------- */
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
        <Text style={styles.scoreNum}>60</Text>
        <Text style={styles.scoreMax}>/ 100</Text>
        <View style={styles.sameChip}><Text style={styles.sameChipText}>{t('ob.sameScore')}</Text></View>
      </View>
      <View style={styles.scoreTrackWrap}>
        <LinearGradient colors={REPORT_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.scoreTrack} />
        <View style={[styles.scoreMarker, { left: '60%' }]} />
      </View>
      <DemoRow label={t('ob.demoRow1')} />
      <DemoRow label={t('ob.demoRow2')} />
    </View>
  );
}

/* ---------- Slayt 4: belgenin üstünde boyama ---------- */
function ArtViewer() {
  return (
    <View style={styles.pageWrap}>
      <View style={styles.page}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={[styles.pageLine, { width: ['86%', '78%', '90%', '60%', '84%', '88%', '52%'][i] }, (i === 2 || i === 5) && styles.pageLineHot]}>
            {(i === 2 || i === 5) && <View style={[styles.band, { backgroundColor: i === 2 ? colors.riskHigh : colors.riskMid }]} />}
          </View>
        ))}
        <View style={styles.pin}><Text style={styles.pinText}>1</Text></View>
      </View>
      <View style={styles.findingPill}>
        <View style={[styles.pillDot, { backgroundColor: colors.riskHigh }]} />
        <Text style={styles.pillText} numberOfLines={1}>{t('ob.viewerPill')}</Text>
      </View>
    </View>
  );
}

/* ---------- Slayt 5: rapora soru sor ---------- */
function ArtChat() {
  return (
    <View style={styles.chatWrap}>
      <View style={styles.userBubble}><Text style={styles.userText}>{t('ob.chatQ')}</Text></View>
      <View style={styles.botBubble}>
        <Text style={styles.botText}>{t('ob.chatA')}</Text>
        <View style={styles.chatPage}><Text style={styles.chatPageText}>{t('ob.chatPage')} ›</Text></View>
      </View>
    </View>
  );
}

/* ---------- Slayt 6: iki sürümü karşılaştır ---------- */
function MiniPage({ hot }) {
  return (
    <View style={styles.miniPage}>
      <View style={styles.miniLine} />
      <View style={[styles.miniLine, hot && { backgroundColor: colors.gold }]} />
      <View style={[styles.miniLine, { width: 18 }]} />
    </View>
  );
}

function ArtDiff() {
  return (
    <View style={styles.panel}>
      <View style={styles.diffPages}>
        <MiniPage />
        <Text style={styles.diffArrow}>⇄</Text>
        <MiniPage hot />
      </View>
      <View style={styles.changeCard}>
        <View style={styles.changeHead}>
          <Text style={styles.changeKind}>{t('ob.diffKind')}</Text>
          <View style={styles.changeBadge}><Text style={styles.changeBadgeText}>{t('ob.diffImpact')}</Text></View>
        </View>
        <Text style={styles.changeTitle}>{t('ob.diffTitle')}</Text>
        <Text style={styles.changeNums}>42.500  →  47.000</Text>
      </View>
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
    case 'consensus': return <ArtConsensus />;
    case 'report': return <ArtReport />;
    case 'viewer': return <ArtViewer />;
    case 'chat': return <ArtChat />;
    case 'diff': return <ArtDiff />;
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
            <Text style={[styles.body, item.art === 'privacy' && styles.bodySmall]}>{t(item.bodyKey)}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity onPress={next} activeOpacity={0.85}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            <Text style={styles.ctaText}>{isLast ? t('ob.start') : t('ob.next')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  skip: { position: 'absolute', top: 60, right: 24, zIndex: 10 },
  skipText: { color: colors.textSoft, fontSize: 15 },
  slide: { width, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' },

  /* Görsel sahne */
  stage: { width: '100%', height: 240, marginBottom: 30, justifyContent: 'center', alignItems: 'center' },
  stageGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },

  /* Kalkan */
  emblemWrap: { width: 104, height: 104, borderRadius: 52, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' },

  /* Giriş kutucukları */
  tileRow: { flexDirection: 'row', gap: 12 },
  tile: { width: 92, height: 104, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center', gap: 10 },
  tileIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.cardSoft, justifyContent: 'center', alignItems: 'center' },
  tileLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },

  /* Panel kart */
  panel: { width: 284, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 14 },

  /* Üç model */
  panelQuestion: { color: colors.textSoft, fontSize: 12.5, fontStyle: 'italic', textAlign: 'center' },
  modelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  modelChip: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.line },
  modelDot: { width: 10, height: 10, borderRadius: 5 },
  modelName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  voteDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.riskLow },
  voteMark: { color: colors.bgDeep, fontSize: 11, fontWeight: '800' },
  convergeLine: { alignSelf: 'center', width: 2, height: 14, backgroundColor: colors.cyan, borderRadius: 1, opacity: 0.8 },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.cyan + '77', paddingHorizontal: 10, paddingVertical: 8 },
  verdictTag: { borderRadius: 8, backgroundColor: colors.riskLowBg, paddingHorizontal: 7, paddingVertical: 3 },
  verdictTagText: { color: colors.riskLow, fontFamily: fonts.mono, fontSize: 11, fontWeight: '700' },
  verdictText: { flex: 1, color: colors.text, fontSize: 12.5, fontWeight: '600' },
  verdictPage: { color: colors.cyan, fontFamily: fonts.mono, fontSize: 11 },

  /* Rapor */
  scoreLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  scoreNum: { color: colors.text, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  scoreMax: { color: colors.textSoft, fontSize: 15, fontFamily: fonts.mono },
  sameChip: { marginLeft: 'auto', borderRadius: 999, backgroundColor: colors.cardSoft, paddingHorizontal: 9, paddingVertical: 4 },
  sameChipText: { color: colors.textSoft, fontSize: 10.5, fontWeight: '700' },
  scoreTrackWrap: { justifyContent: 'center' },
  scoreTrack: { height: 12, borderRadius: 6 },
  scoreMarker: { position: 'absolute', width: 4, height: 20, borderRadius: 2, backgroundColor: colors.text, marginLeft: -2 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  demoBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },
  demoRowText: { flex: 1, color: colors.textSoft, fontSize: 13 },
  pageTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.line },
  pageTagText: { color: colors.cyan, fontSize: 11, fontFamily: fonts.mono },

  /* Görüntüleyici */
  pageWrap: { alignItems: 'center', gap: 12 },
  page: { width: 170, height: 190, borderRadius: 8, backgroundColor: '#F1F6FF', paddingTop: 22, paddingHorizontal: 16, gap: 11 },
  pageLine: { height: 6, borderRadius: 3, backgroundColor: '#C3CEE3', justifyContent: 'center' },
  pageLineHot: { backgroundColor: '#8E9BB8' },
  band: { position: 'absolute', left: -6, right: -6, top: -5, bottom: -5, borderRadius: 6, opacity: 0.4 },
  pin: { position: 'absolute', right: -10, top: 44, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  pinText: { color: colors.bgDeep, fontFamily: fonts.mono, fontSize: 12, fontWeight: '800' },
  findingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 280 },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { color: colors.text, fontSize: 12.5, fontWeight: '600' },

  /* Sohbet */
  chatWrap: { width: 290, gap: 10 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: colors.cardSoft, borderRadius: 16, borderBottomRightRadius: 4, paddingVertical: 9, paddingHorizontal: 13 },
  userText: { color: colors.text, fontSize: 13.5 },
  botBubble: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 13, borderLeftWidth: 3, borderLeftColor: colors.cyan, gap: 8 },
  botText: { color: colors.text, fontSize: 13.5, lineHeight: 19 },
  chatPage: { alignSelf: 'flex-start', borderRadius: 10, borderWidth: 1, borderColor: colors.cyan + '99', backgroundColor: colors.cardSoft, paddingHorizontal: 9, paddingVertical: 4 },
  chatPageText: { color: colors.cyan, fontFamily: fonts.mono, fontSize: 11.5, fontWeight: '700' },

  /* Karşılaştırma */
  diffPages: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  miniPage: { width: 44, height: 54, borderRadius: 5, backgroundColor: '#F1F6FF', paddingTop: 10, paddingLeft: 8, gap: 6 },
  miniLine: { width: 26, height: 4, borderRadius: 2, backgroundColor: '#B9C6E0' },
  diffArrow: { color: colors.gold, fontSize: 22, fontWeight: '800' },
  changeCard: { borderRadius: 12, backgroundColor: colors.bg, borderLeftWidth: 3, borderLeftColor: colors.riskHigh, padding: 12, gap: 4 },
  changeHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeKind: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.8 },
  changeBadge: { borderRadius: 8, backgroundColor: colors.riskHighBg, paddingHorizontal: 8, paddingVertical: 3 },
  changeBadgeText: { color: colors.riskHigh, fontFamily: fonts.mono, fontSize: 10.5, fontWeight: '700' },
  changeTitle: { color: colors.text, fontSize: 14, fontFamily: fonts.display },
  changeNums: { color: colors.gold, fontFamily: fonts.mono, fontSize: 13 },

  /* Metin */
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.text, textAlign: 'center', marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 23, color: colors.textSoft, textAlign: 'center' },
  bodySmall: { fontSize: 12.5, lineHeight: 18 },

  /* Alt bar */
  footer: { paddingHorizontal: 32, paddingBottom: 48 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.cyan, width: 20 },
  cta: { height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  ctaText: { color: colors.bgDeep, fontSize: 16, fontWeight: '700' },
});
