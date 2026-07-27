import { registerPlugin, Capacitor } from '@capacitor/core';

// Bridges NativeToolsPlugin.java (bank/UPI notification capture, native PDF
// export via PrintManager, and add-to-calendar). Every method is a no-op-safe
// wrapper on non-Android platforms so callers never need their own platform
// checks.
const NativeTools = registerPlugin('NativeTools');

function onAndroid() {
  return Capacitor.getPlatform() === 'android';
}

export async function isNotificationAccessEnabled() {
  if (!onAndroid()) return false;
  try {
    const res = await NativeTools.isNotificationAccessEnabled();
    return !!res?.enabled;
  } catch {
    return false;
  }
}

export async function openNotificationSettings() {
  if (!onAndroid()) return;
  await NativeTools.openNotificationSettings();
}

// Drains whatever bank/UPI/RCS notifications have been captured since the
// last call. Each item comes back exactly once (read-and-clear on the native
// side), so there's no separate high-water mark to track here.
export async function getCapturedNotifications() {
  if (!onAndroid()) return [];
  try {
    const res = await NativeTools.getCaptured();
    return res?.items ?? [];
  } catch {
    return [];
  }
}

// Loads `html` into a hidden WebView and hands it to Android's PrintManager —
// its "Save as PDF" virtual printer is backed by android.graphics.pdf.PdfDocument,
// so this yields a real PDF via the OS print dialog, not a JS library.
export async function printHtmlAsPdf(html, jobName = 'Budget Tracker report') {
  if (!onAndroid()) throw new Error('PDF export needs the Android app');
  await NativeTools.printHtml({ html, jobName });
}

export async function addToCalendar({ title, notes = '', at }) {
  if (!onAndroid()) throw new Error('Calendar needs the Android app');
  await NativeTools.addToCalendar({ title, notes, at });
}
