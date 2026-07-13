import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';

// Wraps the native biometric prompt for the app-lock feature. Falls back to
// device PIN/pattern/password (allowDeviceCredential) since not every phone
// has fingerprint/face enrolled — only devices with literally no lock method
// at all (deviceIsSecure: false) can't use this, and callers should treat
// that as "app lock unavailable" rather than blocking the user out forever.

export async function checkLockAvailable() {
  if (!Capacitor.isNativePlatform()) return { available: false, reason: 'Biometric lock is only available on a device' };
  try {
    const res = await BiometricAuth.checkBiometry();
    if (!res.isAvailable && !res.deviceIsSecure) {
      return { available: false, reason: 'Set a screen lock (PIN, pattern or biometric) on this device to use app lock' };
    }
    return { available: true };
  } catch (err) {
    return { available: false, reason: err?.message || 'Could not check device security' };
  }
}

export async function unlock() {
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Budget Tracker',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Unlock Budget Tracker',
    });
    return { success: true };
  } catch (err) {
    if (err?.code === BiometryErrorType.userCancel || err?.code === BiometryErrorType.systemCancel) {
      return { success: false, cancelled: true };
    }
    return { success: false, cancelled: false, message: err?.message || 'Authentication failed' };
  }
}
