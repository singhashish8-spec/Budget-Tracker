import { Capacitor, registerPlugin } from '@capacitor/core';

// Bridge to the small native plugin in AppIntegrationPlugin.java. Every call is
// wrapped so a missing implementation (the web build, or an older APK that
// predates the plugin) degrades to "nothing shared" rather than throwing.
const AppIntegration = registerPlugin('AppIntegration');

const native = () => Capacitor.isNativePlatform();

// Files handed to us by another app's share sheet — a PDF bill from Gmail, a
// photo from WhatsApp. Returns [{ name, mime, data }].
export async function consumePendingShare() {
  if (!native()) return [];
  try {
    const res = await AppIntegration.consumePendingShare();
    return Array.isArray(res?.files) ? res.files : [];
  } catch {
    return [];
  }
}

// Which launcher shortcut opened the app, if any: 'add' | 'warranty' | ''.
export async function consumeShortcut() {
  if (!native()) return '';
  try {
    const res = await AppIntegration.consumeShortcut();
    return res?.shortcut || '';
  } catch {
    return '';
  }
}

// Hide the app in the recents switcher and block screenshots. Tied to the
// hide-balances setting: showing every figure in the app switcher would defeat
// the point of turning it on.
export async function setSecureScreen(enabled) {
  if (!native()) return;
  try {
    await AppIntegration.setSecureScreen({ enabled: !!enabled });
  } catch {
    /* older APK without the plugin — the setting still hides amounts in-app */
  }
}
