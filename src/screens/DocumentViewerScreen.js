// Belge görüntüleyici: raporun bulgularını belgenin kendi sayfaları üstünde boyar.
// Backend her bulgu için {page, rects[]} verir; koordinatlar sayfa boyutuna oranlıdır (0..1, sol üst).
// Sayfa tek tek gösterilir (yatay kaydırma) ki boyama sayfanın çizildiği kutuya birebir otursun.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Easing, PanResponder, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts, getSeverityMap } from '../theme';
import { t, setActiveLocale, getDeviceLocale } from '../i18n';

let Pdf = null;
try {
  Pdf = require('react-native-pdf').default;
} catch (e) {}
import { tick, thump } from '../feedback';

const RECT_ALPHA = 0.32;
const STRIP_H = 64;

function rank(risk) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[risk && risk.severity] || 0;
}

// Dikey olarak %60'tan fazla çakışan ve yatayda kesişen kutular aynı bölgedir.
function overlaps(a, b) {
  const top = Math.max(a.y, b.y), bottom = Math.min(a.y + a.h, b.y + b.h);
  const v = bottom - top;
  if (v <= 0) return false;
  const horizontal = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0;
  return horizontal && v / Math.min(a.h, b.h) > 0.6;
}

function union(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

function severityColor(sev) {
  if (sev === 'HIGH' || sev === 'CRITICAL') return colors.riskHigh;
  if (sev === 'LOW') return colors.riskLow;
  return colors.riskMid;
}

function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

const HINT_KEY = 'audittrove:viewerHintDone';

// Tek şerit: fosforlu kalem gibi soldan sağa boyanır, seçiliyken nabız atar, sol ucunda bulgu numarası.
function HighlightBand({ frame, color, active, number, delay, onPress, counterRotate, badge }) {
  const paint = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    paint.setValue(0);
    Animated.timing(paint, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [frame.left, frame.top, frame.width, frame.height]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = paint.interpolate({ inputRange: [0, 1], outputRange: [0, frame.width] });
  const bg = active
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [withAlpha(color, RECT_ALPHA + 0.12), withAlpha(color, RECT_ALPHA + 0.34)] })
    : withAlpha(color, RECT_ALPHA);

  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
      <Animated.View style={{
        position: 'absolute', left: 0, top: 0, height: frame.height, width,
        backgroundColor: bg, borderRadius: 3,
        borderWidth: active ? 1.5 : 0, borderColor: color,
      }} />
      <Animated.View style={[styles.bandBadge, { backgroundColor: color, opacity: paint, left: badge.x, top: badge.y, transform: counterRotate ? [{ rotate: '-90deg' }] : [] }]}>
        <Text style={styles.bandBadgeText}>{number}</Text>
      </Animated.View>
    </Pressable>
  );
}

// İlk açılışlarda ilk şeridin üstünde zıplayan ipucu; ilk dokunuşta biter.
function TapHint({ x, y, counterRotate }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const transform = counterRotate ? [{ rotate: '-90deg' }, { translateY }] : [{ translateY }];
  return (
    <Animated.View pointerEvents="none" style={[styles.hint, { left: x, top: y, transform }]}>
      <Text style={styles.hintText}>{t('viewer.tapHint')}</Text>
      <View style={styles.hintArrow} />
    </Animated.View>
  );
}

export default function DocumentViewerScreen({ navigation, route }) {
  const { uri, result, fileName, initialPage, focusRisk } = route.params;
  const reportLang = result?.language || route.params?.language || getDeviceLocale();
  // İlk karede de rapor dilinde çizilsin; effect bir kare geç kalır ve başlık telefon dilinde görünürdü.
  setActiveLocale(reportLang);
  useEffect(() => {
    setActiveLocale(reportLang);
    return () => setActiveLocale(getDeviceLocale());
  }, [reportLang]);

  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [page, setPage] = useState(initialPage || 1);
  const [pageCount, setPageCount] = useState(result?.pageCount || 0);
  const [pageSize, setPageSize] = useState(null); // {width, height} PDF birimi
  const [selected, setSelected] = useState(typeof focusRisk === 'number' ? focusRisk : null);
  const sheetY = useRef(new Animated.Value(300)).current;
  const stripRef = useRef(null);
  // Yatay sayfa (sunum) dikey ekranda pul gibi kalır: kendiliğinden 90° çevrilir, düğmeyle geri alınır.
  const [rotated, setRotated] = useState(false);
  const rotateTouched = useRef(false);
  const zoomRef = useRef(1);
  const zoomScrollRef = useRef(null);
  const pageFade = useRef(new Animated.Value(1)).current;
  // İpucu: kullanıcı hayatında bir kez bir şeride dokunana kadar, kart kapalıyken hep görünür.
  const [hintDone, setHintDone] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(HINT_KEY).then((raw) => setHintDone(raw === '1')).catch(() => setHintDone(false));
  }, []);

  const risks = result?.risks || [];
  const severityMap = getSeverityMap();

  // Sayfa → o sayfada işaretli bulgular ({index, risk, rects})
  const byPage = useMemo(() => {
    const map = new Map();
    risks.forEach((risk, index) => {
      const anchors = Array.isArray(risk.anchors) && risk.anchors.length
        ? risk.anchors
        : (risk.pages || []).map((p) => ({ page: p, rects: [] }));
      for (const a of anchors) {
        if (!map.has(a.page)) map.set(a.page, []);
        map.get(a.page).push({ index, risk, rects: a.rects || [] });
      }
    });
    return map;
  }, [risks]);

  const markedPages = useMemo(() => [...byPage.keys()].sort((a, b) => a - b), [byPage]);

  // Aynı bölgeye düşen bulgular tek şerit: iki yarı saydam renk üst üste binince üçüncü bir renk çıkmasın.
  // Şeridin rengi en ağır bulgununki; dokununca kart açılır, kartta bölgedeki diğer bulgulara geçilir.
  const bandsFor = useCallback((items) => {
    const bands = [];
    for (const it of items) {
      for (const r of it.rects) {
        const hit = bands.find((b) => overlaps(b.rect, r));
        if (hit) {
          hit.rect = union(hit.rect, r);
          if (!hit.indices.includes(it.index)) hit.indices.push(it.index);
        } else {
          bands.push({ rect: { ...r }, indices: [it.index] });
        }
      }
    }
    for (const b of bands) b.indices.sort((a, c) => rank(risks[c]) - rank(risks[a]) || a - c);
    return bands;
  }, [risks]);

  // Görüntü alanı: üst bar ve alt şerit dışında kalan kutu. Sayfa bu kutuya sığdırılır; çevrilmişse
  // kutunun kenarları yer değiştirmiş sayılır. Boyama sayfa çerçevesine (stage) göre çizilir, çerçeveyle
  // birlikte döner ve büyür.
  const topBarH = insets.top + 48;
  const viewH = winH - topBarH - STRIP_H - insets.bottom;
  const viewW = winW;
  useEffect(() => {
    if (pageSize && !rotateTouched.current) setRotated(pageSize.width > pageSize.height && viewH > viewW);
  }, [pageSize, viewW, viewH]);
  const rendered = useMemo(() => {
    if (!pageSize || !pageSize.width || !pageSize.height) return null;
    const availW = rotated ? viewH : viewW, availH = rotated ? viewW : viewH;
    const s = Math.min(availW / pageSize.width, availH / pageSize.height);
    return { w: pageSize.width * s, h: pageSize.height * s };
  }, [pageSize, viewW, viewH, rotated]);

  const resetZoom = useCallback(() => {
    zoomRef.current = 1;
    try {
      const r = zoomScrollRef.current && zoomScrollRef.current.getScrollResponder && zoomScrollRef.current.getScrollResponder();
      if (r && r.scrollResponderZoomTo && rendered) r.scrollResponderZoomTo({ x: 0, y: 0, width: viewW, height: viewH, animated: false });
    } catch (e) {}
  }, [rendered, viewW, viewH]);

  // Sayfa geçişi: kısa bir kararma ile; yakınlaştırma sıfırlanır.
  const goToPage = useCallback((p) => {
    if (!p || p === page || (pageCount && (p < 1 || p > pageCount))) return;
    Animated.timing(pageFade, { toValue: 0.15, duration: 90, useNativeDriver: true }).start(() => {
      resetZoom();
      setPage(p);
      Animated.timing(pageFade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    });
  }, [page, pageCount, pageFade, resetZoom]);

  // Yakınlaştırılmamışken yatay kaydırma sayfa değiştirir (çevrilmiş sayfada dikey kaydırma).
  const pageRef = useRef(page); pageRef.current = page;
  const rotatedRef = useRef(rotated); rotatedRef.current = rotated;
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      if (zoomRef.current > 1.02) return false;
      const main = rotatedRef.current ? g.dy : g.dx, cross = rotatedRef.current ? g.dx : g.dy;
      return Math.abs(main) > 14 && Math.abs(main) > Math.abs(cross) * 1.6;
    },
    onPanResponderRelease: (_e, g) => {
      const main = rotatedRef.current ? g.dy : g.dx;
      const vel = rotatedRef.current ? g.vy : g.vx;
      if (main < -50 || vel < -0.6) goToPageRef.current(pageRef.current + 1);
      else if (main > 50 || vel > 0.6) goToPageRef.current(pageRef.current - 1);
    },
  })).current;
  const goToPageRef = useRef(goToPage); goToPageRef.current = goToPage;

  const openSheet = useCallback((index) => {
    setHintDone(true);
    AsyncStorage.setItem(HINT_KEY, '1').catch(() => {});
    thump();
    setSelected(index);
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  }, [sheetY]);
  const closeSheet = useCallback(() => {
    Animated.timing(sheetY, { toValue: 400, duration: 180, useNativeDriver: true }).start(() => setSelected(null));
  }, [sheetY]);

  // Kart aşağı kaydırılınca kapanır.
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => { if (g.dy > 0) sheetY.setValue(g.dy); },
    onPanResponderRelease: (_e, g) => {
      if (g.dy > 70 || g.vy > 0.8) closeSheet();
      else Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, bounciness: 2 }).start();
    },
  })).current;

  // Bulgudan bulguya gezinti: sayfası olan bulgular sırayla; sonrakine geçince sayfası açılır.
  const tourIndices = useMemo(() => risks.map((r, i) => ((r.pages || []).length ? i : -1)).filter((i) => i >= 0), [risks]);
  const goToFinding = useCallback((index) => {
    const risk = risks[index];
    if (!risk) return;
    const anchors = Array.isArray(risk.anchors) && risk.anchors.length ? risk.anchors : (risk.pages || []).map((p) => ({ page: p }));
    const target = anchors.find((a) => a.page === page) ? page : (anchors[0] && anchors[0].page);
    if (target && target !== page) goToPage(target);
    openSheet(index);
  }, [risks, page, openSheet, goToPage]);
  const stepFinding = useCallback((dir) => {
    if (selected === null || !tourIndices.length) return;
    const pos = tourIndices.indexOf(selected);
    const next = tourIndices[(pos + dir + tourIndices.length) % tourIndices.length];
    goToFinding(next);
  }, [selected, tourIndices, goToFinding]);

  useEffect(() => {
    if (typeof focusRisk === 'number') openSheet(focusRisk);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Şeritte aktif sayfa görünür kalsın.
  useEffect(() => {
    const i = markedPages.indexOf(page);
    if (i >= 0 && stripRef.current) stripRef.current.scrollTo({ x: Math.max(0, i * 56 - winW / 2 + 28), animated: true });
  }, [page, markedPages, winW]);

  const onPage = byPage.get(page) || [];
  useEffect(() => {
    if (selected !== null && !onPage.some((x) => x.index === selected)) closeSheet();
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  const showHint = !hintDone && selected === null;

  if (!Pdf) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.unavailable}>{t('viewer.unavailable')}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{t('viewer.backToReport')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top, height: topBarH }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.topBtn}>
          <Text style={styles.topBtnText}>‹ {t('viewer.backToReport')}</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{fileName}</Text>
        <Pressable onPress={() => { rotateTouched.current = true; tick(); setRotated((r) => !r); }} hitSlop={10} style={[styles.rotateBtn, rotated && styles.rotateBtnOn]}>
          <Text style={[styles.rotateBtnText, rotated && { color: colors.bgDeep }]}>⟳</Text>
        </Pressable>
        <Text style={styles.topPage}>{pageCount ? `${page} / ${pageCount}` : `${page}`}</Text>
      </View>

      <View style={{ width: viewW, height: viewH, backgroundColor: '#0B1533' }} {...swipe.panHandlers}>
        {/* Boyut öğrenilene kadar sayfa görünmez küçük bir örnek yüklenir; boyut gelince gerçek sahne kurulur. */}
        {!rendered && (
          <Pdf
            source={{ uri }}
            page={page}
            singlePage
            spacing={0}
            trustAllCerts={false}
            style={{ width: viewW, height: viewH, opacity: 0 }}
            onLoadComplete={(n, _path, size) => {
              setPageCount(n);
              if (size && size.width) setPageSize({ width: size.width, height: size.height });
            }}
            onError={() => {}}
          />
        )}
        {rendered && (
        <Animated.ScrollView
          ref={zoomScrollRef}
          style={{ width: viewW, height: viewH, opacity: pageFade }}
          contentContainerStyle={{ width: viewW, height: viewH, alignItems: 'center', justifyContent: 'center' }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          pinchGestureEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => { zoomRef.current = e.nativeEvent.zoomScale || 1; }}
        >
          {/* Sahne: sayfa çerçevesi. Döndürme ve yakınlaştırma sahneye uygulanır, boyama içinde taşınır. */}
          <View style={{ width: rendered.w, height: rendered.h, transform: rotated ? [{ rotate: '90deg' }] : [] }}>
            <Pdf
              source={{ uri }}
              page={page}
              singlePage
              spacing={0}
              fitPolicy={2}
              scale={1}
              minScale={1}
              maxScale={1}
              trustAllCerts={false}
              style={{ width: rendered.w, height: rendered.h, backgroundColor: '#FFFFFF' }}
              onLoadComplete={(n) => setPageCount(n)}
              onError={() => {}}
            />
            {/* Kalkan: dokunuşlar PDF'in kendi kaydırıcısına gitmesin; boş yere dokunmak kartı kapatır.
                Not: Pdf'in varsayılan spacing'i (10pt) sayfayı aşağı kaydırıp bantları bir satır yukarıda bırakıyordu; spacing 0. */}
            <Pressable onPress={() => { if (selected !== null) closeSheet(); }} style={StyleSheet.absoluteFill} />
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {onPage.filter((x) => !x.rects.length).map(({ index, risk }, slot) => {
              // Satır eşleşmedi: sayfa kenarında numaralı rozet, dokununca kart açılır.
              const color = severityColor(risk.severity);
              return (
                <Pressable
                  key={`edge-${index}`}
                  onPress={() => openSheet(index)}
                  style={[styles.edgeMark, {
                    backgroundColor: color,
                    right: 4,
                    top: 12 + slot * 34,
                    borderColor: selected === index ? colors.text : 'transparent',
                  }]}
                >
                  <Text style={[styles.edgeMarkText, rotated && { transform: [{ rotate: '-90deg' }] }]}>{index + 1}</Text>
                </Pressable>
              );
            })}
            {(() => {
              const bands = bandsFor(onPage).sort((a, b) => a.rect.y - b.rect.y);
              const first = bands[0];
              // Numara rozetleri metnin üstüne değil sol kenar boşluğuna oturur; alt alta gelen şeritlerde
              // rozetler çakışmasın diye her biri bir öncekinin altına itilir (sayfa koordinatında).
              const BADGE = 22;
              const frames = bands.map((band) => {
                const r = band.rect;
                return { left: r.x * rendered.w - 2, top: r.y * rendered.h - 2, width: r.w * rendered.w + 4, height: r.h * rendered.h + 4 };
              });
              let lastBottom = -Infinity;
              const badges = frames.map((f) => {
                const x = Math.max(2, f.left - BADGE - 4);
                let y = f.top + Math.max(0, f.height / 2 - BADGE / 2);
                if (y < lastBottom + 3) y = lastBottom + 3;
                lastBottom = y + BADGE;
                return { x: x - f.left, y: y - f.top };
              });
              return (
                <>
                  {bands.map((band, k) => {
                    const lead = band.indices[0];
                    const color = severityColor(risks[lead].severity);
                    const active = selected !== null && band.indices.includes(selected);
                    const frame = frames[k];
                    return (
                      <HighlightBand
                        badge={badges[k]}
                        key={`band-${page}-${k}`}
                        frame={frame}
                        color={color}
                        active={active}
                        number={band.indices.length > 1 ? band.indices.map((i) => i + 1).join('·') : lead + 1}
                        delay={120 + k * 90}
                        counterRotate={rotated}
                        onPress={() => openSheet(active && band.indices.length > 1
                          ? band.indices[(band.indices.indexOf(selected) + 1) % band.indices.length]
                          : lead)}
                      />
                    );
                  })}
                  {showHint && first && (
                    <TapHint
                      x={Math.min(rendered.w - 190, Math.max(4, first.rect.x * rendered.w + 24))}
                      y={Math.max(4, first.rect.y * rendered.h - 46)}
                      counterRotate={rotated}
                    />
                  )}
                </>
              );
            })()}
            </View>
          </View>
        </Animated.ScrollView>
        )}
      </View>

      {/* Sayfa şeridi: yalnızca bulgulu sayfalar, önem rengiyle; dokununca o sayfaya gider. */}
      <View style={[styles.strip, { height: STRIP_H + insets.bottom, paddingBottom: insets.bottom }]}>
        <ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripContent}>
          {markedPages.length === 0 ? (
            <Text style={styles.stripEmpty}>{t('viewer.noMarks')}</Text>
          ) : markedPages.map((p) => {
            const items = byPage.get(p) || [];
            const top = items.reduce((best, x) => {
              const rank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[x.risk.severity] || 0;
              return rank > best.rank ? { rank, sev: x.risk.severity } : best;
            }, { rank: 0, sev: 'MEDIUM' });
            const isActive = p === page;
            return (
              <Pressable key={p} onPress={() => { tick(); goToPage(p); }} style={[styles.pageChip, isActive && styles.pageChipActive]}>
                <Text style={[styles.pageChipText, isActive && { color: colors.text }]}>
                  <Text style={styles.pageChipPrefix}>{t('viewer.pageAbbr')}</Text>{p}
                </Text>
                <View style={styles.dotRow}>
                  {items.slice(0, 4).map((x, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: severityColor(x.risk.severity) }]} />
                  ))}
                </View>
                <View style={[styles.chipBar, { backgroundColor: severityColor(top.sev) }]} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Bulgu kartı */}
      {selected !== null && risks[selected] && (
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: sheetY }] }]} {...pan.panHandlers}>
          <View style={styles.sheetHandleWrap}><View style={styles.sheetHandle} /></View>
          <Pressable onPress={closeSheet} hitSlop={12} style={styles.sheetClose}>
            <Text style={styles.sheetCloseText}>✕</Text>
          </Pressable>
          {(() => {
            const risk = risks[selected];
            const sev = severityMap[risk.severity === 'CRITICAL' ? 'HIGH' : risk.severity] || severityMap.MEDIUM;
            const pos = tourIndices.indexOf(selected);
            return (
              <>
                <View style={styles.sheetHead}>
                  <View style={styles.tourRow}>
                    <Pressable onPress={() => stepFinding(-1)} hitSlop={10} style={styles.tourBtn}><Text style={styles.tourBtnText}>‹</Text></Pressable>
                    <Text style={styles.sheetIndex}>{t('viewer.findingOf', { n: pos >= 0 ? pos + 1 : selected + 1, total: tourIndices.length || risks.length })}</Text>
                    <Pressable onPress={() => stepFinding(1)} hitSlop={10} style={styles.tourBtn}><Text style={styles.tourBtnText}>›</Text></Pressable>
                  </View>
                  <View style={[styles.sevBadge, { backgroundColor: sev.bg }]}>
                    <Text style={[styles.sevText, { color: sev.color }]}>{risk.badge || sev.label}</Text>
                  </View>
                </View>
                <Text style={styles.sheetTitle}>{risk.title}</Text>
                {(() => {
                  const band = bandsFor(onPage).find((b) => b.indices.includes(selected));
                  if (!band || band.indices.length < 2) return null;
                  return (
                    <View style={styles.siblingRow}>
                      <Text style={styles.siblingLabel}>{t('viewer.sameArea')}</Text>
                      {band.indices.map((i) => (
                        <Pressable key={i} onPress={() => openSheet(i)} style={[styles.siblingChip, i === selected && styles.siblingChipActive, { borderColor: severityColor(risks[i].severity) }]}>
                          <Text style={[styles.siblingText, i === selected && { color: colors.text }]}>{i + 1}</Text>
                        </Pressable>
                      ))}
                    </View>
                  );
                })()}
                {risk.evidence ? <Text style={styles.sheetEvidence} numberOfLines={5}>{risk.evidence}</Text> : null}
                {risk.source === 'model' ? <Text style={styles.extraTag}>{t('res.extraNote')}</Text> : null}
                <Pressable onPress={() => navigation.goBack()} style={styles.sheetBtn}>
                  <Text style={styles.sheetBtnText}>{t('viewer.backToReport')}</Text>
                </Pressable>
              </>
            );
          })()}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  unavailable: { color: colors.textSoft, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  backBtnText: { color: colors.cyan, fontWeight: '600' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  topBtn: { paddingVertical: 8, paddingRight: 4 },
  topBtnText: { color: colors.cyan, fontSize: 15, fontWeight: '600' },
  topTitle: { flex: 1, color: colors.textSoft, fontFamily: fonts.mono, fontSize: 12 },
  topPage: { color: colors.text, fontFamily: fonts.mono, fontSize: 13 },
  rotateBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  rotateBtnOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  rotateBtnText: { color: colors.textSoft, fontSize: 17, lineHeight: 19 },
  edgeMark: {
    position: 'absolute', width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  edgeMarkText: { color: colors.bgDeep, fontSize: 11, fontWeight: '800' },
  zoomHint: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'rgba(5,15,51,0.85)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  zoomHintText: { color: colors.textSoft, fontSize: 11.5 },
  strip: { backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line },
  stripContent: { paddingHorizontal: 12, alignItems: 'center', gap: 8 },
  stripEmpty: { color: colors.textSoft, fontSize: 12.5 },
  pageChip: {
    width: 48, height: 46, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  pageChipActive: { borderColor: colors.cyan, backgroundColor: colors.cardSoft },
  pageChipText: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 13, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  chipBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
  bandBadge: {
    position: 'absolute', minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  bandBadgeText: { color: colors.bgDeep, fontSize: 10.5, fontWeight: '800', fontFamily: fonts.mono },
  hint: {
    position: 'absolute', backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.cyan, maxWidth: 180,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  hintText: { color: colors.text, fontSize: 12.5, fontWeight: '600' },
  hintArrow: {
    position: 'absolute', bottom: -7, left: 18, width: 12, height: 12, backgroundColor: colors.bg,
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.cyan, transform: [{ rotate: '45deg' }],
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card,
    borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.line,
    paddingHorizontal: 18, paddingTop: 6,
  },
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 8 },
  sheetClose: { position: 'absolute', right: 14, top: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: colors.textSoft, fontSize: 14, fontWeight: '700' },
  tourRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tourBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center' },
  tourBtnText: { color: colors.cyan, fontSize: 20, lineHeight: 22, fontWeight: '700' },
  pageChipPrefix: { fontSize: 9, color: colors.textSoft },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 40 },
  sheetIndex: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSoft },
  sevBadge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  sevText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.text, lineHeight: 23, marginBottom: 8 },
  siblingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  siblingLabel: { color: colors.textSoft, fontSize: 11.5, marginRight: 4 },
  siblingChip: { width: 28, height: 24, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  siblingChipActive: { backgroundColor: colors.cardSoft },
  siblingText: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 12, fontWeight: '700' },
  sheetEvidence: { fontSize: 13, lineHeight: 19, color: colors.textSoft, fontStyle: 'italic' },
  extraTag: { fontSize: 11, color: colors.textSoft, marginTop: 6, letterSpacing: 0.4 },
  sheetBtn: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 8 },
  sheetBtnText: { color: colors.cyan, fontWeight: '600', fontSize: 14.5 },
});
