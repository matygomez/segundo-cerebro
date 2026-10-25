package ar.matygomez.segundocerebro;

import android.Manifest;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

// La app: una ventana que abre la misma app web de GitHub Pages, así casi todas
// las actualizaciones siguen llegando solas, como en el navegador.
// También recibe los pedidos del widget, de las notificaciones y de "Compartir".
public class MainActivity extends BaseWeb {

    // Extra con un pedido para la web: 'abrir-tarea:<id>', 'completar:<id>', 'tareas', 'actualizar'.
    static final String EXTRA_ACCION = "accion";
    private static final int MAXIMO_ARCHIVO = 20 * 1024 * 1024;

    private String accionPendiente = "";
    private String compartidoPendiente = "";

    static Intent intentAccion(android.content.Context ctx, String accion) {
        return new Intent(ctx, MainActivity.class)
                .putExtra(EXTRA_ACCION, accion)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        prepararVentana();
        Avisos.crearCanales(this);

        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(PAPEL);
        raiz.addView(crearWeb(false));
        // La web queda entre la barra de arriba y la de abajo, y se achica con el teclado.
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, ins) -> {
            Insets b = ins.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.ime());
            v.setPadding(b.left, b.top, b.right, b.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
        setContentView(raiz);
        web.setWebViewClient(new Navegacion());

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else moveTaskToBack(true);
            }
        });

        procesar(getIntent());
        if (guardado == null || web.restoreState(guardado) == null) web.loadUrl(INICIO);
        pedirPermisoLaPrimeraVez();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        procesar(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Lo guardado desde una ventanita del panel: la app vuelve a leer los datos.
        if (Avisos.prefs(this).getBoolean(Avisos.RECARGAR, false)) {
            Avisos.prefs(this).edit().putBoolean(Avisos.RECARGAR, false).apply();
            web.reload();
        }
    }

    private void prepararVentana() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat barras = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        barras.setAppearanceLightStatusBars(false);   // íconos claros sobre el fondo oscuro
        barras.setAppearanceLightNavigationBars(false);
    }

    // Android 13 o más: la primera vez se pide el permiso de notificaciones.
    private void pedirPermisoLaPrimeraVez() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        if (Avisos.prefs(this).getBoolean("permisoPedido", false)) return;
        Avisos.prefs(this).edit().putBoolean("permisoPedido", true).apply();
        pedirPermisoNotificaciones();
    }

    // ── Pedidos para la web ──

    private void procesar(Intent intent) {
        if (intent == null) return;
        String accion = intent.getStringExtra(EXTRA_ACCION);
        if (accion != null && !accion.isEmpty()) {
            intent.removeExtra(EXTRA_ACCION);   // que no se repita al girar o volver
            if (accion.startsWith("completar:")) Avisos.cancelarTarea(this, accion.substring(10));
            accionPendiente = accion;
            entregarAccion();
            return;
        }
        String tipo = intent.getAction();
        if (Intent.ACTION_SEND.equals(tipo) || Intent.ACTION_SEND_MULTIPLE.equals(tipo)) {
            intent.setAction(Intent.ACTION_MAIN);
            leerCompartido(intent);
        }
    }

    // Si la web ya está abierta, se le avisa; si está cargando, lo pide sola al arrancar.
    private void entregarAccion() {
        if (web == null) return;
        web.post(() -> web.evaluateJavascript(
                "window.__cerebroAndroid && window.__cerebroAndroid.accion && window.__cerebroAndroid.accion()", null));
    }

    @Override
    String tomarAccion() {
        String a = accionPendiente;
        accionPendiente = "";
        return a;
    }

    @Override
    String tomarCompartido() {
        String c = compartidoPendiente;
        compartidoPendiente = "";
        return c;
    }

    // Lo que llega de "Compartir": texto, link y archivos (leídos aparte para no trabar la pantalla).
    private void leerCompartido(Intent intent) {
        final String titulo = texto(intent.getStringExtra(Intent.EXTRA_SUBJECT));
        final String texto = texto(intent.getStringExtra(Intent.EXTRA_TEXT));
        final List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction()) || intent.hasExtra(Intent.EXTRA_STREAM)) {
            ArrayList<Uri> varios = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (varios != null) uris.addAll(varios);
            else {
                Uri uno = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (uno != null) uris.add(uno);
            }
        }
        new Thread(() -> {
            JSONObject o = new JSONObject();
            try {
                boolean esLink = texto.trim().matches("https?://\\S+");
                o.put("titulo", titulo);
                o.put("texto", esLink ? "" : texto);
                o.put("url", esLink ? texto.trim() : "");
                JSONArray archivos = new JSONArray();
                for (Uri u : uris) {
                    JSONObject a = leerArchivo(u);
                    if (a != null) archivos.put(a);
                }
                o.put("archivos", archivos);
            } catch (Exception e) { /* se manda lo que se pudo leer */ }
            runOnUiThread(() -> {
                compartidoPendiente = o.toString();
                accionPendiente = "compartir";
                entregarAccion();
            });
        }).start();
    }

    private JSONObject leerArchivo(Uri u) {
        ContentResolver cr = getContentResolver();
        try (InputStream in = cr.openInputStream(u)) {
            if (in == null) return null;
            ByteArrayOutputStream salida = new ByteArrayOutputStream();
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) {
                salida.write(buf, 0, n);
                if (salida.size() > MAXIMO_ARCHIVO) return null;   // demasiado grande para pasarlo a la web
            }
            JSONObject a = new JSONObject();
            a.put("nombre", nombreDe(u));
            a.put("tipo", texto(cr.getType(u)));
            a.put("base64", Base64.encodeToString(salida.toByteArray(), Base64.NO_WRAP));
            return a;
        } catch (Exception e) {
            return null;
        }
    }

    private String nombreDe(Uri u) {
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return texto(c.getString(0));
        } catch (Exception e) { /* sin nombre */ }
        return "";
    }

    private static String texto(String s) {
        return s == null ? "" : s;
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
                    + "<p>No se pudo abrir Cerebro.<br>Revisá la conexión a internet.</p>"
                    + "<a href=\"" + INICIO + "\" style=\"color:#0B0B0C;background:#D3AB5C;padding:12px 20px;"
                    + "border-radius:8px;text-decoration:none\">Probar de nuevo</a></body></html>";
            v.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle estado) {
        super.onSaveInstanceState(estado);
        web.saveState(estado);
    }
}
