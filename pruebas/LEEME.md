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
| Tareas | test_tareas, test_t110, test_0211, test_013, test_014 |
| Finanzas | test_015 (también Calendario) |
| Bitácora / Filmoteca | test_bit, test_bit2, test_bit3, test_bit4, test_espejo, test_film, test_ordenar |
| Inicio / Ajustes | test_018, test_019 |
| Hábitos y metas + Planificador | test_020 |
| Resumen + búsqueda | test_021, test_resumen_dia |
| Foco / teclado | test_foco |

Fallas conocidas por cambios aprobados (no son errores de la app; actualizar la prueba si la tocás):
test_019 (orden de fábrica del Inicio ahora incluye aviso del Resumen, búsqueda y Hábitos), test_015 y test_foco
(el Calendario abre en Semana y la barra del celular está llena).
