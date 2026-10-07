// ─────────────────────────────────────────────────────────────
// Tareas: ordenar a mano arrastrando.
//
// Cada tarea ordenable tiene una manija (⋮⋮). Se arrastra con el
// mouse o con el dedo; con el teclado, la manija acepta las
// flechas arriba y abajo. Al soltar se avisa qué tarea quedó entre
// cuáles, para guardar su nuevo lugar.
// ─────────────────────────────────────────────────────────────

export function hacerOrdenable(ul, alSoltar) {
  const vecinos = (li) => ({
    antes: li.previousElementSibling?.dataset.id || null,
    despues: li.nextElementSibling?.dataset.id || null,
  });

  ul.addEventListener('pointerdown', (e) => {
    const asa = e.target.closest('.tr-asa');
    if (!asa || !ul.contains(asa) || e.button > 0) return;
    const li = asa.closest('li');
    e.preventDefault();
    asa.setPointerCapture(e.pointerId);

    const inicio = [...ul.children].indexOf(li);
    const agarre = e.clientY - li.getBoundingClientRect().top;
    let ultimaY = e.clientY;
    li.classList.add('arrastrando');
    ul.classList.add('ordenando');

    function acomodar() {
      // Mueve la tarea en la lista cuando el dedo pasa la mitad de su vecina.
      let cambio = true;
      while (cambio) {
        cambio = false;
        const prev = li.previousElementSibling;
        const next = li.nextElementSibling;
        if (prev) {
          const r = prev.getBoundingClientRect();
          if (ultimaY - agarre < r.top + r.height / 2) { ul.insertBefore(li, prev); cambio = true; continue; }
        }
        if (next) {
          const r = next.getBoundingClientRect();
          const abajo = ultimaY - agarre + li.offsetHeight;
          if (abajo > r.top + r.height / 2) { ul.insertBefore(next, li); cambio = true; }
        }
      }
      li.style.transform = '';
      const natural = li.getBoundingClientRect().top;
      li.style.transform = `translateY(${ultimaY - agarre - natural}px)`;
    }

    // Si el dedo llega cerca de un borde de la pantalla, la página se desplaza.
    const desplazar = setInterval(() => {
      const margen = 90;
      const abajoUtil = window.innerHeight - 140;
      if (ultimaY < margen) { window.scrollBy(0, -14); acomodar(); }
      else if (ultimaY > abajoUtil) { window.scrollBy(0, 14); acomodar(); }
    }, 30);

    const mover = (ev) => { ultimaY = ev.clientY; acomodar(); };
    const soltar = () => {
      clearInterval(desplazar);
      asa.removeEventListener('pointermove', mover);
      asa.removeEventListener('pointerup', soltar);
      asa.removeEventListener('pointercancel', soltar);
      li.style.transform = '';
      li.classList.remove('arrastrando');
      ul.classList.remove('ordenando');
      if ([...ul.children].indexOf(li) !== inicio) {
        const { antes, despues } = vecinos(li);
        alSoltar(li.dataset.id, antes, despues);
      }
    };
    asa.addEventListener('pointermove', mover);
    asa.addEventListener('pointerup', soltar);
    asa.addEventListener('pointercancel', soltar);
  });

  // Teclado: flechas sobre la manija.
  ul.addEventListener('keydown', (e) => {
    const asa = e.target.closest('.tr-asa');
    if (!asa || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const li = asa.closest('li');
    const otro = e.key === 'ArrowUp' ? li.previousElementSibling : li.nextElementSibling;
    if (!otro) return;
    if (e.key === 'ArrowUp') ul.insertBefore(li, otro); else ul.insertBefore(otro, li);
    asa.focus();
    const { antes, despues } = vecinos(li);
    alSoltar(li.dataset.id, antes, despues);
  });
}
