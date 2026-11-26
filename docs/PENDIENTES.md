# Pendientes

## Compras (0.25.0, recién construido)
Falta probar con datos reales: Precios Claros desde el navegador (si CORS lo bloquea, queda el último precio) y links de recetas (casi todas las webs bloquean leerlas: se pega el texto).

## Ajustes a implementar (pedidos por Matías)
- **Tareas en el celular › Configurar › Hojas** (pedido 2026-11-26): desde 0.42 las pestañas de arriba salen de `columna()` y no respetan la configuración del celular (qué hojas se ven, orden, solo ícono / nombre / ambos, contador, ocultar si está vacía). Volver a aplicarla en la barra de arriba. Ya hay un cambio armado sin subir: project files `celular/pendientes/tareas-hojas-celular.patch` (`hojasDe(d, clave)` en vistas.js, `columna()` de Tareas en el celular arma las pestañas con eso, suma Próximos a la lista, y `pest-cel` en app.js dibuja ícono/nombre según `modo`). Falta probar y preguntar ¿vista previa o directo?

## Pensándolo él (no empezar sin que lo pida)
- **App de Android:** tanda 2 hecha en 0.27.0 (botones, avisos, widget, compartir). Probar en el celular.

## Ideas ofrecidas, sin decidir
Captura inteligente ("gasté 8500 en súper" → gasto), diario con ánimo, registro de tiro, alumnos del curso CLU, notificaciones,
copia de seguridad descargable, salud (peso, sueño), personas (cumpleaños, charlas).

- **Cumpleaños en Tareas** (pedido por Matías): el Resumen ya los muestra si Tareas ofrece `cumpleanos({desde,hasta})` → `[{nombre, edad?}]` y `abrir-cumpleanos`. Falta decidir y armar dónde se cargan en Tareas.
