package com.budgettracker.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.CalendarContract;
import android.provider.Settings;
import android.text.TextUtils;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

// Groups three small, independent native features behind one plugin rather
// than three, since each is a handful of methods with no shared state:
//   - reading bank/UPI notifications captured by BankNotificationListenerService
//     (the RCS backlog item — RCS has no public read API, so this is the only
//     route, and it catches bank-app/UPI-app notifications as a bonus)
//   - a real PDF export via Android's native PrintManager (which is backed by
//     PdfDocument internally) instead of a JS PDF library
//   - handing a reminder off to the user's calendar app via an implicit intent
@CapacitorPlugin(name = "NativeTools")
public class NativeToolsPlugin extends Plugin {

    @PluginMethod
    public void isNotificationAccessEnabled(PluginCall call) {
        String pkg = getContext().getPackageName();
        String enabled = Settings.Secure.getString(getContext().getContentResolver(), "enabled_notification_listeners");
        boolean granted = !TextUtils.isEmpty(enabled) && enabled.contains(pkg);
        JSObject ret = new JSObject();
        ret.put("enabled", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Couldn't open notification access settings", e);
        }
    }

    // Drains the capture queue BankNotificationListenerService has been
    // writing to — each item is returned exactly once (read-and-clear), so the
    // JS side treats them like a one-shot inbox rather than needing its own
    // high-water mark.
    @PluginMethod
    public void getCaptured(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME, android.content.Context.MODE_PRIVATE);
        synchronized (BankNotificationListenerService.class) {
            try {
                JSONArray arr = new JSONArray(prefs.getString(BankNotificationListenerService.KEY_ITEMS, "[]"));
                prefs.edit().putString(BankNotificationListenerService.KEY_ITEMS, "[]").apply();
                JSArray out = new JSArray();
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject src = arr.getJSONObject(i);
                    JSObject item = new JSObject();
                    item.put("package", src.optString("package", ""));
                    item.put("title", src.optString("title", ""));
                    item.put("text", src.optString("text", ""));
                    item.put("postedAt", src.optLong("postedAt", 0));
                    out.put(item);
                }
                JSObject ret = new JSObject();
                ret.put("items", out);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Couldn't read captured notifications", e);
            }
        }
    }

    // Loads the given HTML into a hidden WebView and hands it to Android's
    // print framework — the same PrintManager any app uses, whose default
    // "Save as PDF" virtual printer is backed by android.graphics.pdf.PdfDocument.
    // This gives a real PDF (and the system print dialog) without a JS PDF library.
    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("jobName", "Budget Tracker report");
        if (html == null || html.isEmpty()) {
            call.reject("No HTML provided");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No active window to print from");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                WebView printWebView = new WebView(activity);
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintManager printManager = (PrintManager) activity.getSystemService(Activity.PRINT_SERVICE);
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("Couldn't start the print job", e);
                        }
                    }
                });
                printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception e) {
                call.reject("Couldn't prepare the report for printing", e);
            }
        });
    }

    // Hands a reminder off to whatever calendar app is installed, prefilled,
    // via an implicit ACTION_INSERT intent — no calendar permission needed
    // because we're not touching the provider directly, just delegating to it.
    @PluginMethod
    public void addToCalendar(PluginCall call) {
        String title = call.getString("title", "Budget Tracker reminder");
        String notes = call.getString("notes", "");
        Long at = call.getLong("at");
        if (at == null) {
            call.reject("No date provided");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_INSERT)
                    .setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, at)
                    .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, at + 60L * 60L * 1000L)
                    .putExtra(CalendarContract.Events.TITLE, title)
                    .putExtra(CalendarContract.Events.DESCRIPTION, notes)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No calendar app available", e);
        }
    }
}
