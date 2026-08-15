import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'audittrove:history';

export async function getHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addToHistory(entry) {
  const history = await getHistory();
  const item = {
    id: String(Date.now()),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const next = [item, ...history].slice(0, 50); // en fazla 50 kayıt tut
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return item;
}

export async function clearHistory() {
  await AsyncStorage.removeItem(KEY);
}
