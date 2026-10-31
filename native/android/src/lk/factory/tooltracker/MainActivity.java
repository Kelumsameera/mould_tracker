package lk.factory.tooltracker;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.graphics.Color;
import android.net.Uri;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
  private static final String URL = "https://tools.192.168.0.116.sslip.io:8444/";
  private WebView web;
  private LinearLayout message;
  private TextView status;
  private boolean failed;
  private Updater updater;
  @Override public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    FrameLayout root = new FrameLayout(this);
    root.setBackgroundColor(Color.rgb(27, 43, 53));
    root.setOnApplyWindowInsetsListener((view, insets) -> {
      view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      return insets.consumeSystemWindowInsets();
    });
    web = new WebView(this);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setUserAgentString(settings.getUserAgentString() + " ToolTrackerNative/" + versionName());
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptCookie(true);
    CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
    root.addView(web, new FrameLayout.LayoutParams(-1, -1));
    message = new LinearLayout(this);
    message.setOrientation(LinearLayout.VERTICAL); message.setGravity(Gravity.CENTER);
    message.setPadding(48,48,48,48); message.setBackgroundColor(Color.rgb(27,43,53));
    status = new TextView(this); status.setTextColor(Color.WHITE); status.setTextSize(18); status.setGravity(Gravity.CENTER);
    message.addView(status);
    Button retry = new Button(this); retry.setText("Try again"); retry.setOnClickListener(view -> load()); message.addView(retry);
    root.addView(message, new FrameLayout.LayoutParams(-1,-1));
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        return !("https".equals(uri.getScheme()) && "tools.192.168.0.116.sslip.io".equals(uri.getHost()) && uri.getPort() == 8444);
      }
      @Override public void onPageFinished(WebView view, String url) {
        CookieManager.getInstance().flush();
        if (!failed) message.setVisibility(View.GONE);
      }
      @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) offline();
      }
      @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        handler.cancel(); offline();
      }
    });
    setContentView(root); load();
    updater = new Updater(this);
  }
  @Override public void onResume() { super.onResume(); updater.check(); }
  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (Updater.ACTION_STATUS.equals(intent.getAction())) updater.onStatus(intent);
  }
  private String versionName() {
    try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "unknown"; }
  }
  private void load() { failed = false; status.setText("Connecting to Mould Tracker…"); message.setVisibility(View.VISIBLE); web.loadUrl(URL); }
  private void offline() { failed = true; status.setText("Cannot connect to Mould Tracker.\n\nConnect to the factory Wi-Fi or LAN and check that the server is running. If the factory certificate has changed, ask the administrator for an updated app."); message.setVisibility(View.VISIBLE); }
  @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
  @Override public void onPause() { CookieManager.getInstance().flush(); super.onPause(); }
  @Override public void onDestroy() { web.destroy(); super.onDestroy(); }
}
