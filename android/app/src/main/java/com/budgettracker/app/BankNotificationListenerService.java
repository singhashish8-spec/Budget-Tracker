package com.budgettracker.app;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.regex.Pattern;

// Bank/UPI apps and RCS (Google Messages, which never surfaces in
// content://sms) both post a normal Android notification for a payment alert.
// This listener is the only way to see that text — there is no public API for
// third-party RCS access. It writes matching notifications to SharedPreferences
// (this service can be started by the system independently of the app's own
// process being alive) as a small capped queue; NativeToolsPlugin.getCaptured()
// drains it on the JS side, which re-uses the existing SMS-parsing pipeline.
public class BankNotificationListenerService extends NotificationListenerService {

    static final String PREFS_NAME = "bt_notification_capture";
    static final String KEY_ITEMS = "items";
    private static final int MAX_ITEMS = 300;

    // Heuristic only — final parsing/validation happens in JS (smsParse.js).
    // This just avoids queuing every unrelated notification (chat apps, games).
    private static final Pattern MONEY_HINT = Pattern.compile(
            "(₹|Rs\\.?\\s?\\d|INR\\s?\\d|\\bcredited\\b|\\bdebited\\b|\\bspent\\b|\\bpaid\\b|\\breceived\\b|\\bUPI\\b|\\bA/c\\b|\\bavl bal\\b)",
            Pattern.CASE_INSENSITIVE);

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        try {
            if (sbn == null || sbn.getPackageName() == null) return;
            if (sbn.getPackageName().equals(getPackageName())) return; // ignore our own notifications
            Notification n = sbn.getNotification();
            if (n == null || n.extras == null) return;
            Bundle extras = n.extras;
            String title = String.valueOf(extras.get(Notification.EXTRA_TITLE));
            CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);
            String body = bigText != null ? bigText.toString() : (text != null ? text.toString() : "");
            if (body.isEmpty()) return;
            if (!MONEY_HINT.matcher(title + " " + body).find()) return;

            JSONObject item = new JSONObject();
            item.put("package", sbn.getPackageName());
            item.put("title", title == null ? "" : title);
            item.put("text", body);
            item.put("postedAt", sbn.getPostTime());
            appendItem(item);
        } catch (Exception e) {
            Log.w("BankNotifListener", "Failed to capture notification", e);
        }
    }

    private void appendItem(JSONObject item) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        synchronized (BankNotificationListenerService.class) {
            try {
                JSONArray arr = new JSONArray(prefs.getString(KEY_ITEMS, "[]"));
                arr.put(item);
                // Cap the queue so a runaway inbox can't grow SharedPreferences forever.
                while (arr.length() > MAX_ITEMS) {
                    JSONArray trimmed = new JSONArray();
                    for (int i = 1; i < arr.length(); i++) trimmed.put(arr.get(i));
                    arr = trimmed;
                }
                prefs.edit().putString(KEY_ITEMS, arr.toString()).apply();
            } catch (Exception e) {
                Log.w("BankNotifListener", "Failed to persist capture", e);
            }
        }
    }
}
