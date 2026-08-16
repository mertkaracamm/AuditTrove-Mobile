// revenuecat katmani. expo go'da native modul yok, o yuzden
// dev build alana kadar PURCHASES_ENABLED false kalacak
export const PURCHASES_ENABLED = true;

const APPLE_API_KEY = 'appl_yvGCYwJYtFEoPllbCdwtpdaJZRf';

export const ENTITLEMENT_ID = 'pro';

import { getOrCreateDeviceId } from './device';

let Purchases = null;
if (PURCHASES_ENABLED) {
  // expo go'da import edilirse cokuyor, require sart
  Purchases = require('react-native-purchases').default;
}

export async function initPurchases() {
  if (!PURCHASES_ENABLED) return;
  // ayni deviceId backend'de de kullaniliyor, rc bunu appUserID yapinca
  // sunucu tarafinda pro sorgusu atabiliyoruz
  const deviceId = await getOrCreateDeviceId();
  await Purchases.configure({ apiKey: APPLE_API_KEY, appUserID: deviceId });
}

export async function checkIsPro() {
  if (!PURCHASES_ENABLED) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

export async function getPaywallPackages() {
  if (!PURCHASES_ENABLED) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchasePackage(pkg) {
  if (!PURCHASES_ENABLED) return { isPro: false, cancelled: false };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return {
      isPro: Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]),
      cancelled: false,
    };
  } catch (e) {
    if (e?.userCancelled) return { isPro: false, cancelled: true };
    throw e;
  }
}

export async function restorePurchases() {
  if (!PURCHASES_ENABLED) return false;
  const info = await Purchases.restorePurchases();
  return Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
}