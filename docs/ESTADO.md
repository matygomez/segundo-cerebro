# Estado de cada módulo
Leé solo la sección que vas a tocar. Al terminar, actualizá sus 1–3 líneas.

## Núcleo (`js/core/`, `js/app.js`, `sw.js`)
Sincronización Drive (cada colección = un JSON), registro de módulos, formularios, editor de texto, búsqueda general (lupa, Ctrl+K, barra del Inicio),
Ajustes (módulos visibles, barra del celular máx. 5, Inicio). En el celular, tocar el logo abre un panel con todos los módulos (en PC va al Inicio). Pantalla de error con "Forzar actualización". SW baja archivos con `?v=VERSION`.

## Inicio (`modules/home`)
Fecha, memento mori (estilos mezcla/barras/contador/años, frase; se puede apagar), botones rápidos, búsqueda, captura "Anotá algo", bloques de módulos.
Todo configurable en Ajustes › Inicio (`js/core/inicio.js`, `js/core/ajustes-inicio.js`).

## Tareas (`modules/tareas`)
Áreas, proyectos, secciones, subtareas, repetición, papelera 30 días, sistemas (tareas creadas por otros módulos). Repetidas guardan `completadas[]`.
Una sola fecha: la casilla "Ocultar hasta ese día" (guarda `inicio` = fecha) la esconde hasta ese día; se ven en "N programadas" de cada lista y de Próximos.
Configurar → Hojas: switch "Ocultar si está vacía" por hoja (`vacia` en la config de hojas); sin pendientes la pestaña no aparece, salvo si estás en ella.
Acciones: `abrir-tarea, crear-tarea, tarea-completar, tarea-fecha, tarea-borrar, tareas-sin-fecha, calendario-items, metas-proyectos, metas-proyecto,
resumen-tareas, resumen-vencidas, sistema-pendientes, sistema-sincronizar`.

## Finanzas (`modules/finanzas`)
Cuentas, créditos en cuotas, categorías con presupuesto, movimientos, préstamos, disponible, análisis.
Crédito: "Controlar resumen" por tarjeta (tildar gastos/cuotas, total del banco, agregar faltante; `control.js`; Repartir muestra "Máximo pendiente", guarda `movimientos.controlado` y `creditos.totalBanco`).
Acciones: `recordatorio-estado, recordatorio-pagar, nuevo-gasto, metas-cuentas, metas-valor, resumen-finanzas`.

## Bitácora (`modules/bitacora`)
Carpetas y bases (campos tipo Notion), notas Markdown, plantillas, recordatorios, espejo .md en Drive, Filmoteca (TMDB).
Archivos para revisar (`ordenar.js`, `#/bitacora/pendientes`): subir/arrastrar/Compartir → Gemini (clave en Configurar) propone nombre, carpeta y datos → confirmás; nota con `archivo` + PDF al lado en Drive; tarea por vencimiento, gasto en Finanzas (`nuevo-gasto`), repetidos por huella. Cargas mensuales en Configurar → tareas `bitacora-mes:` en Sistemas › Bitácora.
Acciones: `abrir-nota, metas-carpetas, metas-contar, resumen-bitacora, gemini-preguntar, gemini-hay-clave`.

## Calendario (`modules/calendario`, fuera de la barra del celular)
Semana = Planificador semanal (`semana.js`: "Para planificar" fijo aparte en PC (solo los días se deslizan), arrastrar en PC, chips de días en celular, premios, foco de la semana) y Mes.
Bloque Inicio "Esta semana": tocar un día baja a sus tareas. Títulos largos se cortan con "…".

## Hábitos y metas (`modules/habitos`)
Hoy (pendientes de días anteriores; tocar = hecho; deslizar ← no / → descanso con confirmación; lo marcado se agrupa y se corrige desde el historial),
Hábitos, Metas (a mano, hitos, hábito, Bitácora, Finanzas, Tareas; ritmo), Estadísticas (carrusel, mapa 6 meses), Configurar.
Acciones: `resumen-habitos, resumen-rachas, resumen-metas`.

## Resumen (`modules/resumen`)
Hoy (`dia.js`: tiempo Open-Meteo por GPS o ciudad, tareas/vencimientos/hábitos de hoy, cumpleaños, titulares de Google Noticias 1 vez por día explicados por Gemini (clave de Bitácora, sin búsqueda); aprende por tema), Semana (revisión guiada de 7 pasos con foco), Mes (KPIs, lo mejor, gastos, hábitos, áreas, cierre), Estadísticas, Configurar (nombre del saludo, hora, lugar, intereses y sugeridos, "Relanzar el panel").
Inicio: un cuadro fijo arriba de todo (`arriba` en `js/core/inicio.js`) que se desliza mes → semana → día; mes/semana hasta abrirlo o cerrarlo, día (desde la hora de Configurar) hasta "Ver mi día"/"Ahora no". Guarda `revisiones` (tipo `dia` con noticias) y `ajustes`. Acción: `resumen-foco`. Pide `cumpleanos`/`abrir-cumpleanos` a Tareas si existen.

## Compras (`modules/compras`)
Todo por **tipo** sin marca ni tamaño ("Leche entera", en L/kg/u.); cada producto tiene tipo y contenido (Sancor 750 ml = 0,75 L). Pestañas Lista (pendientes por tipo, lista del mes/base arriba, sugeridas ✦ por consumo) · Despensa (+ Recuento) · Comidas (programadas, falta ordenado por fecha, recetario; receta a mano o pegada → Gemini) · Informe (mes + resumen Gemini) · ⚙ Ajustes (productos, orden de sectores, súpers).
Súper: "Empezar la compra" elige dónde y qué parte de la lista (recuerda sectores por súper); escáner BarcodeDetector/zxing, Open Food Facts, Precios Claros (sin probar desde el navegador); lo escaneado suma al tipo de la lista o va "fuera de lista". Guardar: gasto vía `nuevo-gasto` de Finanzas + despensa. Acción: `compras-resumen`.

