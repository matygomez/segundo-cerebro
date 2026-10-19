# Estado de cada módulo
Leé solo la sección que vas a tocar. Al terminar, actualizá sus 1–3 líneas.

## Núcleo (`js/core/`, `js/app.js`, `sw.js`)
Sincronización Drive (cada colección = un JSON), registro de módulos, formularios, editor de texto, búsqueda general (lupa, Ctrl+K, barra del Inicio),
Ajustes (módulos visibles, barra del celular máx. 5, Inicio). Pantalla de error con "Forzar actualización". SW baja archivos con `?v=VERSION`.

## Inicio (`modules/home`)
Fecha, memento mori (estilos mezcla/barras/contador/años, frase; se puede apagar), botones rápidos, búsqueda, captura "Anotá algo", bloques de módulos.
Todo configurable en Ajustes › Inicio (`js/core/inicio.js`, `js/core/ajustes-inicio.js`).

## Tareas (`modules/tareas`)
Áreas, proyectos, secciones, subtareas, repetición, papelera 30 días, sistemas (tareas creadas por otros módulos). Repetidas guardan `completadas[]`.
Una sola fecha: la casilla "Ocultar hasta ese día" (guarda `inicio` = fecha) la esconde hasta ese día; se ven en "N programadas" de cada lista y de Próximos.
Acciones: `abrir-tarea, crear-tarea, tarea-completar, tarea-fecha, tarea-borrar, tareas-sin-fecha, calendario-items, metas-proyectos, metas-proyecto,
resumen-tareas, resumen-vencidas, sistema-pendientes, sistema-sincronizar`.

## Finanzas (`modules/finanzas`)
Cuentas, créditos en cuotas, categorías con presupuesto, movimientos, préstamos, disponible, análisis.
Crédito: "Controlar resumen" por tarjeta (tildar gastos/cuotas, total del banco, agregar faltante; `control.js`, guarda `movimientos.controlado` y `creditos.totalBanco`).
Acciones: `recordatorio-estado, recordatorio-pagar, metas-cuentas, metas-valor, resumen-finanzas`.

## Bitácora (`modules/bitacora`)
Carpetas y bases (campos tipo Notion), notas Markdown, plantillas, recordatorios, espejo .md en Drive, Filmoteca (TMDB).
Acciones: `abrir-nota, metas-carpetas, metas-contar, resumen-bitacora`.

## Calendario (`modules/calendario`, fuera de la barra del celular)
Semana = Planificador semanal (`semana.js`: "Para planificar", arrastrar en PC, chips de días en celular, premios, foco de la semana) y Mes.
Bloque Inicio "Esta semana": tocar un día baja a sus tareas.

## Hábitos y metas (`modules/habitos`)
Hoy (pendientes de días anteriores; tocar = hecho; deslizar ← no / → descanso con confirmación; lo marcado se agrupa y se corrige desde el historial),
Hábitos, Metas (a mano, hitos, hábito, Bitácora, Finanzas, Tareas; ritmo), Estadísticas (carrusel, mapa 6 meses), Configurar.
Acciones: `resumen-habitos, resumen-rachas, resumen-metas`.

## Resumen (`modules/resumen`)
Semana (revisión guiada de 7 pasos con foco), Mes (KPIs, lo mejor, gastos, hábitos, áreas, cierre), Estadísticas (3/6/12 meses, récords, "qué va con qué").
Aviso en el Inicio al terminar semana (domingo) y mes (día 1) hasta abrirlo o cerrarlo. Guarda solo `revisiones`. Acción: `resumen-foco`.
