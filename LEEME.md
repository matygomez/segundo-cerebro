# Segundo Cerebro

App personal (PWA) que funciona en el celular y en la PC, sin internet, y guarda todo en tu Google Drive.

## Estado actual: versión 0.1.0, el núcleo

Lo que ya funciona:

- **Guardado local:** todo se guarda primero en el dispositivo, así la app abre al instante y funciona sin internet.
- **Sincronización con Drive:** sube y baja los cambios, une las ediciones del celular y la PC registro por registro, y lo borrado no vuelve a aparecer. Si se borra la carpeta en Drive, la app la rehace.
- **Módulos independientes:** cada módulo tiene su carpeta, sus datos y su dirección propia. Ninguno usa el código de otro.
- **Inicio:** fecha, captura rápida y los bloques y accesos que ofrezca cada módulo.
- **Motor de formularios:** dibuja formularios a partir de una descripción (texto, párrafo, número, fecha, hora, lista, casilla).
- **Ajustes:** estado de Drive, sincronizar, instalar la app y borrar los datos del dispositivo.
- **Instalable y sin conexión:** se instala como app y abre sin internet.

Lo que falta para usarla con Drive: completar `GOOGLE_CLIENT_ID` en `js/config.js` y publicarla en internet (gratis). Son los próximos pasos de la guía.

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
  ui.js                 piezas de interfaz compartidas
modules/home/           módulo Inicio
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
