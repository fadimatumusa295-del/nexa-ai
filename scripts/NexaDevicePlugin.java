package com.amadu.nexaai;

import android.Manifest;
import android.app.DownloadManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.ContactsContract;

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
 * timers, and opens the phone's default Calculator / Alarms / Files apps.
 * The build copies this file into the Android project (see scripts/patch-android.mjs).
 */
@CapacitorPlugin(
    name = "NexaDevice",
    permissions = {
        @Permission(alias = "contacts", strings = { Manifest.permission.READ_CONTACTS }),
        @Permission(alias = "call", strings = { Manifest.permission.CALL_PHONE })
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

    /* ------------------------ default system apps ------------------------ */

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
}
