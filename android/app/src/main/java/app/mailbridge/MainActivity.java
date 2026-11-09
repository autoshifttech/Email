package app.mailbridge;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * MailBridge for Android: a lightweight native shell around the MailBridge web
 * dashboard (the same glass UI, installable without the Play Store).
 */
public class MainActivity extends Activity {
    private static final String PREFS = "mailbridge";
    private static final String KEY_URL = "server_url";
    private static final int FILE_CHOOSER = 42;
    private static final int BRAND = Color.parseColor("#4B33EA");
    private static final int BRAND_DEEP = Color.parseColor("#2F1FB8");

    private FrameLayout root;
    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private String serverUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        root = new FrameLayout(this);
        root.setBackgroundColor(BRAND_DEEP);
        setContentView(root);

        serverUrl = prefs().getString(KEY_URL, BuildConfig.DEFAULT_URL);
        if (handleSetupLink(getIntent())) return;
        if (isEmpty(serverUrl)) showSetup(null);
        else showWeb(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSetupLink(intent);
    }

    /** mailbridge://setup?url=https://… from the website's download page. */
    private boolean handleSetupLink(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !"mailbridge".equals(data.getScheme())) return false;
        String url = normalize(data.getQueryParameter("url"));
        if (url == null) return false;
        saveUrl(url);
        Toast.makeText(this, "Connected to " + Uri.parse(url).getHost(), Toast.LENGTH_SHORT).show();
        showWeb(null);
        return true;
    }

    // ───────────────────────── Web view ─────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private void showWeb(Bundle state) {
        root.removeAllViews();
        web = new WebView(this);
        web.setBackgroundColor(BRAND_DEEP);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setUserAgentString(s.getUserAgentString() + " MailBridgeApp/" + BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                Uri home = Uri.parse(serverUrl);
                if (uri.getHost() != null && uri.getHost().equalsIgnoreCase(home.getHost())) return false;
                openExternal(uri);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError(String.valueOf(error.getDescription()));
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p < 100 ? View.VISIBLE : View.GONE);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, length) -> openExternal(Uri.parse(url)));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(progress, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP));

        if (state != null) web.restoreState(state);
        else web.loadUrl(serverUrl);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.getParent() != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app can open this link", Toast.LENGTH_SHORT).show();
        }
    }

    // ───────────────────────── Native screens ─────────────────────────

    private void showSetup(String message) {
        root.removeAllViews();
        web = null;
        LinearLayout box = column();

        box.addView(title("MailBridge"));
        box.addView(text("Your inbox, summarized on WhatsApp.\nEnter the address of your MailBridge website to connect.", 15, 0xCCFFFFFF));
        if (message != null) box.addView(text(message, 14, Color.parseColor("#FFD0DA")));

        EditText input = new EditText(this);
        input.setHint("https://your-app.vercel.app");
        input.setText(isEmpty(serverUrl) ? "https://" : serverUrl);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setTextColor(Color.WHITE);
        input.setHintTextColor(0x88FFFFFF);
        input.setPadding(dp(16), dp(14), dp(16), dp(14));
        input.setBackground(pill(0x26FFFFFF, 0x66FFFFFF, 16));
        box.addView(input, spaced(dp(20)));

        Button connect = primaryButton("Connect");
        Runnable go = () -> {
            String url = normalize(input.getText().toString());
            if (url == null) {
                input.setError("Enter a valid https:// address");
                return;
            }
            saveUrl(url);
            showWeb(null);
        };
        connect.setOnClickListener(v -> go.run());
        input.setOnEditorActionListener((v, actionId, e) -> { go.run(); return true; });
        box.addView(connect, spaced(dp(14)));

        box.addView(text("Tip: on the MailBridge website, open “Get the app” and tap “Or tap here after installing” to connect automatically.", 12, 0x99FFFFFF), spaced(dp(22)));
        root.addView(box, centered());
    }

    private void showError(String detail) {
        root.removeAllViews();
        web = null;
        LinearLayout box = column();
        box.addView(title("Can't reach MailBridge"));
        box.addView(text("Check your internet connection.\n" + Uri.parse(serverUrl).getHost() + "\n(" + detail + ")", 14, 0xCCFFFFFF));
        Button retry = primaryButton("Retry");
        retry.setOnClickListener(v -> showWeb(null));
        box.addView(retry, spaced(dp(22)));
        Button change = ghostButton("Change server");
        change.setOnClickListener(v -> showSetup(null));
        box.addView(change, spaced(dp(10)));
        root.addView(box, centered());
    }

    // ───────────────────────── helpers ─────────────────────────

    private SharedPreferences prefs() { return getSharedPreferences(PREFS, MODE_PRIVATE); }

    private void saveUrl(String url) {
        serverUrl = url;
        prefs().edit().putString(KEY_URL, url).apply();
    }

    private static boolean isEmpty(String s) { return s == null || s.trim().isEmpty(); }

    /** Accepts "my-app.vercel.app" or a full URL; returns https://host[/path] without a trailing slash. */
    static String normalize(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        if (s.isEmpty() || s.equals("https://")) return null;
        if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
        Uri u = Uri.parse(s);
        if (u.getHost() == null || !u.getHost().contains(".") && !u.getHost().equals("localhost")) return null;
        while (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s;
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private LinearLayout column() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(24), dp(28), dp(24), dp(28));
        box.setBackground(pill(0x29FFFFFF, 0x55FFFFFF, 28));
        return box;
    }

    private FrameLayout.LayoutParams centered() {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        lp.setMargins(dp(20), dp(20), dp(20), dp(20));
        root.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[]{Color.parseColor("#6A4DFF"), BRAND, BRAND_DEEP}));
        return lp;
    }

    private LinearLayout.LayoutParams spaced(int top) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = top;
        return lp;
    }

    private TextView title(String t) {
        TextView v = text(t, 30, Color.WHITE);
        v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setPadding(0, 0, 0, dp(8));
        return v;
    }

    private TextView text(String t, int sp, int color) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setLineSpacing(0, 1.2f);
        return v;
    }

    private Button primaryButton(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.parseColor("#2B1FB0"));
        b.setBackground(pill(Color.WHITE, Color.WHITE, 999));
        return b;
    }

    private Button ghostButton(String label) {
        Button b = primaryButton(label);
        b.setTextColor(Color.WHITE);
        b.setBackground(pill(0x26FFFFFF, 0x66FFFFFF, 999));
        return b;
    }

    private GradientDrawable pill(int fill, int stroke, int radiusDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setStroke(dp(1), stroke);
        d.setCornerRadius(dp(Math.min(radiusDp, 60)));
        return d;
    }
}
