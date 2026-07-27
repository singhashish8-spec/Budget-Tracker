package com.budgettracker.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.google.android.material.color.DynamicColors;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppIntegrationPlugin.class);
        registerPlugin(NativeToolsPlugin.class);
        super.onCreate(savedInstanceState);
        // Material You: tint the app's colours from the user's wallpaper on
        // Android 12+. A no-op on older versions or devices without it.
        DynamicColors.applyToActivityIfAvailable(this);
    }

    /**
     * The activity is singleTask, so a share arriving while the app is already
     * running is delivered here rather than through onCreate. Without this the
     * new intent is dropped and the shared bill silently never appears.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
