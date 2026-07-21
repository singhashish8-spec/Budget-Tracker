import { Capacitor } from '@capacitor/core';
import { SMSInboxReader, MessageType } from 'capacitor-sms-inbox';
import { parseSms, smsSignature, looksLikeMoney, dedupeParsed } from './smsParse';

// Reads real inbox SMS (Android only) and turns bank/UPI transaction alerts
// into transactions, de-duplicating the common case where one payment
// generates two texts (UPI app + bank). READ_SMS is a sensitive permission —
// requested at use time, and this whole path is Android-native only.

export function smsAvailable() {
  return Capacitor.getPlatform() === 'android';
}

// Any native call here can hang if the plugin/OS misbehaves (the reported
// "froze the whole app" bug). Race every native call against a timeout so a
// hang surfaces as a catchable error instead of an await that never resolves.
const SMS_TIMEOUT_MS = 12000;
// A deep scan walks the whole inbox rather than just what's new, so it needs a
// far longer leash than the routine incremental read.
const DEEP_TIMEOUT_MS = 90000;
function withTimeout(promise, label, ms = SMS_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out — try again`)), ms)),
  ]);
}

// How many messages a read pulls back. The incremental scan only needs recent
// ones; a deep scan deliberately reaches far back to recover anything missed.
const NORMAL_MAX_COUNT = 300;
const DEEP_MAX_COUNT = 5000;

export async function ensureSmsPermission() {
  const status = await withTimeout(SMSInboxReader.checkPermissions(), 'SMS permission check');
  if (status.sms === 'granted') return true;
  const req = await withTimeout(SMSInboxReader.requestPermissions(), 'SMS permission request');
  return req.sms === 'granted';
}

// Non-interactive permission check (for silent auto-sync): returns whether we
// already have permission, without ever prompting.
export async function hasSmsPermission() {
  try {
    const status = await withTimeout(SMSInboxReader.checkPermissions(), 'SMS permission check');
    return status.sms === 'granted';
  } catch {
    return false;
  }
}

// Reads the inbox, parses + dedupes, and returns candidate transactions plus
// the newest message timestamp seen (so the caller can persist a high-water
// mark and not re-read the same messages every time).
//
// `deep` ignores the high-water mark and re-reads the WHOLE inbox. That matters
// because the incremental read only ever looks forward: a message passed over
// once — an unrecognised salary credit, say — could never be seen again, even
// by a manual scan. A deep scan is how anything missed gets recovered.
//
// `ignoreSet` is a Set of signatures the user chose to never import again.
// Anything mentioning money that we could NOT interpret comes back in
// `unmatched` rather than vanishing, so the user can see and correct it.
export async function readNewTransactions(sinceMs = 0, ignoreSet = new Set(), { deep = false } = {}) {
  const { smsList } = await withTimeout(
    SMSInboxReader.getSMSList({
      filter: {
        type: MessageType.INBOX,
        minDate: deep || !sinceMs ? undefined : sinceMs + 1,
        maxCount: deep ? DEEP_MAX_COUNT : NORMAL_MAX_COUNT,
      },
      projection: { id: true, address: true, date: true, body: true },
    }),
    'Reading messages',
    deep ? DEEP_TIMEOUT_MS : SMS_TIMEOUT_MS,
  );

  let newest = sinceMs;
  const parsed = [];
  const unmatched = [];
  for (const sms of smsList || []) {
    if (sms.date > newest) newest = sms.date;
    if (ignoreSet.has(smsSignature(sms.body))) continue; // user muted this template
    const txn = parseSms(sms.body);
    // Keep the sender address (bank/UPI sender id) and full timestamp for
    // richer transaction detail.
    if (txn) {
      parsed.push({ ...txn, date: sms.date, rawSms: sms.body, address: sms.address || '' });
    } else if (looksLikeMoney(sms.body)) {
      unmatched.push({ rawSms: sms.body, address: sms.address || '', date: sms.date });
    }
  }

  return { transactions: dedupeParsed(parsed), newest, unmatched };
}
