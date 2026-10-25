package ar.matygomez.segundocerebro;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

// Botones del panel de arriba (ajustes rápidos): cada uno abre su ventanita.
// Cada botón es una clase aparte porque Android los agrega de a uno.
public final class Botones {

    private Botones() { }

    abstract static class Base extends TileService {
        abstract String ventana();

        @Override
        public void onStartListening() {
            Tile t = getQsTile();
            if (t == null) return;
            t.setState(Tile.STATE_INACTIVE);
            t.updateTile();
        }

        @Override
        public void onClick() {
            if (isLocked()) unlockAndRun(this::abrir);
            else abrir();
        }

        @SuppressWarnings("deprecation")
        private void abrir() {
            Intent i = VentanaActivity.intent(this, ventana());
            if (Build.VERSION.SDK_INT >= 34) {
                startActivityAndCollapse(PendingIntent.getActivity(this, ventana().hashCode(), i,
                        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
            } else {
                startActivityAndCollapse(i);
            }
        }
    }

    public static class Finanzas extends Base {
        @Override String ventana() { return "finanzas"; }
    }

    public static class Tarea extends Base {
        @Override String ventana() { return "tarea"; }
    }

    public static class Anotar extends Base {
        @Override String ventana() { return "anotar"; }
    }
}
