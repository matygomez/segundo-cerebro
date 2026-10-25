package ar.matygomez.segundocerebro;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Las filas del widget: un título por área y sus tareas, ordenadas por fecha y hora.
public class WidgetServicio extends RemoteViewsService {

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Filas(getApplicationContext(), intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, 0));
    }

    private static final int TEXTO_FECHA = Color.parseColor("#D3AB5C");
    private static final int TEXTO_VENCIDA = Color.parseColor("#E2786C");

    private static final class Fila {
        final boolean esArea;
        final String titulo, sub, fecha, id;
        final boolean vencida;

        Fila(boolean esArea, String titulo, String sub, String fecha, boolean vencida, String id) {
            this.esArea = esArea; this.titulo = titulo; this.sub = sub; this.fecha = fecha; this.vencida = vencida; this.id = id;
        }
    }

    private static final class Filas implements RemoteViewsFactory {
        private final Context ctx;
        private final int widget;
        private final List<Fila> filas = new ArrayList<>();
        private boolean compacto;

        Filas(Context ctx, int widget) {
            this.ctx = ctx;
            this.widget = widget;
        }

        @Override public void onCreate() { }
        @Override public void onDestroy() { filas.clear(); }

        @Override
        public void onDataSetChanged() {
            filas.clear();
            compacto = "compacto".equals(TareasWidget.modo(ctx, widget));
            String lista = TareasWidget.lista(ctx, widget);
            String hoy = Avisos.Fechas.hoy(), enUnaSemana = Avisos.Fechas.dentroDe(7);
            JSONObject datos = Avisos.tareas(ctx);

            // Áreas en el orden de la app; las tareas de cada una ordenadas por fecha y hora.
            Map<String, List<JSONObject>> porArea = new LinkedHashMap<>();
            JSONArray areas = datos.optJSONArray("areas");
            for (int i = 0; areas != null && i < areas.length(); i++) porArea.put(areas.optString(i), new ArrayList<>());
            JSONArray tareas = datos.optJSONArray("tareas");
            for (int i = 0; tareas != null && i < tareas.length(); i++) {
                JSONObject t = tareas.optJSONObject(i);
                if (t == null) continue;
                String f = t.optString("fecha"), area = t.optString("area");
                boolean entra;
                if (lista.equals("hoy")) entra = !f.isEmpty() && f.compareTo(hoy) <= 0;
                else if (lista.equals("semana")) entra = !f.isEmpty() && f.compareTo(enUnaSemana) <= 0;
                else if (lista.startsWith("area:")) entra = area.equals(lista.substring(5));
                else entra = true;
                if (!entra) continue;
                if (!porArea.containsKey(area)) porArea.put(area, new ArrayList<>());
                porArea.get(area).add(t);
            }
            for (Map.Entry<String, List<JSONObject>> e : porArea.entrySet()) {
                if (e.getValue().isEmpty()) continue;
                e.getValue().sort((a, b) -> {
                    String fa = a.optString("fecha"), fb = b.optString("fecha");
                    if (fa.isEmpty() != fb.isEmpty()) return fa.isEmpty() ? 1 : -1;   // sin fecha al final
                    int c = fa.compareTo(fb);
                    return c != 0 ? c : (a.optString("hora", "99") + "").compareTo(b.optString("hora", "99"));
                });
                if (!lista.startsWith("area:")) filas.add(new Fila(true, e.getKey(), "", "", false, ""));
                for (JSONObject t : e.getValue()) {
                    String f = t.optString("fecha"), hora = t.optString("hora"), proyecto = t.optString("proyecto");
                    String sub = proyecto + (!proyecto.isEmpty() && !hora.isEmpty() ? " · " : "") + hora;
                    filas.add(new Fila(false, t.optString("titulo"), sub, Avisos.Fechas.corta(f),
                            !f.isEmpty() && f.compareTo(hoy) < 0, t.optString("id")));
                }
            }
        }

        @Override public int getCount() { return filas.size(); }

        @Override
        public RemoteViews getViewAt(int pos) {
            if (pos >= filas.size()) return null;
            Fila f = filas.get(pos);
            if (f.esArea) {
                RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_area);
                v.setTextViewText(R.id.w_area, f.titulo);
                return v;
            }
            RemoteViews v = new RemoteViews(ctx.getPackageName(), compacto ? R.layout.widget_tarea_compacta : R.layout.widget_tarea);
            v.setTextViewText(R.id.w_titulo, f.titulo);
            v.setTextViewText(R.id.w_fecha, f.fecha);
            v.setTextColor(R.id.w_fecha, f.vencida ? TEXTO_VENCIDA : TEXTO_FECHA);
            if (!compacto) {
                v.setTextViewText(R.id.w_sub, f.sub);
                v.setViewVisibility(R.id.w_sub, f.sub.isEmpty() ? View.GONE : View.VISIBLE);
            }
            v.setOnClickFillInIntent(R.id.w_fila, new Intent().putExtra(MainActivity.EXTRA_ACCION, "abrir-tarea:" + f.id));
            return v;
        }

        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 3; }
        @Override public long getItemId(int pos) { return pos; }
        @Override public boolean hasStableIds() { return false; }
    }
}
