package ar.matygomez.segundocerebro;

import android.accounts.Account;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.result.IntentSenderRequest;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

// Lo que la app web le puede pedir a Android (window.CerebroAndroid en js/core/android.js).
// Las respuestas del inicio de sesión vuelven llamando a window.__cerebroAndroid.token(...).
public class Puente {

    private final BaseWeb act;
    private final WebView web;
    volatile String urlActual = "";

    Puente(BaseWeb act, WebView web) {
        this.act = act;
        this.web = web;
    }

    private boolean permitido() {
        return BaseWeb.esNuestra(urlActual);
    }

    @JavascriptInterface
    public int version() {
        return BuildConfig.VERSION_CODE;
    }

    // Solo para bajar la versión nueva de la app desde GitHub.
    @JavascriptInterface
    public void abrirAfuera(String url) {
        if (!permitido()) return;
        Uri u = Uri.parse(url);
        if (!"https".equals(u.getScheme()) || !"github.com".equals(u.getHost())) return;
        act.runOnUiThread(() -> act.abrirAfuera(u));
    }

    // ── Ventanitas y pedidos ──

    @JavascriptInterface
    public String ventana() {
        return permitido() ? act.ventana() : "";
    }

    @JavascriptInterface
    public void cerrarVentana(boolean guardado) {
        if (permitido()) act.runOnUiThread(() -> act.cerrarVentana(guardado));
    }

    @JavascriptInterface
    public String tomarAccion() {
        if (!permitido()) return "";
        String[] r = {""};
        esperarEnPantalla(() -> r[0] = act.tomarAccion());
        return r[0];
    }

    @JavascriptInterface
    public String tomarCompartido() {
        if (!permitido()) return "";
        String[] r = {""};
        esperarEnPantalla(() -> r[0] = act.tomarCompartido());
        return r[0];
    }

    @JavascriptInterface
    public void volver() {
        if (permitido()) act.runOnUiThread(act::volver);
    }

    // Los pedidos se guardan en la pantalla; se leen ahí para no mezclarse.
    private void esperarEnPantalla(Runnable r) {
        final Object listo = new Object();
        final boolean[] hecho = {false};
        act.runOnUiThread(() -> {
            r.run();
            synchronized (listo) { hecho[0] = true; listo.notifyAll(); }
        });
        synchronized (listo) {
            long hasta = System.currentTimeMillis() + 2000;
            while (!hecho[0] && System.currentTimeMillis() < hasta) {
                try { listo.wait(200); } catch (InterruptedException e) { return; }
            }
        }
    }

    // ── Avisos y widget ──

    @JavascriptInterface
    public void guardarTareas(String json) {
        if (permitido()) Avisos.guardarTareas(act.getApplicationContext(), json);
    }

    @JavascriptInterface
    public String ajustesAvisos() {
        return permitido() ? Avisos.ajustes(act).toString() : "";
    }

    @JavascriptInterface
    public void guardarAjustesAvisos(String json) {
        if (permitido()) Avisos.guardarAjustes(act.getApplicationContext(), json);
    }

    @JavascriptInterface
    public String estadoAvisos() {
        return permitido() ? Avisos.estado(act).toString() : "";
    }

    @JavascriptInterface
    public void pedirPermisoNotificaciones() {
        if (permitido()) act.runOnUiThread(act::pedirPermisoNotificaciones);
    }

    @JavascriptInterface
    public void abrirAjuste(String cual) {
        if (permitido()) act.runOnUiThread(() -> act.abrirAjuste(cual));
    }

    @JavascriptInterface
    public String probarNotificacion() {
        return permitido() ? Avisos.probar(act) : "";
    }

    // ── Inicio de sesión de Google ──
    // Pide a Google el permiso de Drive (y Calendario) con la cuenta del teléfono.
    // Google no deja iniciar sesión con su ventana web adentro de una app,
    // por eso en Android se usa esto en lugar de accounts.google.com.
    // Sin "interactivo" no muestra nada: sirve para reconectar sola al abrir.
    @JavascriptInterface
    public void pedirToken(String alcances, String cuenta, boolean interactivo) {
        if (!permitido()) return;
        act.runOnUiThread(() -> autorizar(alcances, cuenta, interactivo));
    }

    private void autorizar(String alcances, String cuenta, boolean interactivo) {
        List<Scope> lista = new ArrayList<>();
        for (String a : alcances.trim().split("\\s+")) if (!a.isEmpty()) lista.add(new Scope(a));
        AuthorizationRequest.Builder pedido = AuthorizationRequest.builder().setRequestedScopes(lista);
        boolean conCuenta = cuenta != null && !cuenta.isEmpty();
        if (conCuenta) pedido.setAccount(new Account(cuenta, "com.google"));

        Identity.getAuthorizationClient(act).authorize(pedido.build())
                .addOnSuccessListener(r -> {
                    if (!r.hasResolution()) { responder(r); return; }
                    if (!interactivo) { responderError("hace-falta-permiso"); return; }
                    try {
                        act.permisoGoogle.launch(new IntentSenderRequest.Builder(r.getPendingIntent().getIntentSender()).build());
                    } catch (Exception e) {
                        responderError("no-se-pudo-abrir");
                    }
                })
                .addOnFailureListener(e -> {
                    // La cuenta recordada puede no estar en este teléfono: se prueba eligiendo.
                    if (conCuenta) autorizar(alcances, "", interactivo);
                    else responderError(String.valueOf(e.getMessage()));
                });
    }

    void alVolverDeGoogle(int resultado, Intent datos) {
        if (resultado != Activity.RESULT_OK) { responderError("cancelado"); return; }
        try {
            responder(Identity.getAuthorizationClient(act).getAuthorizationResultFromIntent(datos));
        } catch (ApiException e) {
            responderError(String.valueOf(e.getMessage()));
        }
    }

    private void responder(AuthorizationResult r) {
        JSONObject o = new JSONObject();
        try {
            o.put("token", r.getAccessToken());
            o.put("alcances", String.join(" ", r.getGrantedScopes()));
        } catch (JSONException e) { /* no pasa con textos */ }
        entregar(o);
    }

    private void responderError(String error) {
        JSONObject o = new JSONObject();
        try { o.put("error", error); } catch (JSONException e) { /* no pasa con textos */ }
        entregar(o);
    }

    private void entregar(JSONObject o) {
        String js = "window.__cerebroAndroid && window.__cerebroAndroid.token(" + o + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }
}
