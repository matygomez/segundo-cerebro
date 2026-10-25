// ─────────────────────────────────────────────────────────────
// Puente con la app de Android (carpeta android/ del repo).
// Adentro de la app existe window.CerebroAndroid; en el navegador no,
// y todo esto queda sin efecto.
// ─────────────────────────────────────────────────────────────

const RELEASES = 'https://api.github.com/repos/matygomez/segundo-cerebro/releases/latest';
const DESCARGA = 'https://github.com/matygomez/segundo-cerebro/releases/latest/download/segundo-cerebro.apk';

const nativo = () => window.CerebroAndroid;
export const esAndroid = () => !!nativo();

export function versionAndroid() {
  try { return Number(nativo()?.version()) || 0; } catch { return 0; }
}

// Android contesta llamando a window.__cerebroAndroid.token(respuesta).
let esperando = null;
window.__cerebroAndroid = {
  token(r) { const p = esperando; esperando = null; p?.ok(r || {}); },
};

// Pide el permiso de Google con la cuenta del teléfono → { token, alcances } o { error }.
export function pedirToken(alcances, cuenta, interactivo) {
  if (esperando) return esperando.promesa;
  let ok;
  const promesa = new Promise((a) => { ok = a; });
  esperando = { ok, promesa };
  nativo().pedirToken(alcances, cuenta || '', !!interactivo);
  return promesa;
}

// ¿Hay en GitHub una versión de la app de Android más nueva que la instalada?
export async function hayVersionNueva() {
  if (!esAndroid()) return false;
  const r = await fetch(RELEASES, { cache: 'no-store' });
  if (!r.ok) return false;
  const ultima = Number(String((await r.json()).tag_name || '').replace('android-', '')) || 0;
  return ultima > versionAndroid();
}

// Abre la descarga en el navegador; al terminar, Android pregunta si instalarla.
export function bajarVersionNueva() {
  nativo()?.abrirAfuera(DESCARGA);
}
