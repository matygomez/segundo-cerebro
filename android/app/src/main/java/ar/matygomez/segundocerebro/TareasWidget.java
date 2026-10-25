package ar.matygomez.segundocerebro;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

// Widget de tareas, como el de Todoist: sin fondo, agrupado por área, la fecha a la derecha.
// Arriba: la lista elegida (toca para cambiarla), actualizar y nueva tarea.
// Tocar una tarea abre su detalle en la app, y ahí se tacha.
public class TareasWidget extends AppWidgetProvider {

    // Listas: 'hoy' (hoy y vencidas), 'semana', 'todas' o 'area:<nombre>'. Modo: 'ampliado' o 'compacto'.
    static String lista(Context ctx, int id) {
        return opciones(ctx).getString("lista-" + id, "hoy");
    }

    static String modo(Context ctx, int id) {
        return opciones(ctx).getString("modo-" + id, "ampliado");
    }

    static void elegir(Context ctx, int id, String lista, String modo) {
        SharedPreferences.Editor e = opciones(ctx).edit();
        if (lista != null) e.putString("lista-" + id, lista);
        if (modo != null) e.putString("modo-" + id, modo);
        e.apply();
        actualizar(ctx, AppWidgetManager.getInstance(ctx), id);
    }

    static String nombreLista(String lista) {
        if (lista.startsWith("area:")) return lista.substring(5);
        if (lista.equals("semana")) return "Próximos 7 días";
        if (lista.equals("todas")) return "Todas";
        return "Hoy";
    }

    private static SharedPreferences opciones(Context ctx) {
        return ctx.getSharedPreferences("widget", Context.MODE_PRIVATE);
    }

    static void actualizarTodos(Context ctx) {
        AppWidgetManager am = AppWidgetManager.getInstance(ctx);
        for (int id : am.getAppWidgetIds(new ComponentName(ctx, TareasWidget.class))) actualizar(ctx, am, id);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager am, int[] ids) {
        for (int id : ids) actualizar(ctx, am, id);
    }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        SharedPreferences.Editor e = opciones(ctx).edit();
        for (int id : ids) e.remove("lista-" + id).remove("modo-" + id);
        e.apply();
    }

    static void actualizar(Context ctx, AppWidgetManager am, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_tareas);
        v.setTextViewText(R.id.w_lista, nombreLista(lista(ctx, id)) + " ▾");

        Intent servicio = new Intent(ctx, WidgetServicio.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        servicio.setData(Uri.parse(servicio.toUri(Intent.URI_INTENT_SCHEME)));
        v.setRemoteAdapter(R.id.w_tareas, servicio);
        v.setEmptyView(R.id.w_tareas, R.id.w_vacio);

        // Cada fila completa este pedido con 'abrir-tarea:<id>'.
        Intent abrir = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        v.setPendingIntentTemplate(R.id.w_tareas, PendingIntent.getActivity(ctx, 5000 + id, abrir,
                PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        Intent opcionesLista = new Intent(ctx, WidgetOpciones.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        v.setOnClickPendingIntent(R.id.w_lista, PendingIntent.getActivity(ctx, 6000 + id, opcionesLista,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        v.setOnClickPendingIntent(R.id.w_actualizar, Avisos.abrir(ctx, "actualizar"));
        v.setOnClickPendingIntent(R.id.w_mas, Avisos.ventanita(ctx, "tarea"));
        v.setOnClickPendingIntent(R.id.w_logo, Avisos.abrir(ctx, "tareas"));

        am.updateAppWidget(id, v);
        am.notifyAppWidgetViewDataChanged(id, R.id.w_tareas);
    }
}
