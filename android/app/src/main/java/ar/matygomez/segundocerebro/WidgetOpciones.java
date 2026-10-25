package ar.matygomez.segundocerebro;

import android.app.Activity;
import android.app.AlertDialog;
import android.appwidget.AppWidgetManager;
import android.os.Bundle;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.List;

// Al tocar "Hoy ▾" en el widget: qué lista mostrar y si va compacto o ampliado.
public class WidgetOpciones extends Activity {

    @Override
    protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        int id = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) { finish(); return; }

        List<String> listas = new ArrayList<>();
        List<String> nombres = new ArrayList<>();
        agregar(listas, nombres, "hoy", "Hoy y vencidas");
        agregar(listas, nombres, "semana", "Próximos 7 días");
        agregar(listas, nombres, "todas", "Todas");
        JSONArray areas = Avisos.tareas(this).optJSONArray("areas");
        for (int i = 0; areas != null && i < areas.length(); i++) agregar(listas, nombres, "area:" + areas.optString(i), areas.optString(i));
        boolean compacto = "compacto".equals(TareasWidget.modo(this, id));
        agregar(listas, nombres, "modo", compacto ? "Ver ampliado (con proyecto y hora)" : "Ver compacto (solo el título)");

        new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Widget de tareas")
                .setItems(nombres.toArray(new String[0]), (d, i) -> {
                    String elegida = listas.get(i);
                    if (elegida.equals("modo")) TareasWidget.elegir(this, id, null, compacto ? "ampliado" : "compacto");
                    else TareasWidget.elegir(this, id, elegida, null);
                })
                .setOnDismissListener(d -> finish())
                .show();
    }

    private static void agregar(List<String> listas, List<String> nombres, String lista, String nombre) {
        listas.add(lista);
        nombres.add(nombre);
    }
}
