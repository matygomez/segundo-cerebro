package ar.matygomez.segundocerebro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// Las alarmas de Avisos, y el arranque del teléfono (Android borra las alarmas al apagarse).
public class AlarmaReceptor extends BroadcastReceiver {

    static final String DIARIO = "ar.matygomez.segundocerebro.DIARIO";
    static final String TAREA = "ar.matygomez.segundocerebro.TAREA";
    static final String POSPONER = "ar.matygomez.segundocerebro.POSPONER";
    static final String MEDIANOCHE = "ar.matygomez.segundocerebro.MEDIANOCHE";
    static final String EXTRA_ID = "id";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String accion = intent.getAction();
        String id = intent.getStringExtra(EXTRA_ID);
        if (DIARIO.equals(accion)) {
            Avisos.mostrarDiario(ctx);
            Avisos.reprogramar(ctx);   // el de mañana
        } else if (TAREA.equals(accion)) {
            if (id != null) Avisos.mostrarTarea(ctx, id);
        } else if (POSPONER.equals(accion)) {
            if (id != null) Avisos.posponer(ctx, id);
        } else if (MEDIANOCHE.equals(accion)) {
            TareasWidget.actualizarTodos(ctx);
            Avisos.reprogramar(ctx);
        } else {
            // Teléfono recién prendido o app actualizada.
            Avisos.reprogramar(ctx);
            Avisos.mostrarFija(ctx);
            TareasWidget.actualizarTodos(ctx);
        }
    }
}
