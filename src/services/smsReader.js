import { Capacitor } from '@capacitor/core';
import { SMSInboxReader, MessageType } from 'capacitor-sms-inbox';
import { parseSms, DEDUP_WINDOW_MS } from './smsParse';

// Reads real inbox SMS (Android only) and turns bank/UPI transaction alerts
// into transactions, de-duplicating the common case where one payment
// generates two texts (UPI app + bank). READ_SMS is a sensitive permission —
// requested at use time, and this whole path is Android-native only.

export function smsAvailable() {
  return Capacitor.getPlatform() === 'android';
}

export async function ensureSmsPermission() {
  const status = await SMSInboxReader.checkPermissions();
  if (status.sms === 'granted') return true;
  const req = await SMSInboxReader.requestPermissions();
  return req.sms === 'granted';
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
export async function readNewTransactions(sinceMs = 0) {
  const { smsList } = await SMSInboxReader.getSMSList({
    filter: {
      type: MessageType.INBOX,
      minDate: sinceMs ? sinceMs + 1 : undefined,
      maxCount: 300,
    },
    projection: { id: true, address: true, date: true, body: true },
  });

  let newest = sinceMs;
  const parsed = [];
  for (const sms of smsList || []) {
    if (sms.date > newest) newest = sms.date;
    const txn = parseSms(sms.body);
    if (txn) parsed.push({ ...txn, date: sms.date, rawSms: sms.body });
  }

  return { transactions: dedupeParsed(parsed), newest };
}
