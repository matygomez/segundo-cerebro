// ─────────────────────────────────────────────────────────────
// Fusión de registros. No depende de nada: se prueba aislada.
//
// Cada registro tiene: id, datos, creado, modificado, borrado, dispositivo.
// Regla: por cada id gana la versión con "modificado" más reciente.
// Si empatan, gana la marcada como borrada; si sigue el empate,
// decide el id de dispositivo, así todos los equipos llegan
// exactamente al mismo resultado.
// ─────────────────────────────────────────────────────────────

export function ganador(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.modificado !== b.modificado) return a.modificado > b.modificado ? a : b;
  if (!!a.borrado !== !!b.borrado) return a.borrado ? a : b;
  return (a.dispositivo || '') >= (b.dispositivo || '') ? a : b;
}

// Une dos listas de registros. Devuelve la lista fusionada, ordenada por id.
export function fusionar(locales = [], remotos = []) {
  const mapa = new Map();
  for (const r of [...locales, ...remotos]) {
    if (!r || typeof r.id !== 'string' || typeof r.modificado !== 'number') continue;
    mapa.set(r.id, ganador(mapa.get(r.id), r));
  }
  return [...mapa.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

// ¿Son la misma lista? Sirve para no subir archivos sin cambios.
export function sonIguales(a = [], b = []) {
  if (a.length !== b.length) return false;
  const mb = new Map(b.map(r => [r.id, r]));
  return a.every(r => {
    const o = mb.get(r.id);
    return o && o.modificado === r.modificado && !!o.borrado === !!r.borrado && o.dispositivo === r.dispositivo;
  });
}
