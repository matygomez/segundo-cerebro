// ─────────────────────────────────────────────────────────────
// Módulo Inicio.
//
// No tiene datos propios. La pantalla está en pc.js (fecha, tiempo,
// memento mori o aviso del Resumen, y los paneles de cada módulo); desde
// 0.42 el celular usa la misma, acomodada en una columna.
// ─────────────────────────────────────────────────────────────

import { pantallaPC } from './pc.js';

// Frases estoicas cortas (para que entren en una línea).
const CITAS = [
  ['No es que tengamos poco tiempo, es que perdemos mucho.', 'Séneca'],
  ['Cada día es una vida aparte.', 'Séneca'],
  ['No actúes como si fueras a vivir diez mil años.', 'Marco Aurelio'],
  ['Hacé cada cosa como si fuera la última.', 'Marco Aurelio'],
  ['Mientras se posterga, la vida pasa.', 'Séneca'],
  ['Nada es nuestro, excepto el tiempo.', 'Séneca'],
  ['Tené la muerte presente cada día.', 'Epicteto'],
  ['Perdemos la vida esperando el mañana.', 'Séneca'],
  ['Hoy podés irte de la vida: actuá en consecuencia.', 'Marco Aurelio'],
  ['Empezá a vivir ahora mismo.', 'Séneca'],
];
// Años totales de vida que cuenta el memento mori (se elige en Configurar Inicio).
const vidaDe = (cfg) => Math.min(120, Math.max(50, Math.round(Number(cfg?.vida) || 100)));
const esPC = () => matchMedia('(min-width: 900px)').matches;

function datosVida(nacimiento, VIDA) {
  const hoy = new Date();
  const nac = new Date(`${nacimiento}T00:00`);
  if (Number.isNaN(nac.getTime()) || nac > hoy) return null;
  const fin = new Date(nac); fin.setFullYear(nac.getFullYear() + VIDA);
  const total = (fin - nac) / 864e5, vividos = (hoy - nac) / 864e5;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const cumple = new Date(nac); cumple.setFullYear(hoy.getFullYear()); if (cumple > hoy) edad--;
  const ultimo = new Date(nac); ultimo.setFullYear(nac.getFullYear() + edad);
  const proximo = new Date(nac); proximo.setFullYear(nac.getFullYear() + edad + 1);
  return {
    vividos, quedan: Math.max(0, total - vividos), edad, anios: Math.max(0, VIDA - 1 - edad),
    p: Math.min(1, vividos / total), pAnio: (hoy - ultimo) / (proximo - ultimo),
  };
}
function porcentajes() {
  const ahora = new Date();
  const ini = new Date(ahora); ini.setHours(0, 0, 0, 0);
  const pDia = (ahora - ini) / 864e5;
  const diasMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
  const ia = new Date(ahora.getFullYear(), 0, 1), fa = new Date(ahora.getFullYear() + 1, 0, 1);
  return { dia: pDia, semana: (((ahora.getDay() + 6) % 7) + pDia) / 7, mes: (ahora.getDate() - 1 + pDia) / diasMes, anio: (ahora - ia) / (fa - ia) };
}

// La frase del día (o la tuya fija): [texto, autor]. Sin frase: [''].
function textoFrase(cfg) {
  if (cfg.frase === 'no') return [''];
  if (cfg.frase === 'fija') return [(cfg.fraseTexto || '').trim(), (cfg.fraseAutor || '').trim()];
  const hoy = new Date(); const n = Math.floor(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() / 864e5);
  return CITAS[n % CITAS.length];
}

export default {
  id: 'home',
  nombre: 'Inicio',
  sinColumna: true,   // en la PC no hay columna: todo entra en una pantalla

  async pantalla(contenedor, ctx) {
    // Al pasar de celular a PC (o al revés) se vuelve a abrir el Inicio con la otra pantalla.
    const mqPC = matchMedia('(min-width: 900px)');
    const cambiarPantalla = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    // Celular y PC usan la misma pantalla (pc.js); el celular la acomoda en una columna.
    const l = await pantallaPC(contenedor, ctx, { datosVida, porcentajes, vidaDe, textoFrase }, { cel: !esPC() });
    mqPC.addEventListener('change', cambiarPantalla, { once: true });
    return () => { mqPC.removeEventListener('change', cambiarPantalla); l?.(); };
  },
};
