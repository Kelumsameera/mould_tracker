package lk.factory.tooltracker;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import org.json.JSONObject;

/** Checks the LAN download folder for a newer APK and installs it through the system installer. */
final class Updater {
  static final String ACTION_STATUS = "lk.factory.tooltracker.INSTALL_STATUS";
  private static final String FEED = "https://tools.192.168.0.116.sslip.io:8444/downloads/";
  private final Activity activity;
  private boolean busy;

  Updater(Activity activity) { this.activity = activity; }

  void check() {
    if (busy) return;
    busy = true;
    new Thread(() -> {
      try {
        JSONObject latest = new JSONObject(new String(get(FEED + "android-latest.json"), "UTF-8"));
        int code = latest.getInt("versionCode");
        String name = latest.getString("versionName"), file = latest.getString("file"), sha256 = latest.getString("sha256");
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        if (code <= info.versionCode || !file.matches("[\\w.-]+\\.apk") || !sha256.matches("[0-9a-fA-F]{64}")) { busy = false; return; }
        activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
          .setTitle("Mould Tracker update")
          .setMessage("Version " + name + " is available. You have " + info.versionName + ".")
          .setPositiveButton("Update", (d, w) -> install(file, sha256))
          .setNegativeButton("Later", (d, w) -> busy = false)
          .setOnCancelListener(d -> busy = false)
          .show());
      } catch (Exception offlineOrNoFeed) {
        busy = false;
      }
    }).start();
  }

  private void install(String file, String sha256) {
    if (!activity.getPackageManager().canRequestPackageInstalls()) {
      busy = false;
      Toast.makeText(activity, "Allow Mould Tracker to install updates, then come back.", Toast.LENGTH_LONG).show();
      activity.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())));
      return;
    }
    Toast.makeText(activity, "Downloading update…", Toast.LENGTH_SHORT).show();
    new Thread(() -> {
      try {
        byte[] apk = get(FEED + file);
        StringBuilder hex = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(apk)) hex.append(String.format("%02x", b));
        if (!hex.toString().equalsIgnoreCase(sha256)) throw new IllegalStateException("Downloaded update checksum does not match.");
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
          try (OutputStream out = session.openWrite("update.apk", 0, apk.length)) {
            out.write(apk);
            session.fsync(out);
          }
          Intent status = new Intent(activity, MainActivity.class).setAction(ACTION_STATUS);
          int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
          session.commit(PendingIntent.getActivity(activity, id, status, flags).getIntentSender());
        }
      } catch (Exception error) {
        activity.runOnUiThread(() -> Toast.makeText(activity, "Update failed: " + error.getMessage(), Toast.LENGTH_LONG).show());
      } finally {
        busy = false;
      }
    }).start();
  }

  /** Called from MainActivity.onNewIntent with the installer's result. */
  void onStatus(Intent intent) {
    int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
      if (confirm != null) activity.startActivity(confirm);
    } else if (status != PackageInstaller.STATUS_SUCCESS) {
      String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
      Toast.makeText(activity, "Update was not installed" + (message == null ? "." : ": " + message), Toast.LENGTH_LONG).show();
    }
  }

  private static byte[] get(String address) throws Exception {
    HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
    connection.setConnectTimeout(10000);
    connection.setReadTimeout(60000);
    connection.setUseCaches(false);
    try {
      if (connection.getResponseCode() != 200) throw new IllegalStateException("Server returned " + connection.getResponseCode());
      try (InputStream in = connection.getInputStream()) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        byte[] buffer = new byte[65536];
        for (int n; (n = in.read(buffer)) > 0; ) body.write(buffer, 0, n);
        return body.toByteArray();
      }
    } finally {
      connection.disconnect();
    }
  }
}
