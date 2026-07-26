package com.budgettracker.app;

import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * The small amount of Android the web layer can't reach on its own.
 *
 *  • consumePendingShare() — files handed to us by another app's share sheet.
 *    A bill normally arrives as a PDF in Gmail or a photo in WhatsApp, and
 *    without this there is no route from there into a warranty record.
 *
 *  • consumeShortcut() — which launcher shortcut opened the app, so a long-press
 *    on the icon can land straight on "Add spend".
 *
 *  • setSecureScreen() — hides the app in the recents switcher and blocks
 *    screenshots while hide-balances is on. A finance app showing its numbers
 *    in the app switcher defeats the point of that setting.
 *
 * Files are returned as data URLs. They are small (a bill, a warranty card) and
 * the app already stores documents that way, so this avoids inventing a second
 * path for the same thing.
 */
@CapacitorPlugin(name = "AppIntegration")
public class AppIntegrationPlugin extends Plugin {

    /** Anything bigger than this isn't a bill — refuse rather than stall the app. */
    private static final long MAX_BYTES = 8L * 1024 * 1024;

    @PluginMethod
    public void consumePendingShare(PluginCall call) {
        JSObject ret = new JSObject();
        JSONArray files = new JSONArray();

        Intent intent = getActivity().getIntent();
        if (intent != null) {
            String action = intent.getAction();
            if (Intent.ACTION_SEND.equals(action)) {
                Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                JSObject f = readUri(uri);
                if (f != null) files.put(f);
            } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
                java.util.ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (uris != null) {
                    for (Uri u : uris) {
                        JSObject f = readUri(u);
                        if (f != null) files.put(f);
                    }
                }
            } else if (intent.getClipData() != null && Intent.ACTION_VIEW.equals(action)) {
                ClipData clip = intent.getClipData();
                for (int i = 0; i < clip.getItemCount(); i++) {
                    JSObject f = readUri(clip.getItemAt(i).getUri());
                    if (f != null) files.put(f);
                }
            }
            // Clear it so returning to the app later doesn't re-import the same
            // file every time the activity resumes.
            if (files.length() > 0) {
                intent.setAction(Intent.ACTION_MAIN);
                intent.removeExtra(Intent.EXTRA_STREAM);
            }
        }

        ret.put("files", files);
        call.resolve(ret);
    }

    @PluginMethod
    public void consumeShortcut(PluginCall call) {
        JSObject ret = new JSObject();
        Intent intent = getActivity().getIntent();
        String which = null;
        if (intent != null) {
            which = intent.getStringExtra("shortcut");
            if (which != null) intent.removeExtra("shortcut");
        }
        ret.put("shortcut", which == null ? "" : which);
        call.resolve(ret);
    }

    @PluginMethod
    public void setSecureScreen(final PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        getActivity().runOnUiThread(() -> {
            try {
                if (on) {
                    getActivity().getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    );
                } else {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not change the secure-screen flag", e);
            }
        });
    }

    /** Reads a shared file into { name, mime, data } with data as a data: URL. */
    private JSObject readUri(Uri uri) {
        if (uri == null) return null;
        try {
            String mime = getContext().getContentResolver().getType(uri);
            if (mime == null) mime = "application/octet-stream";

            String name = "Shared file";
            try (Cursor c = getContext().getContentResolver()
                    .query(uri, null, null, null, null)) {
                if (c != null && c.moveToFirst()) {
                    int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (idx >= 0 && !c.isNull(idx)) name = c.getString(idx);
                    int sizeIdx = c.getColumnIndex(OpenableColumns.SIZE);
                    if (sizeIdx >= 0 && !c.isNull(sizeIdx) && c.getLong(sizeIdx) > MAX_BYTES) return null;
                }
            }

            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) return null;
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                long total = 0;
                while ((n = in.read(buf)) != -1) {
                    total += n;
                    if (total > MAX_BYTES) return null;
                    out.write(buf, 0, n);
                }
                String b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                JSObject f = new JSObject();
                f.put("name", name);
                f.put("mime", mime);
                f.put("data", "data:" + mime + ";base64," + b64);
                return f;
            }
        } catch (Exception e) {
            return null;
        }
    }
}
