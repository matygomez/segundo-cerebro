# Pruebas (Playwright, Python)

```bash
pip install playwright --break-system-packages   # si falta; Chromium suele venir instalado
cd <repo> && python3 -m http.server 8765 &        # sirve la app (sin js/config.js arranca "Sin Drive": sirve para probar)
cd pruebas && mkdir -p capturas
TZ=America/Argentina/Buenos_Aires python3 test_020.py   # cada prueba imprime "N ok M fallas"
```
Corré solo las del módulo que tocaste (ahorra tiempo y tokens). Las capturas quedan en `capturas/` (no se suben).

| Módulo | Pruebas |
|---|---|
| Tareas | test_tareas, test_t110, test_0211, test_013, test_014, test_widget_ventana |
| Finanzas | test_015 (también Calendario) |
| Bitácora / Filmoteca | test_bit, test_bit2, test_bit3, test_bit4, test_espejo, test_film, test_ordenar, test_carpeta |
| Inicio / Ajustes | test_018, test_019, test_inicio_pc (PC) |
| Hábitos y metas + Planificador | test_020 |
| Resumen + búsqueda | test_021, test_resumen_dia |
| Foco / teclado | test_foco |
| Compras | test_compras |

Fallas conocidas por cambios aprobados (no son errores de la app; actualizar la prueba si la tocás):
0.42: test_018, test_021, test_resumen_dia y test_tareas buscan el Inicio y Tareas viejos del celular (ahora usan las pantallas de la PC en una columna; lo nuevo lo prueba test_inicio_pc).
Sin servidor local: `python3 correr-py-sin-servidor.py test_x.py` (en project files, tareas-pc/pruebas).
test_019 (orden de fábrica del Inicio ahora incluye aviso del Resumen, búsqueda y Hábitos), test_015 y test_foco
(el Calendario abre en Semana y la barra del celular está llena).
