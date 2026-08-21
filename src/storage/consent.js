import AsyncStorage from '@react-native-async-storage/async-storage';

// Kullanicinin belge iceriginin analiz icin ucuncu tarafa (OpenAI) gonderilmesine
// bir kez onay verdigini saklar. Onay verilene kadar hicbir belge gonderilmez.
const CONSENT_KEY = 'audittrove:ai-consent:v1';

export async function hasAiConsent() {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export async function setAiConsent() {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, 'true');
  } catch {}
}