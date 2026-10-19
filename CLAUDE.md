# Segundo Cerebro — leé esto primero (y solo esto, hasta saber qué tocar)

PWA personal de **Matías Gómez** (Argentina, Android + Windows, **no programa**).
App: https://matygomez.github.io/segundo-cerebro/ · repo `matygomez/segundo-cerebro` (GitHub Pages, rama `main`).
JS puro con módulos ES, sin build. IndexedDB local + sincronización con Google Drive. Versión actual: ver `VERSION` en `js/modulos.js`.

## Reglas con Matías (no negociables)
- Hablale en **español rioplatense (vos)**, corto, sin jerga. Él no ve el código: contale lo que va a ver en la app.
- **Antes de cambiar la app, preguntá siempre: ¿vista previa o aplicar directo?** (aunque sea chico).
- Aprobado ("procede", "mandale", "perfecto") → construir, probar, **subir directo a `main`**. Avisar que tarda 1–2 min.
- **Nunca incluir ni tocar `js/config.js`** (sus claves de Google; no está en el repo).

## Ahorro de tokens (prioridad)
1. **No leas todo.** Este archivo + la sección del módulo en `docs/ESTADO.md`. Nada más hasta saber qué archivo tocar.
2. **Buscá con `grep -n`** y leé **rangos** (offset/limit), nunca archivos grandes enteros. Los más grandes:
   `tareas/vistas.js` 1300 l · `finanzas/vistas.js` 740 · `habitos/vistas.js` 715 · `tareas/modelo.js` 690 · `bitacora/filmoteca.js` 680 · `css/app.css` 590.
3. **Vistas previas aprobadas** (`docs/vistas-previas/*.html`, 30–60 KB): no las abras enteras; `grep` la pantalla que vas a construir.
4. **Editá con Edit puntual**, no reescribas archivos. Un módulo nuevo sí se escribe entero (y de una).
5. **Pruebas:** corré solo las del módulo tocado (`pruebas/LEEME.md`). Suite completa solo si tocaste `js/core/`.
   Mirá 1–2 capturas por tamaño (390 y 1366 px), recortadas si hace falta.
6. **Vistas previas nuevas:** un HTML chico, reusando el CSS base de una previa existente; datos de ejemplo mínimos.
7. **Al terminar**, actualizá en `docs/ESTADO.md` solo las 1–3 líneas del módulo que cambiaste (y `docs/PENDIENTES.md` si corresponde). Sin historiales largos.
8. Respuestas finales a Matías: pocas líneas.

## Arquitectura (respetar)
- **Módulos independientes:** un módulo **nunca importa código de otro**. Usa solo `ctx`; lo de otro lo pide con `ctx.pedir('accion', datos)` / `ctx.existeAccion`.
- Registro: `js/modulos.js` (`MODULOS` + `VERSION`). Contrato del módulo arriba de `js/core/registro.js`:
  `pantalla, acciones, alIniciar, bloquesInicio, botonesInicio, capturar, buscar, archivoSubido`.
- `ctx`: `datos(nombre)` (listar/crear/actualizar/borrar), `alCambiarDatos`, `alCambiarDatosDe(otro)`, `pedir`, `existeAccion`, `navegar`, `h`, `icono`,
  `aviso(t,{accion,alTocar,duracion})`, `confirmar(t,{si,no,peligro})`→bool, `formulario`, `editorTexto`, `busqueda.{abrir,barra}`, `inicio.{armar,alCambiar}`.
- `bloquesInicio`: `{id,titulo,enlace,ancho:'mitad'|'completo',opciones,sinMarco?,dibujar(cont,{opciones})}`. Inicio armado en `js/core/inicio.js`.
- Búsqueda: `js/core/busqueda.js`; cada módulo exporta `buscar(texto, ctx, {coincide, fragmento})`.
- Tema siempre oscuro: `--papel #0B0B0C --superficie #1B1C1E --superficie-2 #242528 --linea #2E3033 --laton #D3AB5C` (acento amarillo). Barlow / Barlow Condensed.
  Iconos SVG en `js/core/ui.js` (TRAZOS). CSS de cada módulo en su carpeta, cargado por el módulo.
- Código: nombres y comentarios en español, comentarios que explican el porqué, funciones chicas.

## Publicar una versión
1. Subir `VERSION` en **`js/modulos.js`** y **`sw.js`** (`sc-X.Y.Z`); archivos nuevos → lista `ARCHIVOS` de `sw.js`.
2. `git pull --rebase origin main` (puede haber otro hilo trabajando), probar, commit con
   `git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit`, `git push origin main`.
   Si chocan las versiones con otro hilo: quedate con la más alta +1.
3. Mensaje del commit: `X.Y.Z: qué cambió` + las líneas de atribución que pida la sesión.

## Varios hilos a la vez
Un hilo por módulo. Cambios en `js/core/` o `css/app.css`: de a uno. Siempre `git pull --rebase` al empezar y antes de subir.

## Dónde está cada cosa
- `docs/ESTADO.md` — qué hace cada módulo hoy y sus acciones (`ctx.pedir`).
- `docs/PENDIENTES.md` — próximo trabajo (Compras) e ideas.
- `docs/compras.md` — especificación del módulo Compras (aprobada).
- `docs/vistas-previas/` — vistas previas aprobadas (Compras, Hábitos, Planificador, Resumen/Búsqueda).
- `pruebas/` — pruebas Playwright y cómo correrlas.
- `LEEME.md` — texto viejo para humanos; **no hace falta leerlo**.
