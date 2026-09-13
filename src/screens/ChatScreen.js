// Rapora soru sor. Sunucuda hiçbir şey tutulmaz: her soruda soru + rapor + sayfa metinleri gider, cevap gelir.
// Cevaplar sayfa rozetleriyle gelir; rozete dokununca görüntüleyici o sayfayı açar.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, fonts } from '../theme';
import { t, setActiveLocale, getDeviceLocale } from '../i18n';
import { askReportQuestion } from '../api/client';
import { checkIsPro } from '../api/purchases';
import { documentExists, loadPageTexts } from '../storage/documents';
import { getQuestionCount, incrementQuestionCount } from '../storage/history';
import { tick, thump } from '../feedback';

export const FREE_QUESTIONS_PER_REVIEW = 3;
const MAX_QUESTION_CHARS = 500;

export default function ChatScreen({ navigation, route }) {
  const { result, fileName, localUri, pagesUri } = route.params;
  // Sayaç anahtarı: geçmiş kaydının kimliği. Eski kayıtlarda yoksa dosya adı + skor + özetten türetilir ki
  // aynı rapor hangi yoldan açılsa açılsın aynı sayaca yazsın.
  const historyId = route.params.historyId
    || `legacy:${fileName}:${result.riskScore}:${(result.summary || '').length}`;
  const reportLang = result.language || route.params?.language || getDeviceLocale();
  setActiveLocale(reportLang);
  useFocusEffect(
    useCallback(() => {
      setActiveLocale(reportLang);
      return () => setActiveLocale(getDeviceLocale());
    }, [reportLang])
  );
  useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav.chat'), headerBackTitle: t('nav.back') });
  }, [navigation, reportLang]);

  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text, pages, grounded, error}
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState([]);
  const [canView, setCanView] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [used, setUsed] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadPageTexts(pagesUri).then((p) => { if (alive) setPages(p); });
    documentExists(localUri).then((ok) => { if (alive) setCanView(ok); });
    checkIsPro().then((ok) => { if (alive) setIsPro(Boolean(ok)); }).catch(() => {});
    getQuestionCount(historyId).then((n) => { if (alive) setUsed(n); });
    return () => { alive = false; };
  }, [pagesUri, localUri, historyId]);

  const remaining = isPro ? Infinity : Math.max(0, FREE_QUESTIONS_PER_REVIEW - used);
  const quotaOut = !isPro && remaining <= 0;

  // Başlangıç önerileri: raporun kendi "uzmana sorulacak sorular" listesi varsa ilk üçü, yoksa genel üçlü.
  const starters = (result.advisorQuestions || []).slice(0, 3);
  const starterList = starters.length ? starters : [t('chat.starter1'), t('chat.starter2'), t('chat.starter3')];

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: true }));

  const send = async (text) => {
    const question = (text || '').trim();
    if (!question || busy) return;
    if (quotaOut) { thump(); navigation.navigate('Paywall'); return; }
    thump();
    Keyboard.dismiss();
    setDraft('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    scrollToEnd();
    try {
      const res = await askReportQuestion({ question, language: reportLang, report: result, pages });
      const n = await incrementQuestionCount(historyId);
      setUsed(n);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, pages: res.pages, grounded: res.grounded }]);
      tick();
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', error: true, text: (e && e.message) || t('chat.failed') }]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  const openPage = (page) => {
    tick();
    navigation.navigate('DocumentViewer', { uri: localUri, result, fileName, initialPage: page });
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 92 : 0}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" onContentSizeChange={scrollToEnd}>
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        <Text style={styles.intro}>{pages.length ? t('chat.intro', { n: pages.length }) : t('chat.introNoPages')}</Text>

        {messages.length === 0 && (
          <View style={styles.starters}>
            {starterList.map((q, i) => (
              <Pressable key={i} onPress={() => send(q)} style={({ pressed }) => [styles.starter, pressed && { opacity: 0.8 }]}>
                <Text style={styles.starterText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <View key={i} style={styles.userBubble}><Text style={styles.userText}>{m.text}</Text></View>
          ) : (
            <View key={i} style={[styles.botBubble, m.error && styles.botError, m.grounded === false && !m.error && styles.botUnverified]}>
              <Text style={styles.botText}>{m.text}</Text>
              {!m.error && m.grounded === false ? <Text style={styles.unverified}>{t('chat.unverified')}</Text> : null}
              {!m.error && m.pages && m.pages.length ? (
                <View style={styles.pageRow}>
                  {m.pages.map((p) => (
                    canView ? (
                      <Pressable key={p} onPress={() => openPage(p)} style={({ pressed }) => [styles.pageChip, pressed && { opacity: 0.8 }]}>
                        <Text style={styles.pageChipText}>{t('viewer.pageAbbr')}{p} ›</Text>
                      </Pressable>
                    ) : (
                      <View key={p} style={[styles.pageChip, { borderColor: colors.line }]}>
                        <Text style={[styles.pageChipText, { color: colors.textSoft }]}>{t('viewer.pageAbbr')}{p}</Text>
                      </View>
                    )
                  ))}
                </View>
              ) : null}
            </View>
          )
        ))}

        {busy && (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.cyan} size="small" />
            <Text style={styles.thinkingText}>{t('chat.thinking')}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputBar}>
        <Text style={styles.quota}>
          {isPro ? t('chat.quotaPro') : t('chat.quota', { n: remaining })}
        </Text>
        {quotaOut ? (
          <Pressable onPress={() => { thump(); navigation.navigate('Paywall'); }} style={({ pressed }) => [styles.upgrade, pressed && { opacity: 0.85 }]}>
            <Text style={styles.upgradeText}>{t('chat.upgrade')}</Text>
          </Pressable>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(v) => setDraft(v.slice(0, MAX_QUESTION_CHARS))}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.textSoft}
              multiline
              editable={!busy}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => send(draft)}
            />
            <Pressable onPress={() => send(draft)} disabled={busy || !draft.trim()}
              style={({ pressed }) => [styles.sendBtn, (busy || !draft.trim()) && { opacity: 0.4 }, pressed && { opacity: 0.8 }]}>
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </View>
        )}
        <Text style={styles.disclaimer}>{t('chat.disclaimer')}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  fileName: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 11, textAlign: 'center' },
  intro: { color: colors.textSoft, fontSize: 12.5, lineHeight: 18, textAlign: 'center', marginTop: 6, marginBottom: 14, paddingHorizontal: 8 },
  starters: { gap: 8, marginBottom: 10 },
  starter: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14 },
  starterText: { color: colors.cyan, fontSize: 14, lineHeight: 20 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: colors.cardSoft, borderRadius: 16, borderBottomRightRadius: 4, paddingVertical: 9, paddingHorizontal: 13, marginTop: 10 },
  userText: { color: colors.text, fontSize: 14.5, lineHeight: 20 },
  botBubble: { alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: colors.card, borderRadius: 16, borderBottomLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 13, marginTop: 8, borderLeftWidth: 3, borderLeftColor: colors.cyan },
  botUnverified: { borderLeftColor: colors.riskMid },
  botError: { borderLeftColor: colors.riskHigh },
  botText: { color: colors.text, fontSize: 14.5, lineHeight: 21 },
  unverified: { color: colors.riskMid, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  pageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  pageChip: { borderRadius: 10, borderWidth: 1, borderColor: colors.cyan + '99', paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.cardSoft },
  pageChipText: { color: colors.cyan, fontFamily: fonts.mono, fontSize: 11.5, fontWeight: '700' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginLeft: 4 },
  thinkingText: { color: colors.textSoft, fontSize: 12.5, fontStyle: 'italic' },
  inputBar: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 22 : 12 },
  quota: { color: colors.textSoft, fontFamily: fonts.mono, fontSize: 10.5, marginBottom: 6, marginLeft: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 110, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 11, color: colors.text, fontSize: 14.5 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.bgDeep, fontSize: 20, fontWeight: '800', marginTop: -1 },
  upgrade: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.gold + 'AA', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  upgradeText: { color: colors.gold, fontSize: 14, fontWeight: '700' },
  disclaimer: { color: colors.textSoft, fontSize: 10.5, lineHeight: 14, marginTop: 8, marginLeft: 4, opacity: 0.85 },
});
