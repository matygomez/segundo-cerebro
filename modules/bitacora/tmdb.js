// ─────────────────────────────────────────────────────────────
// Filmoteca ← TMDB (The Movie Database), solo lectura.
// Títulos y sinopsis en español latino, plataformas de Argentina.
// La clave se carga en Configurar Bitácora (vale la "Clave de la API"
// o el "Token de lectura"). Los pósters se muestran directo desde
// internet: no se guardan ni en Drive ni en el dispositivo.
// ─────────────────────────────────────────────────────────────

const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
export const IDIOMA = 'es-MX';
export const PAIS = 'AR';

export const imagen = (ruta, tam = 'w342') => (ruta ? `${IMG}/${tam}${ruta}` : '');

export class ErrorTMDB extends Error {}

const cache = new Map();   // pedidos de esta sesión (no se guarda nada)

export async function pedir(clave, ruta, params = {}) {
  if (!clave) throw new ErrorTMDB('Falta la clave de TMDB. Cargala en Configurar Bitácora › Filmoteca.');
  if (!navigator.onLine) throw new ErrorTMDB('Sin internet: no se puede consultar TMDB ahora.');
  const token = clave.trim().startsWith('eyJ');
  const p = new URLSearchParams({ language: IDIOMA, ...params });
  if (!token) p.set('api_key', clave.trim());
  const url = `${API}${ruta}?${p}`;
  if (cache.has(url)) return cache.get(url);
  const prom = (async () => {
    const r = await fetch(url, token ? { headers: { Authorization: `Bearer ${clave.trim()}` } } : {});
    if (r.status === 401) throw new ErrorTMDB('TMDB no aceptó la clave. Revisala en Configurar Bitácora › Filmoteca.');
    if (r.status === 404) throw new ErrorTMDB('TMDB no encontró ese título.');
    if (!r.ok) throw new ErrorTMDB(`TMDB respondió ${r.status}`);
    return r.json();
  })();
  cache.set(url, prom);
  prom.catch(() => cache.delete(url));
  return prom;
}

const anio = (f) => (f ? String(f).slice(0, 4) : '');

export async function buscar(clave, texto) {
  const r = await pedir(clave, '/search/multi', { query: texto, include_adult: 'false', page: '1' });
  return (r.results || []).filter(x => x.media_type === 'movie' || x.media_type === 'tv').map(x => ({
    tmdb: x.id, tipo: x.media_type,
    titulo: x.title || x.name || '', original: x.original_title || x.original_name || '',
    anio: anio(x.release_date || x.first_air_date), poster: x.poster_path || '',
    resumen: x.overview || '', popularidad: x.popularity || 0,
  }));
}

const plataformasDe = (wp) => {
  const ar = wp?.results?.[PAIS];
  if (!ar) return [];
  const nombres = [...(ar.flatrate || []), ...(ar.free || []), ...(ar.ads || [])].map(p => p.provider_name);
  return [...new Set(nombres)];
};

// Datos completos de una película o serie (lo que cambia con el tiempo incluido).
export async function detalle(clave, tipo, id) {
  if (tipo === 'movie') {
    const x = await pedir(clave, `/movie/${id}`, { append_to_response: 'watch/providers,release_dates' });
    const ar = (x.release_dates?.results || []).find(r => r.iso_3166_1 === PAIS);
    const fechaAR = (ar?.release_dates || []).map(r => r.release_date?.slice(0, 10)).filter(Boolean).sort()[0];
    return {
      fijo: {
        tmdb: x.id, tipo, titulo: x.title || '', original: x.original_title || '', anio: anio(x.release_date),
        poster: x.poster_path || '', fondo: x.backdrop_path || '', generos: (x.genres || []).map(g => g.name),
        duracion: x.runtime || 0, resumen: x.overview || '',
      },
      vivo: {
        clave: `movie:${x.id}`, plataformas: plataformasDe(x['watch/providers']), estreno: fechaAR || x.release_date || '',
        estado: x.status || '', actualizado: Date.now(),
      },
    };
  }
  const x = await pedir(clave, `/tv/${id}`, { append_to_response: 'watch/providers' });
  const temporadas = (x.seasons || []).filter(s => s.season_number > 0).map(s => ({ n: s.season_number, eps: s.episode_count || 0, nombre: s.name || `Temporada ${s.season_number}`, fecha: s.air_date || '' }));
  const ult = x.last_episode_to_air;
  const emitidos = {};
  for (const t of temporadas) {
    if (!ult) emitidos[t.n] = 0;
    else if (t.n < ult.season_number) emitidos[t.n] = t.eps;
    else if (t.n === ult.season_number) emitidos[t.n] = ult.episode_number;
    else emitidos[t.n] = 0;
  }
  const prox = x.next_episode_to_air;
  return {
    fijo: {
      tmdb: x.id, tipo, titulo: x.name || '', original: x.original_name || '', anio: anio(x.first_air_date),
      poster: x.poster_path || '', fondo: x.backdrop_path || '', generos: (x.genres || []).map(g => g.name),
      duracion: (x.episode_run_time || [])[0] || ult?.runtime || 0, resumen: x.overview || '',
    },
    vivo: {
      clave: `tv:${x.id}`, plataformas: plataformasDe(x['watch/providers']), temporadas, emitidos,
      proximo: prox ? { t: prox.season_number, e: prox.episode_number, nombre: prox.name || '', fecha: prox.air_date || '' } : null,
      estado: x.status || '', terminada: ['Ended', 'Canceled'].includes(x.status), actualizado: Date.now(),
    },
  };
}

export async function temporada(clave, id, n) {
  const x = await pedir(clave, `/tv/${id}/season/${n}`);
  return (x.episodes || []).map(e => ({ e: e.episode_number, nombre: e.name || '', fecha: e.air_date || '', duracion: e.runtime || 0 }));
}
