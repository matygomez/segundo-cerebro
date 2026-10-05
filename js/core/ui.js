// ─────────────────────────────────────────────────────────────
// Herramientas de interfaz compartidas: crear elementos, íconos,
// avisos cortos y ventanas de confirmación.
// ─────────────────────────────────────────────────────────────

// h('button', { class: 'boton', onclick: fn }, 'Texto')
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

// Íconos de trazo, dibujados a mano para no depender de nada externo.
const TRAZOS = {
  inicio: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10 19v-5h4v5"/>',
  tareas: '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  nube: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 18Z"/>',
  'nube-check': '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 18Z"/><path d="m9.5 13.5 2 2 3.5-3.5"/>',
  'nube-off': '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11 3.5 3.5 0 0 0 7 18Z"/><path d="M4 4l16 16"/>',
  girar: '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19 4v4h-4"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  enviar: '<path d="M5 12h13"/><path d="m13 7 5 5-5 5"/>',
  alerta: '<path d="M12 4 3 19h18L12 4Z"/><path d="M12 10v4M12 16.5v.5"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  descargar: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/>',
  punto: '<circle cx="12" cy="12" r="3"/>',
};

export function icono(nombre, clase = 'icono') {
  const span = document.createElement('span');
  span.className = clase;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || TRAZOS.punto}</svg>`;
  return span;
}

// Aviso corto abajo de la pantalla. Opcional: un botón de acción.
export function aviso(texto, { accion, alTocar, duracion = 3500 } = {}) {
  const zona = document.getElementById('avisos');
  while (zona.children.length >= 2) zona.firstElementChild.remove();   // como máximo dos a la vista
  const el = h('div', { class: 'aviso', role: 'status' }, h('span', {}, texto));
  if (accion) el.append(h('button', { class: 'aviso-accion', onclick: () => { alTocar?.(); el.remove(); } }, accion));
  zona.append(el);
  if (duracion) setTimeout(() => el.remove(), duracion);
  return el;
}

// Ventana de confirmación. Devuelve true o false.
export function confirmar(texto, { si = 'Confirmar', no = 'Cancelar', peligro = false } = {}) {
  return new Promise((ok) => {
    const dlg = h('dialog', { class: 'hoja' },
      h('p', { class: 'hoja-texto' }, texto),
      h('div', { class: 'hoja-botones' },
        h('button', { class: 'boton', value: 'no', onclick: () => dlg.close('no') }, no),
        h('button', { class: peligro ? 'boton peligro' : 'boton principal', onclick: () => dlg.close('si') }, si),
      ),
    );
    dlg.addEventListener('close', () => { ok(dlg.returnValue === 'si'); dlg.remove(); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function fechaRelativa(ms) {
  if (!ms) return 'nunca';
  const seg = Math.round((Date.now() - ms) / 1000);
  if (seg < 60) return 'recién';
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.round(seg / 3600)} h`;
  return new Date(ms).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
