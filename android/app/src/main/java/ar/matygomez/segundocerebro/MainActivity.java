package ar.matygomez.segundocerebro;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

// La app de Android es una ventana que abre la misma app web de GitHub Pages.
// Así casi todas las actualizaciones siguen llegando solas, como en el navegador.
// Lo propio de Android (inicio de sesión de Google, y más adelante widget,
// botones y avisos) se le ofrece a la web a través de Puente.
public class MainActivity extends ComponentActivity {

    static final String HOST = "matygomez.github.io";
    static final String RUTA = "/segundo-cerebro";
    static final String INICIO = "https://" + HOST + RUTA + "/#/home";
    private static final int PAPEL = Color.parseColor("#0B0B0C");

    private WebView web;
    private Puente puente;
    private ValueCallback<Uri[]> archivosPendientes;
    private GeolocationPermissions.Callback ubicacionPendiente;
    private String origenUbicacion;

    private final ActivityResultLauncher<Intent> elegirArchivos = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(), r -> {
                if (archivosPendientes == null) return;
                archivosPendientes.onReceiveValue(archivosElegidos(r.getResultCode(), r.getData()));
                archivosPendientes = null;
            });

    private final ActivityResultLauncher<String> pedirUbicacion = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), ok -> {
                if (ubicacionPendiente != null) ubicacionPendiente.invoke(origenUbicacion, ok, false);
                ubicacionPendiente = null;
            });

    final ActivityResultLauncher<IntentSenderRequest> permisoGoogle = registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            r -> puente.alVolverDeGoogle(r.getResultCode(), r.getData()));

    // Solo la app propia puede usar el puente y abrirse adentro; el resto va al navegador.
    static boolean esNuestra(String url) {
        if (url == null) return false;
        Uri u = Uri.parse(url);
        String ruta = u.getPath() == null ? "" : u.getPath();
        return "https".equals(u.getScheme()) && HOST.equals(u.getHost()) && ruta.startsWith(RUTA);
    }

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        prepararVentana();

        web = new WebView(this);
        web.setBackgroundColor(PAPEL);
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(PAPEL);
        raiz.addView(web);
        // La web queda entre la barra de arriba y la de abajo, y se achica con el teclado.
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, ins) -> {
            Insets b = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(raiz);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " SegundoCerebroAndroid/" + BuildConfig.VERSION_CODE);

        puente = new Puente(this, web);
        web.addJavascriptInterface(puente, "CerebroAndroid");
        web.setWebViewClient(new Navegacion());
        web.setWebChromeClient(new Ventanas());
        web.setDownloadListener((url, agente, disposicion, tipo, largo) -> {
            if (url.startsWith("http")) abrirAfuera(Uri.parse(url));
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else moveTaskToBack(true);
            }
        });

        if (guardado == null || web.restoreState(guardado) == null) web.loadUrl(INICIO);
    }

    private void prepararVentana() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat barras = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        barras.setAppearanceLightStatusBars(false);   // íconos claros sobre el fondo oscuro
        barras.setAppearanceLightNavigationBars(false);
    }

    void abrirAfuera(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) { /* no hay con qué abrirlo */ }
    }

    // Un archivo o varios, según lo que devuelva el selector de Android.
    private static Uri[] archivosElegidos(int resultado, Intent datos) {
        if (resultado != RESULT_OK || datos == null) return null;
        ClipData varios = datos.getClipData();
        if (varios != null) {
            Uri[] lista = new Uri[varios.getItemCount()];
            for (int i = 0; i < lista.length; i++) lista[i] = varios.getItemAt(i).getUri();
            return lista;
        }
        return datos.getData() != null ? new Uri[]{datos.getData()} : null;
    }

    private class Navegacion extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
            String url = pedido.getUrl().toString();
            if (esNuestra(url)) return false;
            abrirAfuera(pedido.getUrl());
            return true;
        }

        @Override
        public void doUpdateVisitedHistory(WebView v, String url, boolean recarga) {
            puente.urlActual = url;
        }

        @Override
        public void onPageStarted(WebView v, String url, android.graphics.Bitmap icono) {
            puente.urlActual = url;
        }

        // Sin internet y sin la copia guardada de la app (la primera vez): aviso simple.
        @Override
        public void onReceivedError(WebView v, WebResourceRequest pedido, WebResourceError error) {
            if (!pedido.isForMainFrame()) return;
            String html = "<html><body style=\"background:#0B0B0C;color:#eee;font-family:sans-serif;"
                    + "display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center\">"
                    + "<p>No se pudo abrir Segundo Cerebro.<br>Revisá la conexión a internet.</p>"
                    + "<a href=\"" + INICIO + "\" style=\"color:#0B0B0C;background:#D3AB5C;padding:12px 20px;"
                    + "border-radius:8px;text-decoration:none\">Probar de nuevo</a></body></html>";
            v.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        }
    }

    private class Ventanas extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> alElegir, FileChooserParams opciones) {
            if (archivosPendientes != null) archivosPendientes.onReceiveValue(null);
            archivosPendientes = alElegir;
            Intent pedido = opciones.createIntent();
            if (opciones.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) pedido.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                elegirArchivos.launch(pedido);
                return true;
            } catch (ActivityNotFoundException e) {
                archivosPendientes = null;
                return false;
            }
        }

        @Override
        public void onGeolocationPermissionsShowPrompt(String origen, GeolocationPermissions.Callback cb) {
            if (!HOST.equals(Uri.parse(origen).getHost())) { cb.invoke(origen, false, false); return; }
            if (checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                cb.invoke(origen, true, false);
                return;
            }
            ubicacionPendiente = cb;
            origenUbicacion = origen;
            pedirUbicacion.launch(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
