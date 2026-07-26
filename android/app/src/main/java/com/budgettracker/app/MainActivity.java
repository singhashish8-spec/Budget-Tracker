package com.budgettracker.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppIntegrationPlugin.class);
        super.onCreate(savedInstanceState);
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
