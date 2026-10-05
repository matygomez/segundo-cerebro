// Bus de eventos mínimo. El núcleo avisa cambios y las pantallas escuchan.
const oyentes = new Map();

export function escuchar(nombre, fn) {
  if (!oyentes.has(nombre)) oyentes.set(nombre, new Set());
  oyentes.get(nombre).add(fn);
  return () => oyentes.get(nombre)?.delete(fn);
}

export function emitir(nombre, dato) {
  for (const fn of oyentes.get(nombre) || []) {
    try { fn(dato); } catch (e) { console.error(`Error en oyente de "${nombre}"`, e); }
  }
}
