package ar.matygomez.segundocerebro;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;

// Ventanita de los botones del panel (Finanzas, Nueva tarea, Anotar): se abre encima
// de lo que estés haciendo. Carga la misma app web, que muestra solo el formulario
// sobre un fondo transparente, y se cierra sola al guardar o cancelar.
public class VentanaActivity extends BaseWeb {

    static final String EXTRA_VENTANA = "ventana";
    private String cual = "";

    static Intent intent(Context ctx, String cual) {
        return new Intent(ctx, VentanaActivity.class)
                .putExtra(EXTRA_VENTANA, cual)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        cual = leer(getIntent());
        setContentView(crearWeb(true));
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest pedido) {
                if (esNuestra(pedido.getUrl().toString())) return false;
                abrirAfuera(pedido.getUrl());
                return true;
            }

            @Override
            public void onPageStarted(WebView v, String url, android.graphics.Bitmap icono) {
                puente.urlActual = url;
            }

            @Override
            public void doUpdateVisitedHistory(WebView v, String url, boolean recarga) {
                puente.urlActual = url;
            }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                cerrar();
            }
        });
        web.loadUrl(INICIO);
    }

    // Otro botón del panel con la ventanita ya abierta: se abre el formulario nuevo.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        cual = leer(intent);
        web.loadUrl(INICIO);
    }

    private static String leer(Intent intent) {
        String c = intent == null ? null : intent.getStringExtra(EXTRA_VENTANA);
        return c == null ? "anotar" : c;
    }

    @Override
    String ventana() {
        return cual;
    }

    @Override
    void cerrarVentana(boolean guardado) {
        // La app, si está abierta, vuelve a leer los datos al volver a ella.
        if (guardado) Avisos.prefs(this).edit().putBoolean(Avisos.RECARGAR, true).apply();
        cerrar();
    }

    private void cerrar() {
        finish();
        overridePendingTransition(0, 0);
    }
}
