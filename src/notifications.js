// ============================================================
// Yerel bildirim sarmalayicisi (expo-notifications).
// Native modul; Expo Go'da kismi calisir. require guard ile
// modul yoksa sessizce no-op olur (uygulama cokmesin).
// ============================================================

import { t } from './i18n';

let Notifications = null;
let NOTIFS_ENABLED = false;
try {
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
  NOTIFS_ENABLED = true;
} catch (e) {
  NOTIFS_ENABLED = false;
}

export { NOTIFS_ENABLED };

// Uygulama on plandayken de bildirim gorunsun
if (NOTIFS_ENABLED && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

let permissionAsked = false;

export async function ensureNotificationPermission() {
  if (!NOTIFS_ENABLED) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (permissionAsked && !current.canAskAgain) return false;
    permissionAsked = true;
    const req = await Notifications.requestPermissionsAsync();
    return !!req.granted;
  } catch (e) {
    return false;
  }
}

export async function notifyReviewReady(fileName) {
  if (!NOTIFS_ENABLED) return;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notif.readyTitle'),
        body: fileName ? t('notif.readyBodyNamed').replace('{name}', fileName) : t('notif.readyBody'),
      },
      trigger: null, // hemen
    });
  } catch (e) {
    // sessiz
  }
}

/**
 * Bildirim izni alir ve cihazin Expo push token'ini doner (backend'e kaydedilir).
 * Push, uygulama kapali/arka planda olsa da bildirim gelmesini saglar.
 */
export async function registerForPush() {
  if (!NOTIFS_ENABLED) return null;
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return null;

    // Android bildirim kanali (iOS'ta etkisiz)
    if (Notifications.setNotificationChannelAsync) {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance:
            (Notifications.AndroidImportance && Notifications.AndroidImportance.DEFAULT) || 3,
        });
      } catch (e) {}
    }

    let projectId;
    try {
      // eslint-disable-next-line global-require
      const Constants = require('expo-constants').default;
      projectId =
        (Constants.expoConfig &&
          Constants.expoConfig.extra &&
          Constants.expoConfig.extra.eas &&
          Constants.expoConfig.extra.eas.projectId) ||
        (Constants.easConfig && Constants.easConfig.projectId);
    } catch (e) {}

    const res = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return (res && res.data) || null;
  } catch (e) {
    return null;
  }
}