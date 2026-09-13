// Dokunsal ve sesli geri bildirim. İki modül de native; build'de yoksa sessizce atlanır, uygulama çalışır.
// Ses varsayılan olarak açık, Ayarlar'dan kapatılabilir; titreşim her zaman açık (cihaz sessizdeyse zaten yok).
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_KEY = 'audittrove:soundEnabled';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {}

let player = null;
let audioError = '';
try {
  const audio = require('expo-audio');
  // Kısa tık; her çalışta başa sarılır ki hızlı dokunuşlarda üst üste binmesin.
  player = audio.createAudioPlayer(require('../assets/tick.wav'));
  player.volume = 0.5;
  // Ses bitince oynatıcı sonda kalır ve bir sonraki "çal" boşa gider; bitince hemen başa alınır.
  player.addListener('playbackStatusUpdate', (st) => {
    if (st && st.didJustFinish) { try { player.seekTo(0); } catch (e) {} }
  });
} catch (e) {
  player = null;
  audioError = (e && e.message) || String(e);
}

/** Ayarlar'daki tanı satırı için: modüller bu build'de var mı. */
export function capabilities() {
  return { haptics: Boolean(Haptics), sound: Boolean(player), audioError };
}

let soundEnabled = true;
AsyncStorage.getItem(SOUND_KEY).then((raw) => { if (raw === '0') soundEnabled = false; }).catch(() => {});

export function isSoundEnabled() {
  return soundEnabled;
}

export async function setSoundEnabled(on) {
  soundEnabled = Boolean(on);
  try { await AsyncStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch (e) {}
}

// Başa sarma asenkron: bitmeden "çal" denirse ses çıkmaz. Sondaysa önce sarılır, sonra çalınır.
async function playTick() {
  if (!soundEnabled || !player) return;
  try {
    if (player.playing || player.currentTime > 0.003) await player.seekTo(0);
    player.play();
  } catch (e) {}
}

/** Hafif seçim tıkı: şerit, ok, sayfa çipi, sekme. */
export function tick() {
  try { if (Haptics) Haptics.selectionAsync(); } catch (e) {}
  playTick();
}

/** Daha belirgin dokunuş: kart açılışı, bulgu geçişi. */
export function thump() {
  try { if (Haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
  playTick();
}

/** Sistem seçicisi ya da kamera açılacaksa: önce tık, işlem biraz sonra. Aksi halde iOS ses oturumunu hemen alır, tık duyulmaz. */
export function thumpThen(fn) {
  thump();
  setTimeout(fn, soundEnabled && player ? 160 : 0);
}
