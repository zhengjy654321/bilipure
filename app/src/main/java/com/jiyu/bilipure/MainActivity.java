package com.jiyu.bilipure;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.Toast;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String HOME = "https://www.bilibili.com/";
    private static final String KEY = "orange-classroom-v1";
    private static final int PICK_JSON = 30, EXPORT_JSON = 31, LIMIT = 8 * 1024 * 1024;
    private static final Set<String> ORIGINS = new HashSet<>(Arrays.asList("https://www.bilibili.com", "https://m.bilibili.com"));
    private static final Set<String> API_PATHS = new HashSet<>(Arrays.asList("/x/web-interface/view", "/x/web-interface/nav", "/x/space/wbi/arc/search"));
    private WebView web;
    private FrameLayout container;
    private LinearLayout toolbar;
    private Button loadingCover;
    private long navigation;
    private String levelGesture;
    private double initialLevel;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private SharedPreferences preferences;
    private final ExecutorService network = Executors.newFixedThreadPool(3);
    private ValueCallback<Uri[]> fileCallback;
    private JavaScriptReplyProxy exportReply;
    private String exportId, exportText;
    private String injection, userAgent;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        preferences = getSharedPreferences("classroom", MODE_PRIVATE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        LinearLayout layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        toolbar = new LinearLayout(this); toolbar.setBackgroundColor(Color.rgb(248,249,241));
        addButton("‹ 返回", () -> goBack());
        addButton("🍋 主页", () -> {coverHome();web.loadUrl(HOME);});
        addButton("刷新", () -> {coverHome();web.reload();});
        addButton("备份进度", () -> exportBackup());
        layout.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(44)));
        container = new FrameLayout(this);
        layout.addView(container, new LinearLayout.LayoutParams(-1, 0, 1));
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(layout, (v,insets)->{
            Insets safe=insets.getInsetsIgnoringVisibility(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout());
            Insets keyboard=insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(safe.left,safe.top,safe.right,Math.max(safe.bottom,keyboard.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(layout);
        ViewCompat.requestApplyInsets(layout);
        web = new WebView(this); container.addView(web, new FrameLayout.LayoutParams(-1,-1));
        loadingCover = new Button(this);
        loadingCover.setBackgroundColor(Color.rgb(248,249,241));
        loadingCover.setTextColor(Color.rgb(43,80,61));
        container.addView(loadingCover,new FrameLayout.LayoutParams(-1,-1));
        loadingCover.setOnClickListener(v -> { coverHome(); web.loadUrl(HOME); });
        coverHome();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setUseWideViewPort(true); settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(true); settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        String ua = settings.getUserAgentString();
        settings.setUserAgentString(ua.replaceAll("\\(Linux; Android[^)]*\\)", "(X11; Linux x86_64)").replace("; wv", "").replace(" Version/4.0", "").replace(" Mobile", ""));
        userAgent=settings.getUserAgentString();
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            new AlertDialog.Builder(this).setTitle("请更新 Android System WebView")
                .setMessage("当前系统网页组件过旧，更新后才能安全运行课堂面板。").setPositiveButton("关闭", (d,w) -> finish()).setCancelable(false).show(); return;
        }
        WebViewCompat.addWebMessageListener(web, "OrangeHost", ORIGINS, (view, message, origin, isMainFrame, reply) -> {
            if (!isMainFrame || !ORIGINS.contains(origin.toString())) return;
            try { handleMessage(new JSONObject(message.getData()), reply); }
            catch (Exception e) { showToast("应用请求格式错误"); }
        });
        try { injection = "(()=>{if(window.top!==window.self||document.getElementById('orange-classroom'))return;\n" + asset("bridge.js") + "\n" + asset("rewards-core.js") + "\n" + asset("goal-core.js") + "\n" + asset("classroom.js") + "\n" + asset("touch-player.js") + "\n})();"; }
        catch(Exception e) { showToast("课堂文件读取失败"); finish(); return; }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if (isBiliHttps(uri)) return false;
                if ("https".equals(uri.getScheme()) && request.hasGesture()) {
                    new AlertDialog.Builder(MainActivity.this).setTitle("打开外部链接？")
                        .setMessage(uri.getHost()).setPositiveButton("浏览器打开", (d,w) -> {
                            try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(Exception e) { showToast("没有可打开链接的应用"); }
                        }).setNegativeButton("取消",null).show();
                } else showToast("已留在网页播放，未跳转其他应用");
                return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon) {
                coverHome();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest req, android.webkit.WebResourceError error) {
                if(req.isForMainFrame()) loadingCover.setText("课堂加载失败，点此重试");
            }
            @Override public void onPageFinished(WebView view, String url) {
                CookieManager.getInstance().flush();
                Uri uri = Uri.parse(url);
                if (!url.equals(view.getUrl())) return;
                if (ORIGINS.contains(uri.getScheme()+"://"+uri.getHost())) {
                    view.evaluateJavascript("(()=>{const lemonPageEpoch="+navigation+";"+injection+"})();",null);
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;
            }
            @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
            }
            @Override public boolean onJsPrompt(WebView v,String url,String message,String initial,JsPromptResult result) {
                EditText input=new EditText(MainActivity.this);input.setText(initial);input.setSingleLine(false);
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input).setPositiveButton("确定",(d,w)->result.confirm(input.getText().toString())).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;
            }
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params) {
                if(fileCallback!=null)fileCallback.onReceiveValue(null);
                fileCallback=callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);
                try {startActivityForResult(intent,PICK_JSON);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;showToast("无法打开文件选择器");}return true;
            }
            @Override public void onShowCustomView(View view,CustomViewCallback callback) {
                if(fullscreen!=null){callback.onCustomViewHidden();return;}
                fullscreen=view;fullscreenCallback=callback;container.addView(view,new FrameLayout.LayoutParams(-1,-1));web.setVisibility(View.GONE);toolbar.setVisibility(View.GONE);
                WindowInsetsControllerCompat bars=WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView());
                bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);bars.hide(WindowInsetsCompat.Type.systemBars());
            }
            @Override public void onHideCustomView(){exitFullscreen();}
        });
        if(state==null || web.restoreState(state)==null) web.loadUrl(HOME);
    }
    private void coverHome() {
        final long epoch=++navigation;
        loadingCover.setText("🍋 柠檬课堂");
        loadingCover.setVisibility(View.VISIBLE);
        loadingCover.postDelayed(()->{if(navigation==epoch&&loadingCover.getVisibility()==View.VISIBLE)
            loadingCover.setText("课堂尚未就绪，点此重试");},15000);
    }

    private double adjustLevel(JSONObject msg)throws Exception{
        String kind=msg.getString("kind"),gesture=kind+":"+msg.getString("gesture");
        android.media.AudioManager audio=(android.media.AudioManager)getSystemService(AUDIO_SERVICE);
        int stream=android.media.AudioManager.STREAM_MUSIC;
        boolean volume="volume".equals(kind);
        if(!volume&&!"brightness".equals(kind))throw new Exception("unknown level");
        int max=Math.max(1,audio.getStreamMaxVolume(stream));
        WindowManager.LayoutParams attrs=getWindow().getAttributes();
        if(!gesture.equals(levelGesture)){
            initialLevel=volume?(double)audio.getStreamVolume(stream)/max:attrs.screenBrightness;
            if(!volume&&initialLevel<0)initialLevel=android.provider.Settings.System.getInt(getContentResolver(),android.provider.Settings.System.SCREEN_BRIGHTNESS,128)/255.0;
            levelGesture=gesture;
        }
        double level=Math.min(1,Math.max(volume?0:.03,initialLevel+msg.getDouble("delta")));
        if(volume){if(!audio.isVolumeFixed())audio.setStreamVolume(stream,(int)Math.round(level*max),0);
            return (double)audio.getStreamVolume(stream)/max;}
        attrs.screenBrightness=(float)level;getWindow().setAttributes(attrs);return level;
    }
    private boolean isBiliHttps(Uri uri) {String h=uri.getHost();return "https".equals(uri.getScheme())&&h!=null&&(h.equals("bilibili.com")||h.endsWith(".bilibili.com"));}
    private int dp(int n){return (int)(n*getResources().getDisplayMetrics().density+.5f);}
    private void addButton(String label,Runnable action){Button b=new Button(this);b.setText(label);b.setTextSize(12);b.setAllCaps(false);b.setPadding(0,0,0,0);b.setOnClickListener(v->action.run());toolbar.addView(b,new LinearLayout.LayoutParams(0,-1,1));}
    private String asset(String name)throws Exception{try(InputStream in=getAssets().open(name)){return read(in,LIMIT);}}
    private static String read(InputStream in,int max)throws Exception{ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>max)throw new Exception("数据过大");out.write(buf,0,n);}return out.toString("UTF-8");}
    private void showToast(String message){runOnUiThread(()->Toast.makeText(this,message,Toast.LENGTH_LONG).show());}
    private void reply(JavaScriptReplyProxy proxy,String id,Object value,String error){runOnUiThread(()->{try{JSONObject result=new JSONObject().put("id",id).put("ok",error==null);if(error==null)result.put("value",value==null?JSONObject.NULL:value);else result.put("error",error);proxy.postMessage(result.toString());}catch(Exception ignored){}});}
    private void handleMessage(JSONObject msg,JavaScriptReplyProxy proxy)throws Exception{
        String id=msg.getString("id"),op=msg.getString("op");
        if(id.length()>100)return;
        if(op.equals("ready")){
            final long epoch=msg.optLong("epoch",-1);
            if(epoch==navigation)web.postVisualStateCallback(epoch,new WebView.VisualStateCallback(){
                @Override public void onComplete(long token){if(token==navigation)loadingCover.setVisibility(View.GONE);}
            });
            reply(proxy,id,true,null);return;
        }
        if(op.equals("level")){try{reply(proxy,id,adjustLevel(msg),null);}catch(Exception e){reply(proxy,id,null,"当前设备不允许调节");}return;}
        if(op.equals("get")||op.equals("set")){
            if(!KEY.equals(msg.optString("key"))){reply(proxy,id,null,"不支持的存储键");return;}
            if(op.equals("get")){reply(proxy,id,preferences.getString(KEY,null),null);return;}
            String value=msg.getString("value");if(value.length()>LIMIT){reply(proxy,id,null,"进度数据过大");return;}
            JSONObject parsed=new JSONObject(value);if(parsed.optInt("version")!=1||!parsed.has("courses")||!parsed.has("states")){reply(proxy,id,null,"无效的进度数据");return;}
            preferences.edit().putString(KEY,value).apply();reply(proxy,id,true,null);return;
        }
        if(op.equals("request")){
            String url=msg.getString("url");Uri uri=Uri.parse(url);
            if(!"https".equals(uri.getScheme())||!"api.bilibili.com".equals(uri.getHost())||(uri.getPort()!=-1&&uri.getPort()!=443)||uri.getUserInfo()!=null||!API_PATHS.contains(uri.getPath())){reply(proxy,id,null,"仅允许读取B站课程资料");return;}
            network.execute(()->requestApi(url,proxy,id));return;
        }
        if(op.equals("export")){
            String value=msg.getString("value");if(value.length()>LIMIT){reply(proxy,id,null,"文件过大");return;}new JSONObject(value);
            if(exportText!=null){reply(proxy,id,null,"已有一个导出任务");return;}
            exportText=value;exportReply=proxy;exportId=id;beginExport();return;
        }
        reply(proxy,id,null,"未知操作");
    }
    private void requestApi(String url,JavaScriptReplyProxy proxy,String id){HttpURLConnection connection=null;try{
        connection=(HttpURLConnection)new URL(url).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(15000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent",userAgent);connection.setRequestProperty("Referer",HOME);
        String cookie=CookieManager.getInstance().getCookie(url);if(cookie!=null)connection.setRequestProperty("Cookie",cookie);
        int status=connection.getResponseCode();InputStream stream=status>=400?connection.getErrorStream():connection.getInputStream();String body="";if(stream!=null){try(InputStream in=stream){body=read(in,LIMIT);}}
        reply(proxy,id,new JSONObject().put("status",status).put("responseText",body),null);
    }catch(Exception e){reply(proxy,id,null,"B站目录请求失败，请检查网络或在应用内登录后重试");}finally{if(connection!=null)connection.disconnect();}}
    private void exportBackup(){String value=preferences.getString(KEY,null);if(value==null){showToast("暂时没有进度可备份");return;}if(exportText!=null){showToast("请先完成当前导出");return;}exportText=value;beginExport();}
    private void beginExport(){try{Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"lemon-classroom-progress.json");startActivityForResult(intent,EXPORT_JSON);}catch(Exception e){finishExport("无法打开文件保存器");}}
    private void finishExport(String error){if(exportReply!=null)reply(exportReply,exportId,error==null,error);else showToast(error==null?"进度已备份":error);exportText=null;exportReply=null;exportId=null;}
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==PICK_JSON){if(fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}}
        if(request==EXPORT_JSON){if(result!=RESULT_OK||data==null||data.getData()==null){finishExport("已取消导出");return;}try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new Exception();out.write(exportText.getBytes(StandardCharsets.UTF_8));finishExport(null);}catch(Exception e){finishExport("文件保存失败，请重新导出");}}
    }
    private void exitFullscreen(){if(fullscreen==null)return;container.removeView(fullscreen);fullscreen=null;web.setVisibility(View.VISIBLE);toolbar.setVisibility(View.VISIBLE);WindowCompat.getInsetsController(getWindow(),getWindow().getDecorView()).show(WindowInsetsCompat.Type.systemBars());if(fullscreenCallback!=null){fullscreenCallback.onCustomViewHidden();fullscreenCallback=null;}}
    private void goBack(){if(fullscreen!=null)exitFullscreen();else web.evaluateJavascript("document.documentElement.hasAttribute('data-lemon-login')", result->{if("true".equals(result)){coverHome();web.loadUrl(HOME);}else backFromClassroom();});}
    private void backFromClassroom(){if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("退出课堂？").setPositiveButton("退出",(d,w)->finish()).setNegativeButton("取消",null).show();}
    @Override public void onBackPressed(){goBack();}
    @Override protected void onSaveInstanceState(Bundle out){super.onSaveInstanceState(out);if(web!=null)web.saveState(out);}
    @Override protected void onPause(){super.onPause();if(web!=null){web.evaluateJavascript("document.querySelectorAll('video').forEach(v=>v.pause())",null);web.onPause();CookieManager.getInstance().flush();}}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){container.removeAllViews();web.destroy();}network.shutdownNow();super.onDestroy();}
}
