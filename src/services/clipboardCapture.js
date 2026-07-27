import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';

// Reads whatever text is on the clipboard so the app can offer "add as a
// transaction" when it looks like a copied payment message. Android-only:
// the web Clipboard API needs a user gesture and would just reject silently
// on resume, so there's nothing useful to do on other platforms.
export async function readClipboardText() {
  if (Capacitor.getPlatform() !== 'android') return '';
  try {
    const { value } = await Clipboard.read();
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
