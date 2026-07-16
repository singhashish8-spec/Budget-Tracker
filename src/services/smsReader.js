import { Capacitor } from '@capacitor/core';
import { SMSInboxReader, MessageType } from 'capacitor-sms-inbox';
import { parseSms, smsSignature, DEDUP_WINDOW_MS } from './smsParse';

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
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out — try again`)), SMS_TIMEOUT_MS)),
  ]);
}

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

// Collapses messages describing the same payment (same amount+type within the
// dedup window) down to one, keeping the earliest.
function dedupeParsed(items) {
  const sorted = [...items].sort((a, b) => a.date - b.date);
  const kept = [];
  for (const it of sorted) {
    const dup = kept.find(
      (k) => k.type === it.type && k.amount === it.amount && Math.abs(k.date - it.date) <= DEDUP_WINDOW_MS,
    );
    if (!dup) kept.push(it);
  }
  return kept;
}

// Reads SMS newer than `sinceMs` (exclusive), parses + dedupes, and returns
// candidate transactions plus the newest message timestamp seen (so the caller
// can persist a high-water mark and not re-import the same messages).
// `ignoreSet` is a Set of signatures the user chose to never import again.
export async function readNewTransactions(sinceMs = 0, ignoreSet = new Set()) {
  const { smsList } = await withTimeout(
    SMSInboxReader.getSMSList({
      filter: {
        type: MessageType.INBOX,
        minDate: sinceMs ? sinceMs + 1 : undefined,
        maxCount: 300,
      },
      projection: { id: true, address: true, date: true, body: true },
    }),
    'Reading messages',
  );

  let newest = sinceMs;
  const parsed = [];
  for (const sms of smsList || []) {
    if (sms.date > newest) newest = sms.date;
    if (ignoreSet.has(smsSignature(sms.body))) continue; // user muted this template
    const txn = parseSms(sms.body);
    // Keep the sender address (bank/UPI sender id) and full timestamp for
    // richer transaction detail.
    if (txn) parsed.push({ ...txn, date: sms.date, rawSms: sms.body, address: sms.address || '' });
  }

  return { transactions: dedupeParsed(parsed), newest };
}
