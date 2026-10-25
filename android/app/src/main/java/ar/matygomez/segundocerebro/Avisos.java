package ar.matygomez.segundocerebro;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

// Notificaciones: aviso diario, aviso a la hora de cada tarea, la de prueba y la fija.
// Funcionan con la app cerrada: la app web le deja a Android la lista de tareas
// pendientes (guardarTareas) cada vez que cambia, y acá se programan las alarmas.
public final class Avisos {

    static final String PREFS = "cerebro";
    static final String RECARGAR = "recargarPrincipal";
    private static final String TAREAS = "tareas";
    private static final String AJUSTES = "ajustesAvisos";
    private static final String PROGRAMADAS = "alarmasTareas";

    static final String CANAL_AVISOS = "avisos";
    private static final String CANAL_FIJA = "fija";
    private static final int ID_DIARIO = 1, ID_PRUEBA = 2, ID_FIJA = 3;
    static final int LATON = Color.parseColor("#D3AB5C");
    private static final int MAXIMO_ALARMAS = 60;
    private static final long DIAS_30 = 30L * 24 * 3600 * 1000;

    private Avisos() { }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void crearCanales(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel avisos = new NotificationChannel(CANAL_AVISOS, "Avisos de tareas", NotificationManager.IMPORTANCE_HIGH);
        avisos.setDescription("Aviso diario y aviso a la hora de cada tarea");
        nm.createNotificationChannel(avisos);
        NotificationChannel fija = new NotificationChannel(CANAL_FIJA, "Notificación fija", NotificationManager.IMPORTANCE_LOW);
        fija.setDescription("Botones Finanzas, Nueva tarea y Anotar siempre arriba");
        fija.setShowBadge(false);
        nm.createNotificationChannel(fija);
    }

    // ── Datos que manda la app web ──

    static JSONObject tareas(Context ctx) {
        try { return new JSONObject(prefs(ctx).getString(TAREAS, "{}")); } catch (JSONException e) { return new JSONObject(); }
    }

    static void guardarTareas(Context ctx, String json) {
        prefs(ctx).edit().putString(TAREAS, json).apply();
        reprogramar(ctx);
        TareasWidget.actualizarTodos(ctx);
    }

    static JSONObject ajustes(Context ctx) {
        JSONObject o;
        try { o = new JSONObject(prefs(ctx).getString(AJUSTES, "{}")); } catch (JSONException e) { o = new JSONObject(); }
        try {
            if (!o.has("diario")) o.put("diario", true);
            if (!o.has("horaDiaria")) o.put("horaDiaria", "09:00");
            if (!o.has("porTarea")) o.put("porTarea", true);
            if (!o.has("fija")) o.put("fija", false);
        } catch (JSONException e) { /* no pasa */ }
        return o;
    }

    static void guardarAjustes(Context ctx, String json) {
        prefs(ctx).edit().putString(AJUSTES, json).apply();
        reprogramar(ctx);
        mostrarFija(ctx);
    }

    static JSONObject estado(Context ctx) {
        JSONObject o = new JSONObject();
        try {
            o.put("permiso", puedeNotificar(ctx));
            PowerManager pm = ctx.getSystemService(PowerManager.class);
            o.put("bateria", pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName()));
            o.put("exactas", exactas(ctx));
        } catch (JSONException e) { /* no pasa */ }
        return o;
    }

    private static boolean puedeNotificar(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (!nm.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = nm.getNotificationChannel(CANAL_AVISOS);
            return c == null || c.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        return true;
    }

    private static boolean exactas(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        return am != null && am.canScheduleExactAlarms();
    }

    static Intent intentAjuste(Context ctx, String cual) {
        if ("bateria".equals(cual)) {
            return new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + ctx.getPackageName()));
        }
        Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx.getPackageName());
        return i;
    }

    // ── Prueba ──

    static String probar(Context ctx) {
        crearCanales(ctx);
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return "sin-permiso";
        if (!puedeNotificar(ctx)) return "apagadas";
        Notification n = base(ctx, CANAL_AVISOS)
                .setContentTitle("Las notificaciones funcionan")
                .setContentText("Esta es la de prueba. Si la ves, te van a llegar los avisos.")
                .setContentIntent(abrir(ctx, "tareas"))
                .build();
        ctx.getSystemService(NotificationManager.class).notify(ID_PRUEBA, n);
        return "ok";
    }

    // ── Alarmas ──

    static void reprogramar(Context ctx) {
        crearCanales(ctx);
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        JSONObject aj = ajustes(ctx);

        // Las de cada tarea: se borran las anteriores y se ponen las que siguen.
        String[] viejas = prefs(ctx).getString(PROGRAMADAS, "").split("\n");
        for (String id : viejas) if (!id.isEmpty()) am.cancel(alarma(ctx, AlarmaReceptor.TAREA, id));
        List<String> nuevas = new ArrayList<>();
        if (aj.optBoolean("porTarea", true)) {
            long ahora = System.currentTimeMillis();
            JSONArray lista = tareas(ctx).optJSONArray("tareas");
            for (int i = 0; lista != null && i < lista.length() && nuevas.size() < MAXIMO_ALARMAS; i++) {
                JSONObject t = lista.optJSONObject(i);
                long cuando = t == null ? 0 : t.optLong("aviso", 0);
                if (cuando <= ahora || cuando > ahora + DIAS_30) continue;
                String id = t.optString("id");
                programar(ctx, cuando, alarma(ctx, AlarmaReceptor.TAREA, id));
                nuevas.add(id);
            }
        }
        prefs(ctx).edit().putString(PROGRAMADAS, String.join("\n", nuevas)).apply();

        PendingIntent diario = alarma(ctx, AlarmaReceptor.DIARIO, "");
        if (aj.optBoolean("diario", true)) programar(ctx, proxima(aj.optString("horaDiaria", "09:00")), diario);
        else am.cancel(diario);

        // A medianoche el widget cambia "Mañana" por "Hoy".
        programar(ctx, proxima("00:01"), alarma(ctx, AlarmaReceptor.MEDIANOCHE, ""));
    }

    static void programar(Context ctx, long cuando, PendingIntent pi) {
        AlarmManager am = ctx.getSystemService(AlarmManager.class);
        if (exactas(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
    }

    static PendingIntent alarma(Context ctx, String tipo, String id) {
        Intent i = new Intent(ctx, AlarmaReceptor.class).setAction(tipo).setData(Uri.parse("cerebro://" + tipo + "/" + Uri.encode(id)))
                .putExtra(AlarmaReceptor.EXTRA_ID, id);
        return PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    // Próxima vez que el reloj marque esa hora (hoy si todavía no pasó, si no mañana).
    private static long proxima(String hhmm) {
        String[] p = hhmm.split(":");
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, entero(p[0], 9));
        c.set(Calendar.MINUTE, p.length > 1 ? entero(p[1], 0) : 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis();
    }

    private static int entero(String s, int siNo) {
        try { return Integer.parseInt(s.trim()); } catch (Exception e) { return siNo; }
    }

    // ── Lo que muestran las alarmas ──

    static void mostrarDiario(Context ctx) {
        if (!puedeNotificar(ctx)) return;
        String hoy = Fechas.hoy();
        List<String> vencidas = new ArrayList<>(), deHoy = new ArrayList<>();
        JSONArray lista = tareas(ctx).optJSONArray("tareas");
        for (int i = 0; lista != null && i < lista.length(); i++) {
            JSONObject t = lista.optJSONObject(i);
            String f = t == null ? "" : t.optString("fecha");
            if (f.isEmpty()) continue;
            if (f.compareTo(hoy) < 0) vencidas.add(t.optString("titulo"));
            else if (f.equals(hoy)) deHoy.add(t.optString("titulo"));
        }
        if (vencidas.isEmpty() && deHoy.isEmpty()) return;   // nada que avisar
        String titulo = "Hoy: " + cantidad(deHoy.size(), "tarea", "tareas")
                + (vencidas.isEmpty() ? "" : " y " + cantidad(vencidas.size(), "vencida", "vencidas"));
        StringBuilder texto = new StringBuilder();
        for (String v : vencidas) texto.append(texto.length() > 0 ? "\n" : "").append(v).append(" (vencida)");
        for (String d : deHoy) texto.append(texto.length() > 0 ? "\n" : "").append(d);
        Notification n = base(ctx, CANAL_AVISOS)
                .setContentTitle(titulo)
                .setContentText(texto.toString().replace("\n", " · "))
                .setStyle(new Notification.BigTextStyle().bigText(texto))
                .setContentIntent(abrir(ctx, "tareas"))
                .build();
        ctx.getSystemService(NotificationManager.class).notify(ID_DIARIO, n);
    }

    static void mostrarTarea(Context ctx, String id) {
        if (!puedeNotificar(ctx)) return;
        JSONObject t = buscar(ctx, id);
        if (t == null) return;   // ya se hizo o se borró
        String hora = t.optString("hora");
        String detalle = t.optString("area") + (hora.isEmpty() ? "" : " · " + hora);
        Intent posponer = new Intent(ctx, AlarmaReceptor.class).setAction(AlarmaReceptor.POSPONER)
                .setData(Uri.parse("cerebro://posponer/" + Uri.encode(id))).putExtra(AlarmaReceptor.EXTRA_ID, id);
        Notification n = base(ctx, CANAL_AVISOS)
                .setContentTitle(t.optString("titulo"))
                .setContentText(detalle)
                .setContentIntent(abrir(ctx, "abrir-tarea:" + id))
                .addAction(new Notification.Action.Builder(null, "Hecha", abrir(ctx, "completar:" + id)).build())
                .addAction(new Notification.Action.Builder(null, "En 1 hora",
                        PendingIntent.getBroadcast(ctx, 0, posponer, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)).build())
                .build();
        ctx.getSystemService(NotificationManager.class).notify(idDe(id), n);
    }

    // "Hecha" abre la app para marcarla; la notificación ya no hace falta.
    static void cancelarTarea(Context ctx, String id) {
        ctx.getSystemService(NotificationManager.class).cancel(idDe(id));
    }

    static void posponer(Context ctx, String id) {
        ctx.getSystemService(NotificationManager.class).cancel(idDe(id));
        programar(ctx, System.currentTimeMillis() + 3600_000L, alarma(ctx, AlarmaReceptor.TAREA, id));
    }

    // Finanzas, Nueva tarea y Anotar siempre arriba (si está prendida en Ajustes).
    static void mostrarFija(Context ctx) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (!ajustes(ctx).optBoolean("fija", false)) { nm.cancel(ID_FIJA); return; }
        crearCanales(ctx);
        Notification n = base(ctx, CANAL_FIJA)
                .setContentTitle("Cerebro")
                .setContentText("Finanzas, nueva tarea o anotar algo")
                .setOngoing(true)
                .setShowWhen(false)
                .setContentIntent(abrir(ctx, "tareas"))
                .addAction(new Notification.Action.Builder(null, "Finanzas", ventanita(ctx, "finanzas")).build())
                .addAction(new Notification.Action.Builder(null, "Nueva tarea", ventanita(ctx, "tarea")).build())
                .addAction(new Notification.Action.Builder(null, "Anotar", ventanita(ctx, "anotar")).build())
                .build();
        nm.notify(ID_FIJA, n);
    }

    // ── Ayudas ──

    private static Notification.Builder base(Context ctx, String canal) {
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, canal) : new Notification.Builder(ctx);
        return b.setSmallIcon(R.drawable.ic_noti).setColor(LATON).setAutoCancel(!CANAL_FIJA.equals(canal));
    }

    static PendingIntent abrir(Context ctx, String accion) {
        return PendingIntent.getActivity(ctx, accion.hashCode(), MainActivity.intentAccion(ctx, accion),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static PendingIntent ventanita(Context ctx, String cual) {
        return PendingIntent.getActivity(ctx, ("ventana:" + cual).hashCode(), VentanaActivity.intent(ctx, cual),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static JSONObject buscar(Context ctx, String id) {
        JSONArray lista = tareas(ctx).optJSONArray("tareas");
        for (int i = 0; lista != null && i < lista.length(); i++) {
            JSONObject t = lista.optJSONObject(i);
            if (t != null && id.equals(t.optString("id"))) return t;
        }
        return null;
    }

    private static int idDe(String tareaId) {
        return 1000 + (tareaId.hashCode() & 0x7fffff);
    }

    private static String cantidad(int n, String uno, String varios) {
        return n + " " + (n == 1 ? uno : varios);
    }

    // Fechas como texto 'AAAA-MM-DD', igual que en la app web.
    static final class Fechas {
        private static final String[] MESES = {"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"};

        static String hoy() {
            return dentroDe(0);
        }

        static String dentroDe(int dias) {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, dias);
            return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(c.getTime());
        }

        // Como Todoist: Hoy, Ayer, Mañana o "13 jun".
        static String corta(String iso) {
            if (iso == null || iso.length() < 10) return "";
            if (iso.equals(hoy())) return "Hoy";
            if (iso.equals(dentroDe(-1))) return "Ayer";
            if (iso.equals(dentroDe(1))) return "Mañana";
            int mes = entero(iso.substring(5, 7), 1), dia = entero(iso.substring(8, 10), 1);
            String año = iso.substring(0, 4).equals(hoy().substring(0, 4)) ? "" : " " + iso.substring(0, 4);
            return dia + " " + MESES[Math.max(0, Math.min(11, mes - 1))] + año;
        }
    }
}
