package com.amadu.nexaai;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.widget.Toast;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;

/**
 * Hands-free listening for NEXA AI.
 *
 * Runs as a foreground service (Android requires the visible "NEXA AI is listening"
 * notification) and listens again and again with the phone's own speech recogniser. When it
 * hears "Nexa, <command>" it opens NEXA with that command. While NEXA itself is on screen the
 * service stays quiet, because the app uses the microphone then.
 *
 * Started and stopped from NexaDevicePlugin (startHandsFree / stopHandsFree).
 */
public class NexaListenService extends Service {

    public static final String ACTION_STOP = "nexa.action.STOP_LISTENING";
    public static final String EXTRA_COMMAND = "nexa_command";

    private static final String CHANNEL_ID = "nexa_hands_free";
    private static final int NOTIFICATION_ID = 4711;
    // After a lone "Nexa" the next thing said counts as the command, for this long.
    private static final long WAIT_FOR_COMMAND_MS = 7000;

    private static volatile boolean appVisible = false;
    private static volatile NexaListenService instance;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private boolean listening = false;
    private boolean stopped = false;
    private long awaitingCommandUntil = 0;
    private String language = "en-NG";

    /* ------------------------------ used by the plugin ------------------------------ */

    public static boolean isRunning() {
        return instance != null;
    }

    /** NEXA tells the service when it is on screen, so the two never fight for the microphone. */
    public static void setAppVisible(boolean visible) {
        appVisible = visible;
        final NexaListenService service = instance;
        if (visible && service != null) {
            service.handler.post(new Runnable() {
                @Override
                public void run() {
                    service.releaseRecognizer(); // give the microphone to the app completely
                    service.scheduleNext(1000);
                }
            });
        }
    }

    /* ------------------------------ service life ------------------------------ */

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String requested = intent == null ? null : intent.getStringExtra("language");
        if (requested != null && !requested.isEmpty()) {
            language = requested;
        }
        String title = textExtra(intent, "title", "NEXA AI is listening");
        String text = textExtra(intent, "text", "Say \"Nexa\" and a command");
        String stop = textExtra(intent, "stop", "Stop");

        try {
            Notification notification = buildNotification(title, text, stop);
            if (Build.VERSION.SDK_INT >= 30) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }

        instance = this;
        stopped = false;
        // (Re)start from the beginning so a new language takes effect.
        releaseRecognizer();
        scheduleNext(400);
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        stopped = true;
        handler.removeCallbacksAndMessages(null);
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception e) {
                /* already gone */
            }
            recognizer = null;
        }
        stopForeground(true);
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }

    private static String textExtra(Intent intent, String name, String fallback) {
        String value = intent == null ? null : intent.getStringExtra(name);
        return value == null || value.isEmpty() ? fallback : value;
    }

    /* ------------------------------ notification ------------------------------ */

    private Notification buildNotification(String title, String text, String stopLabel) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= 26) {
            if (manager != null) {
                manager.createNotificationChannel(
                    new NotificationChannel(CHANNEL_ID, "NEXA AI hands-free", NotificationManager.IMPORTANCE_LOW)
                );
            }
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        Intent open = new Intent(this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openPending = PendingIntent.getActivity(this, 0, open, flags);

        Intent stop = new Intent(this, NexaListenService.class);
        stop.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(this, 1, stop, flags);

        builder
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setContentIntent(openPending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, stopLabel, stopPending);
        return builder.build();
    }

    /* ------------------------------ listening loop ------------------------------ */

    private final Runnable listenRunnable = new Runnable() {
        @Override
        public void run() {
            startListening();
        }
    };

    private void scheduleNext(long delayMs) {
        handler.removeCallbacks(listenRunnable);
        if (!stopped) {
            handler.postDelayed(listenRunnable, delayMs);
        }
    }

    private void startListening() {
        if (stopped || listening) {
            return;
        }
        if (appVisible) {
            // NEXA is on screen and uses the microphone itself: check again in a moment.
            releaseRecognizer();
            scheduleNext(1000);
            return;
        }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(listener);
        }
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        try {
            listening = true;
            recognizer.startListening(intent);
        } catch (Exception e) {
            listening = false;
            scheduleNext(1500);
        }
    }

    // Fully lets go of the speech recogniser (the phone allows only one at a time).
    private void releaseRecognizer() {
        listening = false;
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception e) {
                /* already gone */
            }
            recognizer = null;
        }
    }

    private void cancelListening() {
        if (recognizer != null && listening) {
            try {
                recognizer.cancel();
            } catch (Exception e) {
                /* nothing to cancel */
            }
        }
        listening = false;
    }

    private final RecognitionListener listener = new RecognitionListener() {
        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onPartialResults(Bundle partialResults) {}

        @Override
        public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onError(int error) {
            listening = false;
            if (stopped) {
                return;
            }
            if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                stopSelf(); // the microphone permission was taken away
                return;
            }
            // Silence ("no match" / "timeout") is normal: just listen again.
            scheduleNext(error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 2000 : 700);
        }

        @Override
        public void onResults(Bundle results) {
            listening = false;
            if (stopped) {
                return;
            }
            if (results != null) {
                handleResults(results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION));
            }
            scheduleNext(System.currentTimeMillis() < awaitingCommandUntil ? 100 : 500);
        }
    };

    /* ------------------------------ what was heard ------------------------------ */

    private void handleResults(ArrayList<String> heard) {
        if (heard == null || heard.isEmpty()) {
            return;
        }
        boolean heardWakeWord = false;
        for (String phrase : heard) {
            String command = NexaWake.extractCommand(phrase);
            if (command == null) {
                continue;
            }
            if (!command.isEmpty()) {
                awaitingCommandUntil = 0;
                dispatch(command);
                return;
            }
            heardWakeWord = true;
        }
        if (heardWakeWord) {
            // Only "Nexa" so far: the next thing said is the command.
            awaitingCommandUntil = System.currentTimeMillis() + WAIT_FOR_COMMAND_MS;
            beep();
            toast("NEXA: listening… say your command");
            return;
        }
        if (System.currentTimeMillis() < awaitingCommandUntil) {
            awaitingCommandUntil = 0;
            String command = heard.get(0) == null ? "" : heard.get(0).trim();
            if (!command.isEmpty()) {
                dispatch(command);
            }
        }
    }

    // Opens NEXA with the command. Android only allows this while NEXA is closed if the
    // "Display over other apps" permission is on (the app checks that before starting).
    private void dispatch(String command) {
        toast("NEXA heard: " + command);
        offerCommand(command);
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        intent.putExtra(EXTRA_COMMAND, command);
        try {
            startActivity(intent);
        } catch (Exception e) {
            /* blocked by Android: nothing more can be done from here */
        }
    }

    private void toast(final String message) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                try {
                    Toast.makeText(NexaListenService.this, message, Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    /* no toast: not important */
                }
            }
        });
    }

    // Backup in case Android refuses to open NEXA from the background: a notification that
    // opens NEXA with the command when tapped (and pops up full-screen where Android allows).
    private void offerCommand(String command) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) {
                return;
            }
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(
                    new NotificationChannel("nexa_command", "NEXA AI commands", NotificationManager.IMPORTANCE_HIGH)
                );
                builder = new Notification.Builder(this, "nexa_command");
            } else {
                builder = new Notification.Builder(this);
            }
            Intent open = new Intent(this, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            open.putExtra(EXTRA_COMMAND, command);
            PendingIntent pending = PendingIntent.getActivity(
                this, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            builder
                .setContentTitle("NEXA AI")
                .setContentText("Tap to run: " + command)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setAutoCancel(true)
                .setContentIntent(pending)
                .setFullScreenIntent(pending, true);
            manager.notify(NOTIFICATION_ID + 1, builder.build());
        } catch (Exception e) {
            /* no backup notification */
        }
    }

    // A short tone so you know NEXA heard its name.
    private void beep() {
        try {
            final ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80);
            tone.startTone(ToneGenerator.TONE_PROP_ACK, 200);
            handler.postDelayed(
                new Runnable() {
                    @Override
                    public void run() {
                        tone.release();
                    }
                },
                400
            );
        } catch (Exception e) {
            /* no sound: the command is still waited for */
        }
    }
}
