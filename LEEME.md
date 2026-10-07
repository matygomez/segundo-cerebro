# Segundo Cerebro

App personal (PWA) que funciona en el celular y en la PC, sin internet, y guarda todo en tu Google Drive.

## Estado actual: versión 0.3.0, núcleo y módulo Tareas completo

Lo que ya funciona:

- **Guardado local:** todo se guarda primero en el dispositivo, así la app abre al instante y funciona sin internet.
- **Sincronización con Drive:** sube y baja los cambios, une las ediciones del celular y la PC registro por registro, y lo borrado no vuelve a aparecer. Si se borra la carpeta en Drive, la app la rehace.
- **Módulos independientes:** cada módulo tiene su carpeta, sus datos y su dirección propia. Ninguno usa el código de otro.
- **Inicio:** fecha, captura rápida y los bloques y accesos que ofrezca cada módulo.
- **Motor de formularios:** dibuja formularios a partir de una descripción (texto, párrafo, número, fecha, hora, lista, casilla).
- **Ajustes:** estado de Drive, sincronizar, instalar la app y borrar los datos del dispositivo.
- **Instalable y sin conexión:** se instala como app y abre sin internet.

**Módulo Tareas:**

- Pantalla principal: Hoy (con las vencidas arriba) o Próximos, y debajo el árbol de Áreas: Bandeja de entrada, áreas, proyectos y secciones.
- Áreas, proyectos y secciones se crean a mano; se pueden renombrar, reordenar y archivar.
- Dentro de la bandeja, las áreas, los proyectos y las secciones, las tareas se ordenan a mano arrastrando la manija (⋮⋮). En Hoy y Próximos se ordenan por fecha.
- Tareas con título, notas, subtareas (visibles en la lista, plegables), fecha y hora, fecha de inicio, repetición, etiquetas, duración, recordatorio, adjuntos y comentarios.
- Adjuntos: subir archivos (se guardan en `Segundo Cerebro/tareas/adjuntos`) o elegir uno de Drive con el selector de Google. Sin conexión quedan en espera y se suben solos.
- Comentarios con fecha y hora, editables. Cada uno se guarda por separado, así no se pisan entre dispositivos.
- Filtros guardados (ícono arriba a la derecha) y búsqueda por texto o #etiqueta.
- En Inicio: bloque con las tareas de hoy y vencidas, botón Nueva tarea y captura rápida (llega a la Bandeja).
- Acción `crear-tarea` para que otros módulos creen tareas.

Publicada en https://matygomez.github.io/segundo-cerebro/

## Estructura

```
index.html              página principal
manifest.webmanifest    datos para instalarla como app
sw.js                   funcionamiento sin internet y actualizaciones
css/app.css             estilos (claro y oscuro)
icons/                  íconos de la app
js/config.js            configuración y lista de módulos
js/app.js               arranque, menú y navegación
js/core/                el núcleo
  db.js                 base de datos del dispositivo
  datos.js              datos para los módulos (cada uno ve solo lo suyo)
  fusion.js             regla para unir cambios de distintos dispositivos
  drive.js              conexión con Google Drive
  sincronizacion.js     cuándo y cómo se sincroniza
  registro.js           registro de módulos y mensajes entre módulos
  formularios.js        motor de formularios
  ajustes.js            pantalla de Ajustes
  archivos.js           subida de adjuntos y selector de Google
  ui.js                 piezas de interfaz compartidas
modules/home/           módulo Inicio
modules/tareas/         módulo Tareas (modelo, vistas, editor y estilos)
```

## En tu Drive

```
Segundo Cerebro/
  <modulo>/
    <coleccion>.json
```

Los archivos son JSON legibles. Cada registro guarda su id, sus datos, las fechas de creación y modificación, y si está borrado.

## Cómo se suma un módulo

1. Crear la carpeta `modules/<id>/` con un `modulo.js` (el formato está explicado al principio de `js/core/registro.js`).
2. Agregar una línea en `MODULOS` dentro de `js/config.js`.
3. Agregar sus archivos a la lista de `sw.js` y subir la versión.
