// ─────────────────────────────────────────────────────────────
// Compras: recuento de la despensa por lugar.
// Elegís un lugar, contás (escaneando suma 1, ✓ = está igual, −/+ a
// mano) y "Aplicar" corrige la despensa. Los ajustes quedan anotados
// en consumo, así el cálculo de cuánto dura cada cosa se corrige solo.
// ─────────────────────────────────────────────────────────────

import { LUGARES, cant } from './modelo.js';
import { poner, productoDeCodigo, grupo } from './comun.js';
import { escanear } from './externos.js';
import { iconoScan } from './vistas.js';

// Lo contado: { despensaId: cantidad }, productos nuevos por lugar y lugares ya aplicados hoy.
const rec = { lugar: 'Heladera', cuentas: {}, nuevos: {}, aplicados: new Set(), ceroNoContado: false, dia: '' };

export function pintarRecuento(cuerpo, ctx, m, d, repintar) {
  const { h } = ctx;
  const hoy = new Date().toDateString();
  if (rec.dia !== hoy) Object.assign(rec, { cuentas: {}, nuevos: {}, aplicados: new Set(), dia: hoy });
  const de = (l) => d.despensa.filter(x => x.lugar === l);
  const contados = (l) => de(l).filter(x => rec.cuentas[x.id] !== undefined).length;
  const l = de(rec.lugar);
  const nuevos = rec.nuevos[rec.lugar] || {};

  // Los − y + van de a una unidad, o de a un envase de tu producto de siempre.
  const paso = (x) => d.baseDe(x.tipoId) === 'u.' ? 1 : (d.preferido(x.tipoId)?.contenido || 0.5);
  const contar = (x, que) => {
    const c = rec.cuentas[x.id];
    rec.cuentas[x.id] = que === '=' ? Number(x.cantidad) : Math.max(0, Math.round(((c ?? Number(x.cantidad)) + (que === '+' ? 1 : -1) * paso(x)) * 1000) / 1000);
    repintar();
  };

  // Cada lectura suma 1. Lo que estaba en otro lugar se pregunta al cerrar.
  const escanearAca = async () => {
    const otros = [], desconocidos = [];
    await escanear(ctx, { titulo: `Contando ${rec.lugar.toLowerCase()}: cada lectura suma 1`, continuo: true, alLeer: (codigo) => {
      const p = d.porCodigo(codigo);
      const x = p && l.find(y => y.tipoId === p.tipoId);
      if (x) rec.cuentas[x.id] = Math.round(((rec.cuentas[x.id] ?? 0) + (p.contenido || 1)) * 1000) / 1000;
      else if (p && d.despensa.some(y => y.tipoId === p.tipoId)) otros.push(p);
      else if (p) nuevos[p.tipoId] = (nuevos[p.tipoId] || 0) + (p.contenido || 1);
      else desconocidos.push(codigo);
    } });
    for (const p of otros) {
      const y = d.despensa.find(z => z.tipoId === p.tipoId);
      if (await ctx.confirmar(`${d.nombreDe(p.tipoId)} estaba en ${y.lugar.toLowerCase()}. ¿Lo paso a ${rec.lugar.toLowerCase()}?`, { si: 'Pasarlo', no: 'Dejarlo' })) {
        await m.col.despensa.actualizar(y.id, { lugar: rec.lugar });
        rec.cuentas[y.id] = (rec.cuentas[y.id] ?? 0) + (p.contenido || 1);
      }
    }
    for (const c of [...new Set(desconocidos)]) {
      const p = await productoDeCodigo(ctx, m, d, c);
      if (p) nuevos[p.tipoId] = (nuevos[p.tipoId] || 0) + (p.contenido || 1) * desconocidos.filter(z => z === c).length;
    }
    rec.nuevos[rec.lugar] = nuevos;
    repintar();
  };

  const aplicar = async () => {
    let n = 0;
    for (const x of l) {
      const c = rec.cuentas[x.id] ?? (rec.ceroNoContado ? 0 : undefined);
      if (c === undefined || c === Number(x.cantidad)) continue;
      await m.ponerCantidad(x, c, 'ajuste'); n++;
    }
    for (const [tipoId, c] of Object.entries(nuevos)) {
      if (!d.tipo(tipoId) || !c) continue;
      await m.sumarADespensa(d, { tipoId, cantidad: c, lugar: rec.lugar });
      await m.anotar({ tipoId, tipo: 'ajuste', cantidad: c }); n++;
    }
    rec.aplicados.add(rec.lugar);
    for (const x of l) delete rec.cuentas[x.id];
    rec.nuevos[rec.lugar] = {};
    ctx.aviso(n ? `${rec.lugar}: ${n} ajuste${n === 1 ? '' : 's'}` : `${rec.lugar}: estaba todo bien`);
    const sig = LUGARES.map(x => x[0]).find(g => !rec.aplicados.has(g) && de(g).length);
    if (sig) rec.lugar = sig;
    repintar();
  };

  const filaR = (x) => {
    const c = rec.cuentas[x.id], dif = c === undefined ? null : Math.round((c - Number(x.cantidad)) * 1000) / 1000, base = d.baseDe(x.tipoId);
    const corto = (v) => cant(v, base).replace(' u.', '');
    return h('div', { class: `cp-rc${c !== undefined && dif === 0 ? ' ok' : ''}` },
      h('span', { class: 'cp-em' }, d.emojiDe(x.tipoId)), h('span', { class: 'cp-n' }, d.nombreDe(x.tipoId)),
      h('span', { class: 'sis' }, cant(x.cantidad, base)),
      c === undefined ? h('button', { type: 'button', class: 'cp-igual', title: 'Está igual', onclick: () => contar(x, '=') }, '✓') : h('span', { class: 'cp-igual oculto' }, '✓'),
      h('span', { class: 'cp-stp chico' }, h('button', { type: 'button', onclick: () => contar(x, '-') }, '−'), h('b', {}, corto(c ?? x.cantidad)), h('button', { type: 'button', onclick: () => contar(x, '+') }, '+')),
      h('span', { class: `dif ${dif > 0 ? 'mas' : dif < 0 ? 'menos' : ''}` }, dif === null ? '' : dif > 0 ? `+${corto(dif)}` : dif < 0 ? `−${corto(-dif)}` : '='));
  };
  const aj = l.filter(x => rec.cuentas[x.id] !== undefined && rec.cuentas[x.id] !== Number(x.cantidad));
  const listaNuevos = Object.entries(nuevos).filter(([, c]) => c > 0);

  poner(cuerpo,
    h('div', { class: 'cp-lug' }, LUGARES.map(([n, e]) => {
      const t = de(n).length, c = contados(n), listo = rec.aplicados.has(n);
      return h('button', { type: 'button', class: `${rec.lugar === n ? 'sel' : ''}${listo ? ' listo' : ''}`, onclick: () => { rec.lugar = n; repintar(); } },
        h('span', {}, e), n, h('small', {}, listo ? '✓ contado' : t ? `${c} de ${t}` : 'vacío'));
    })),
    h('div', { class: 'cp-cols' },
      h('div', { class: 'cp-col' },
        h('button', { type: 'button', class: 'cp-bt p grande', onclick: escanearAca }, iconoScan(ctx), `Escanear en ${rec.lugar.toLowerCase()}`),
        h('section', { class: 'cp-card apretada' }, grupo(ctx, rec.lugar, 'App · Contado'),
          l.length ? l.map(filaR) : h('p', { class: 'cp-sub' }, 'No hay nada cargado en este lugar. Escaneá lo que encuentres.'),
          listaNuevos.length ? [grupo(ctx, 'Encontrado y no estaba'), listaNuevos.map(([id, c]) => h('div', { class: 'cp-rc' }, h('span', { class: 'cp-em' }, d.emojiDe(id)), h('span', { class: 'cp-n' }, d.nombreDe(id)), h('span', { class: 'dif mas' }, `+${cant(c, d.baseDe(id))}`)))] : null),
        h('p', { class: 'cp-sub' }, 'Cada escaneo suma 1. ✓ = está igual que en la app. Si escaneás algo que la app tenía en otro lugar, te pregunta si lo cambia de lugar.')),
      h('div', { class: 'cp-col' },
        h('section', { class: 'cp-card' }, h('h3', {}, rec.lugar, h('small', {}, `${contados(rec.lugar)} de ${l.length} contados`)),
          h('div', { class: 'cp-cuenta' },
            h('div', {}, h('span', {}, 'Sobran (se suman)'), h('b', { class: 'verde' }, String(aj.filter(x => rec.cuentas[x.id] > x.cantidad).length + listaNuevos.length))),
            h('div', {}, h('span', {}, 'Faltan (se descuentan)'), h('b', { class: 'rojo' }, String(aj.filter(x => rec.cuentas[x.id] < x.cantidad).length))),
            h('div', {}, h('span', {}, 'Sin contar'), h('b', {}, String(l.length - contados(rec.lugar))))),
          h('label', { class: 'cp-fila sin-salto cp-casilla' }, h('input', { type: 'checkbox', checked: rec.ceroNoContado, onchange: (e) => { rec.ceroNoContado = e.target.checked; } }),
            h('span', {}, `Lo que no conté de ${rec.lugar.toLowerCase()}, ponerlo en 0`)),
          h('button', { type: 'button', class: 'cp-bt p grande', onclick: aplicar }, 'Aplicar y seguir con otro lugar'),
          h('p', { class: 'cp-sub' }, 'Podés hacer un lugar hoy y otro mañana. Los ajustes quedan anotados, así el cálculo de consumo se corrige solo.')))));
}
