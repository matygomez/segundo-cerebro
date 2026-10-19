# Módulo Compras: especificación aprobada
Vista previa: `docs/vistas-previas/compras.html` (buscá con `grep -n "function lista\|function superm\|function desc\|function desp\|function recuento\|function comidas\|function sug\|function datos"`).
Por ahora lo usa solo Matías; dejarlo preparado para compartir la lista más adelante.
Pestañas: **Lista · Despensa · Comidas · Mes · Datos** (+ pantallas En el súper, Descuentos, Recuento).

- **Lista:** compacta (una línea por producto, agrupada por sector del súper, orden de sectores editable). Sugeridas con ✦; tocar muestra el motivo
  y el último precio. Barra fija abajo con cantidad, total estimado y "Empezar la compra". Por vencer al costado (PC).
- **En el súper:** total arriba. Escanear código (BarcodeDetector en Android; si no, zxing). Nombre/marca desde **Open Food Facts**; si no está, se carga
  a mano una vez. Precio: referencia de **Precios Claros** (SEPA; **verificar CORS desde el navegador**, si no se puede, solo último precio pagado),
  último pagado (+% desde entonces) u otro. Cantidad, vencimiento opcional, lugar. Si estaba en la lista, se tilda. Carrito y "Te falta" compactos;
  lo sin código se tilda y pide precio.
- **Descuentos:** un monto por producto ("$ 2.000 − $ 500 = $ 1.500") y **un solo total** para tarjeta/banco/billetera. Guardar: gasto a Finanzas
  (cuenta y categoría elegibles, vía `ctx.pedir` a una acción nueva de Finanzas) + productos a la Despensa con vencimientos.
- **Despensa:** por lugar (heladera, alacena, freezer, limpieza, baño, otros). Fila compacta con cantidad y **"−" directo**. Tocar el nombre:
  +1, se terminó, se tiró (motivo: venció, se echó a perder, no gustó), vencimiento, 👍 comprar más, 👎 no nos gustó, nota.
  Aviso arriba si hay productos sin fecha de vencimiento (filtro "Sin vencimiento").
- **Recuento por lugar:** elegir lugar (muestra "x de y" o "✓ contado"), escanear suma 1, ✓ = igual, −/+ a mano, diferencia por fila.
  "Aplicar y seguir con otro lugar" (opción: lo no contado a 0). Los ajustes quedan anotados para corregir el cálculo de consumo.
- **Comidas:** programadas del mes con "La hice" (descuenta ingredientes de la despensa, corregible). **Recetario** con todas las recetas
  (buscar, veces hecha, "📅 Programar" con fecha y porciones). Tocar una receta abre su ficha: porciones, ingredientes editables con
  "tenés/falta", preparación. "Para las programadas te falta" → a la lista.
- **Mes:** **lista base** mensual con cambios sugeridos (sumar, bajar, sacar, nuevo; cada uno con motivo) para aceptar uno por uno,
  "Armar la lista del mes", opción de guardar los cambios en la base. Lo tirado (con $), gastado, ahorrado en promos, compras, precio de un producto
  en el tiempo, dónde conviene (misma lista por súper), más comprados.
- **Datos:** catálogo (míos / del sistema; filtros sin precio, sin duración), ficha editable (nombre, marca, código, sector, lugar, duración,
  unidad, origen), precios pagados, consumo, unir con otro, borrar.
- Inicio: bloque con por vencer y faltantes. Sugerencias calculadas con el consumo (compras − despensa), recuentos y comidas.
