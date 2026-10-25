package ar.matygomez.segundocerebro;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

// Lo común a la app (MainActivity) y a las ventanitas del panel (VentanaActivity):
// una WebView con la app web, el puente con Android, archivos, ubicación y permisos.
public abstract class BaseWeb extends ComponentActivity {

    static final String HOST = "matygomez.github.io";
    static final String RUTA = "/segundo-cerebro";
    static final String INICIO = "https://" + HOST + RUTA + "/#/home";
    static final int PAPEL = Color.parseColor("#0B0B0C");

    protected WebView web;
    protected Puente puente;
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

    private final ActivityResultLauncher<String> permisoNotificaciones = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), ok -> {
                // Si Android ya no muestra la pregunta, se va directo al ajuste.
                if (!ok && Build.VERSION.SDK_INT >= 33 && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                    abrirAjuste("notificaciones");
                }
                avisarCambioALaWeb();
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

    // ── Lo que cada pantalla define ──
    String ventana() { return ""; }
    void cerrarVentana(boolean guardado) { }
    String tomarAccion() { return ""; }
    String tomarCompartido() { return ""; }

    void volver() {
        moveTaskToBack(true);
    }

    protected WebView crearWeb(boolean transparente) {
        web = new WebView(this);
        web.setBackgroundColor(transparente ? Color.TRANSPARENT : PAPEL);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " SegundoCerebroAndroid/" + BuildConfig.VERSION_CODE);

        puente = new Puente(this, web);
        web.addJavascriptInterface(puente, "CerebroAndroid");
        web.setWebChromeClient(new Ventanas());
        web.setDownloadListener((url, agente, disposicion, tipo, largo) -> {
            if (url.startsWith("http")) abrirAfuera(Uri.parse(url));
        });
        return web;
    }

    void abrirAfuera(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) { /* no hay con qué abrirlo */ }
    }

    void pedirPermisoNotificaciones() {
        if (Build.VERSION.SDK_INT < 33) { abrirAjuste("notificaciones"); return; }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            abrirAjuste("notificaciones");   // el permiso está, pero se apagaron desde Android
            return;
        }
        permisoNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS);
    }

    void abrirAjuste(String cual) {
        try {
            startActivity(Avisos.intentAjuste(this, cual));
        } catch (ActivityNotFoundException e) {
            startActivity(new Intent(android.provider.Settings.ACTION_SETTINGS));
        }
    }

    // Ajustes de la app se vuelve a dibujar cuando cambia un permiso.
    void avisarCambioALaWeb() {
        if (web != null) web.evaluateJavascript("document.dispatchEvent(new Event('visibilitychange'))", null);
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
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
