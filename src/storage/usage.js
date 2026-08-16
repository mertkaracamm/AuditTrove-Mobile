import AsyncStorage from '@react-native-async-storage/async-storage';

export const FREE_MONTHLY_LIMIT = 5;

function currentMonthKey() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `audittrove:usage:${d.getFullYear()}-${m}`;
}

export async function getMonthlyUsage() {
  try {
    const raw = await AsyncStorage.getItem(currentMonthKey());
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function incrementMonthlyUsage() {
  try {
    const used = await getMonthlyUsage();
    await AsyncStorage.setItem(currentMonthKey(), String(used + 1));
  } catch {}
}