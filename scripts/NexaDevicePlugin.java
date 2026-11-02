package com.amadu.nexaai;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.provider.AlarmClock;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Small Android helper for NEXA AI: reads contacts, makes phone calls, sets alarms and
 * timers, controls the torch and volume, reads the battery, lists installed apps and opens
 * the phone's default Calculator / Alarms / Files / settings screens.
 * The build copies this file into the Android project (see scripts/patch-android.mjs).
 */
@CapacitorPlugin(
    name = "NexaDevice",
    permissions = {
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
        @Permission(alias = "call", strings = { Manifest.permission.CALL_PHONE }),
        @Permission(alias = "mic", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class NexaDevicePlugin extends Plugin {

    /* ---------------------------- contacts ---------------------------- */

    @PluginMethod
    public void getContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermissionResult");
            return;
        }
        loadContacts(call);
    }

    @PermissionCallback
    private void contactsPermissionResult(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            loadContacts(call);
        } else {
            call.reject("permission");
        }
    }

    private void loadContacts(PluginCall call) {
        JSArray list = new JSArray();
        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                null,
                null,
                null
            );
            if (cursor != null) {
                int nameCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                int numberCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                while (cursor.moveToNext()) {
                    String name = nameCol >= 0 ? cursor.getString(nameCol) : null;
                    String number = numberCol >= 0 ? cursor.getString(numberCol) : null;
                    if (name == null || number == null) {
                        continue;
                    }
                    JSObject item = new JSObject();
                    item.put("name", name);
                    item.put("number", number);
                    list.put(item);
                }
            }
        } catch (Exception e) {
            call.reject("contacts-failed");
            return;
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
        JSObject result = new JSObject();
        result.put("contacts", list);
        call.resolve(result);
    }

    /* ----------------------------- calling ----------------------------- */

    @PluginMethod
    public void callNumber(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.trim().isEmpty()) {
            call.reject("no-number");
            return;
        }
        if (getPermissionState("call") != PermissionState.GRANTED) {
            requestPermissionForAlias("call", call, "callPermissionResult");
            return;
        }
        startCall(call, number, true);
    }

    @PermissionCallback
    private void callPermissionResult(PluginCall call) {
        String number = call.getString("number");
        if (number == null || number.trim().isEmpty()) {
            call.reject("no-number");
            return;
        }
        // If the permission was refused, open the dialer instead (the user presses call).
        startCall(call, number, getPermissionState("call") == PermissionState.GRANTED);
    }

    private void startCall(PluginCall call, String number, boolean direct) {
        try {
            Intent intent = new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL);
            intent.setData(Uri.parse("tel:" + Uri.encode(number)));
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("mode", direct ? "call" : "dial");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("call-failed");
        }
    }

    /* --------------------------- alarm and timer --------------------------- */

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minutes = call.getInt("minutes");
        if (hour == null || minutes == null) {
            call.reject("bad-time");
            return;
        }
        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM);
            intent.putExtra(AlarmClock.EXTRA_HOUR, hour.intValue());
            intent.putExtra(AlarmClock.EXTRA_MINUTES, minutes.intValue());
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("alarm-failed");
        }
    }

    @PluginMethod
    public void setTimer(PluginCall call) {
        Integer seconds = call.getInt("seconds");
        if (seconds == null || seconds.intValue() <= 0) {
            call.reject("bad-time");
            return;
        }
        try {
            Intent intent = new Intent(AlarmClock.ACTION_SET_TIMER);
            intent.putExtra(AlarmClock.EXTRA_LENGTH, seconds.intValue());
            intent.putExtra(AlarmClock.EXTRA_SKIP_UI, true);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("timer-failed");
        }
    }

    /* ------------------------ torch, volume, battery ------------------------ */

    @PluginMethod
    public void setTorch(PluginCall call) {
        Boolean on = call.getBoolean("on", Boolean.TRUE);
        try {
            CameraManager manager = (CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            String cameraId = null;
            for (String id : manager.getCameraIdList()) {
                CameraCharacteristics info = manager.getCameraCharacteristics(id);
                Boolean hasFlash = info.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                Integer facing = info.get(CameraCharacteristics.LENS_FACING);
                if (Boolean.TRUE.equals(hasFlash)
                    && facing != null
                    && facing.intValue() == CameraCharacteristics.LENS_FACING_BACK) {
                    cameraId = id;
                    break;
                }
            }
            if (cameraId == null) {
                call.reject("no-torch");
                return;
            }
            manager.setTorchMode(cameraId, on.booleanValue());
            call.resolve();
        } catch (Exception e) {
            call.reject("torch-failed");
        }
    }

    @PluginMethod
    public void changeVolume(PluginCall call) {
        String action = call.getString("action");
        try {
            AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            int stream = AudioManager.STREAM_MUSIC;
            int max = audio.getStreamMaxVolume(stream);
            if ("up".equals(action)) {
                audio.adjustStreamVolume(stream, AudioManager.ADJUST_RAISE, AudioManager.FLAG_SHOW_UI);
            } else if ("down".equals(action)) {
                audio.adjustStreamVolume(stream, AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI);
            } else if ("max".equals(action)) {
                audio.setStreamVolume(stream, max, AudioManager.FLAG_SHOW_UI);
            } else if ("mute".equals(action)) {
                audio.setStreamVolume(stream, 0, AudioManager.FLAG_SHOW_UI);
            } else {
                call.reject("unknown");
                return;
            }
            JSObject result = new JSObject();
            result.put("level", audio.getStreamVolume(stream));
            result.put("max", max);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("volume-failed");
        }
    }

    @PluginMethod
    public void getBattery(PluginCall call) {
        try {
            Intent battery = getContext().registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            if (battery == null) {
                call.reject("no-battery");
                return;
            }
            int level = battery.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = battery.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            int status = battery.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            if (level < 0 || scale <= 0) {
                call.reject("no-battery");
                return;
            }
            boolean charging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL;
            JSObject result = new JSObject();
            result.put("percent", Math.round(level * 100f / scale));
            result.put("charging", charging);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("battery-failed");
        }
    }

    /* ------------------------ any installed app, by name ------------------------ */

    // Lists the apps that have a launcher icon: [{ label, packageName }].
    // (Android 11+ allows this because the manifest has a MAIN/LAUNCHER <queries> entry.)
    @PluginMethod
    public void listApps(PluginCall call) {
        JSArray list = new JSArray();
        try {
            PackageManager pm = getContext().getPackageManager();
            Intent main = new Intent(Intent.ACTION_MAIN, null);
            main.addCategory(Intent.CATEGORY_LAUNCHER);
            for (ResolveInfo info : pm.queryIntentActivities(main, 0)) {
                JSObject item = new JSObject();
                item.put("label", String.valueOf(info.loadLabel(pm)));
                item.put("packageName", info.activityInfo.packageName);
                list.put(item);
            }
        } catch (Exception e) {
            call.reject("apps-failed");
            return;
        }
        JSObject result = new JSObject();
        result.put("apps", list);
        call.resolve(result);
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || packageName.trim().isEmpty()) {
            call.reject("no-package");
            return;
        }
        try {
            Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (intent == null) {
                call.reject("not-installed");
                return;
            }
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("open-failed");
        }
    }

    /* ------------------ default system apps and settings screens ------------------ */

    @PluginMethod
    public void openSpecial(PluginCall call) {
        String kind = call.getString("kind");
        try {
            Intent intent;
            if ("alarms".equals(kind)) {
                intent = new Intent(AlarmClock.ACTION_SHOW_ALARMS);
            } else if ("calculator".equals(kind)) {
                intent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR);
            } else if ("files".equals(kind)) {
                intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
            } else if ("wifi".equals(kind)) {
                intent = new Intent(Settings.ACTION_WIFI_SETTINGS);
            } else if ("bluetooth".equals(kind)) {
                intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            } else if ("airplane".equals(kind)) {
                intent = new Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS);
            } else if ("location".equals(kind)) {
                intent = new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS);
            } else if ("mobiledata".equals(kind)) {
                intent = new Intent(Settings.ACTION_DATA_ROAMING_SETTINGS);
            } else if ("battery".equals(kind)) {
                intent = new Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS);
            } else if ("display".equals(kind)) {
                intent = new Intent(Settings.ACTION_DISPLAY_SETTINGS);
            } else if ("sound".equals(kind)) {
                intent = new Intent(Settings.ACTION_SOUND_SETTINGS);
            } else {
                call.reject("unknown");
                return;
            }
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("open-failed");
        }
    }

    /* ------------------------------ hands-free listening ------------------------------ */

    private boolean canDrawOverOtherApps() {
        return Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(getContext());
    }

    @PluginMethod
    public void handsFreeStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", NexaListenService.isRunning());
        result.put("overlay", canDrawOverOtherApps());
        call.resolve(result);
    }

    @PluginMethod
    public void startHandsFree(PluginCall call) {
        if (getPermissionState("mic") != PermissionState.GRANTED) {
            requestPermissionForAlias("mic", call, "micPermissionResult");
            return;
        }
        beginHandsFree(call);
    }

    @PermissionCallback
    private void micPermissionResult(PluginCall call) {
        if (getPermissionState("mic") == PermissionState.GRANTED) {
            beginHandsFree(call);
        } else {
            call.reject("mic-permission");
        }
    }

    private void beginHandsFree(PluginCall call) {
        if (!canDrawOverOtherApps()) {
            call.reject("overlay-permission");
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("no-recognizer");
            return;
        }
        try {
            NexaListenService.setAppVisible(true); // the user is looking at NEXA right now
            // Android 13+ shows the "NEXA AI is listening" notice only if this is allowed.
            if (Build.VERSION.SDK_INT >= 33
                && getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                getActivity().requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, 4712);
            }
            Intent service = new Intent(getContext(), NexaListenService.class);
            service.putExtra("language", call.getString("language", "en-NG"));
            service.putExtra("title", call.getString("title", "NEXA AI is listening"));
            service.putExtra("text", call.getString("text", "Say \"Nexa\" and a command"));
            service.putExtra("stop", call.getString("stop", "Stop"));
            if (Build.VERSION.SDK_INT >= 26) {
                getContext().startForegroundService(service);
            } else {
                getContext().startService(service);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("start-failed");
        }
    }

    // The page tells the service when NEXA is on screen (more reliable than activity events).
    @PluginMethod
    public void setAppVisible(PluginCall call) {
        NexaListenService.setAppVisible(Boolean.TRUE.equals(call.getBoolean("visible", true)));
        call.resolve();
    }

    @PluginMethod
    public void stopHandsFree(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), NexaListenService.class));
            call.resolve();
        } catch (Exception e) {
            call.reject("stop-failed");
        }
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("open-failed");
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            call.resolve();
        } catch (Exception e) {
            call.reject("open-failed");
        }
    }

    /* ------------- what the listening service tells the app, and the other way ------------- */

    // The service opens NEXA with the command it heard as an extra on the intent. Passed on
    // to the web page, which runs it like a typed message. Kept until the page is listening
    // (the app may have been fully closed).
    private void deliverCommand(Intent intent) {
        if (intent == null) {
            return;
        }
        String command = intent.getStringExtra(NexaListenService.EXTRA_COMMAND);
        if (command == null || command.trim().isEmpty()) {
            return;
        }
        intent.removeExtra(NexaListenService.EXTRA_COMMAND);
        JSObject data = new JSObject();
        data.put("text", command);
        notifyListeners("handsFreeCommand", data, true);
    }

    @Override
    public void load() {
        deliverCommand(getActivity().getIntent());
    }

    @Override
    public void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        deliverCommand(intent);
    }

    // While NEXA is on screen the app uses the microphone, so the service stays quiet.
    @Override
    public void handleOnResume() {
        super.handleOnResume();
        NexaListenService.setAppVisible(true);
    }

    @Override
    public void handleOnPause() {
        super.handleOnPause();
        NexaListenService.setAppVisible(false);
    }
}
