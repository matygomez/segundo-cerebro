from playwright.sync_api import sync_playwright
import os
S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
os.chdir(os.path.dirname(os.path.abspath(__file__)))
src=open('test_080.py').read(); exec(src[:src.index('with sync_playwright')]); SEEDF=SEED
exec(open('test_tareas.py').read().split("\nwith sync_playwright")[0]); SEEDT=SEED
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0]); SEEDB=SEED
SERIE="""async () => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const F = await import('/modules/bitacora/filmoteca.js');
  const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx);
  const carp = await F.carpetaFilmoteca(m);
  for (const t of ['Serie Uno','Serie Dos','Serie Tres','Serie Cuatro']) await m.crearNota({ titulo: t, carpetaId: carp, cine: { tmdb: 0, tipo: 'tv', titulo: t, estado: 'viendo', vistos: {}, vistas: [], ultimo: Date.now(), manual: true } });
}"""
CFG="""async () => { const P = await import('/js/core/preferencias.js'); await P.cargarPreferencias(); return P.configInicio(); }"""
claves=lambda page: page.eval_on_selector_all('.ini-pieza', 'els => els.map(e => e.dataset.clave)')
def aj_fila(page, nombre): return page.locator(f'.ai-fila:has(.ai-nombre:text-is("{nombre}")), .ai-fila:has(.ai-nombre >> text="{nombre}")').first
def fila(page, nombre): return page.locator('.ai-fila').filter(has=page.locator('.ai-nombre', has_text=nombre)).first
def ir(page, ruta, t=1500): page.goto(U+'#/'+ruta); page.wait_for_timeout(t)

with sync_playwright() as p:
  b=p.chromium.launch()
  for w,hh in ((1366,900),(390,844)):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':hh}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800)
    page.evaluate(SEEDF, None); page.evaluate(SEEDT); page.evaluate(SEEDB); page.evaluate(SERIE)
    page.reload(); ir(page,'home',2500)
    # tema oscuro siempre
    chk(page.evaluate("getComputedStyle(document.body).backgroundColor")=='rgb(11, 11, 12)', f'fondo negro {w}')
    if not cel: chk(page.evaluate("getComputedStyle(document.querySelector('.menu')).backgroundColor")=='rgb(27, 28, 30)', 'panel lateral gris')
    # orden de fábrica y sin títulos de módulo
    c=claves(page); print(c)
    chk(c==['mm','botones','captura','tareas:hoy','calendario:semana','finanzas:disponible','bitacora:notas','bitacora:viendo'], f'orden de fábrica {w}')
    chk(page.locator('.acceso').all_inner_texts()==['Tarea','Gasto','Nota'], f'botones {page.locator(".acceso").all_inner_texts()}')
    chk(page.locator('.mm a[href="#/ajustes/inicio"]').count()==1, 'memento pide fecha')
    chk(page.locator('.fz-ini-valor').count()==1, 'disponible con número')
    filas_vis = page.locator('.fz-ini-filas').is_visible(); cajas_vis = page.locator('.fz-ini-cajas').is_visible()
    chk((cajas_vis and not filas_vis) if cel else (filas_vis and not cajas_vis), f'disponible compacto según dispositivo {w}')
    chk(page.locator('.bt-ini-sv-it').count()==3, 'seguir viendo máx 3')
    if cel:
      cols=page.evaluate("getComputedStyle(document.querySelector('.bt-ini-sv')).gridTemplateColumns.split(' ').length")
      chk(cols==3, f'portadas lado a lado {cols}')
    n_items=page.locator('.cl-sem-it').count()
    alto=page.evaluate("document.querySelector('.cl-sem-lista').clientHeight"); fila_h=page.evaluate("document.querySelector('.cl-sem-it').offsetHeight")
    chk(round(alto/fila_h)==(3 if cel else 5) or n_items<=(3 if cel else 5), f'esta semana muestra {round(alto/fila_h)} filas')
    if n_items>(3 if cel else 5): chk(page.locator('.cl-sem-riel:not([hidden])').count()==1, 'barrita al costado visible')
    chk(page.locator('.cl-sem-dia').count()==7, '7 días')
    page.screenshot(path=S+f'i19b_{w}.png', full_page=True)
    # ── Ajustes › Inicio ──
    ir(page,'ajustes/inicio')
    chk(page.locator('#ajustes-inicio .ai-estilo').count()==4, '4 estilos')
    page.fill('.ai-fecha', '1990-06-15'); page.locator('.ai-fecha').dispatch_event('change'); page.wait_for_timeout(500)
    cfg=page.evaluate(CFG); chk(cfg.get('nacimiento')=='1990-06-15', 'guarda nacimiento')
    ir(page,'home')
    chk(page.locator('.mm-num').count()==1, 'memento con número')
    if cel:
      chk(page.locator('.mm-txt.dos').count()==1 and page.locator('.mm-mini em').nth(1).inner_text()=='Sem.', 'memento celular: dos líneas y Sem.')
      anchos=page.eval_on_selector_all('.mm-mini','els=>els.map(e=>Math.round(e.getBoundingClientRect().width))'); chk(len(set(anchos))==1, f'barras mismo ancho {anchos}')
      chk(page.evaluate("[...document.querySelectorAll('.mm-mini > span')].every(s=>s.scrollWidth<=s.clientWidth+1)"), 'barras: % en la misma línea sin cortar')
    else:
      chk(page.locator('.mm-mini em').nth(1).inner_text()=='Semana', 'memento PC: Semana')
    chk(page.evaluate("(()=>{const t=document.querySelector('.mm-cita-txt');return t && t.scrollWidth<=t.clientWidth+1})()"), 'frase en una línea')
    chk(page.locator('.mm-cita small').count()==1, 'autor abajo')
    page.screenshot(path=S+f'i19c_{w}.png')
    # estilos
    for est, sel, n in (('Años','.mm-anios i',100),('Barras','.mm-fila',5),('Contador','.mm-tres div',3)):
      ir(page,'ajustes/inicio',1000); page.locator(f'.ai-estilo:has(b:text-is("{est}"))').click(); page.wait_for_timeout(500)
      ir(page,'home',1200); chk(page.locator(sel).count()==n, f'estilo {est}')
    ir(page,'ajustes/inicio',1000); page.locator('.ai-estilo', has_text='Barras + Contador').click(); page.wait_for_timeout(400)
    # frase fija
    page.locator('.ai-seg button', has_text='Fija').click(); page.wait_for_timeout(400)
    page.fill('.ai-frase textarea', 'Hoy puede ser el último.'); page.locator('.ai-frase textarea').dispatch_event('change'); page.wait_for_timeout(400)
    page.fill('.ai-frase input', 'Yo'); page.locator('.ai-frase input').dispatch_event('change'); page.wait_for_timeout(400)
    # apagar Disponible, subir Seguir viendo 3 lugares, prender Ingreso, sin vencidas
    fila(page,'Disponible').locator('.aj-switch').click(); page.wait_for_timeout(400)
    for _ in range(3): fila(page,'Seguir viendo').locator('.aj-flecha').first.click(); page.wait_for_timeout(350)
    page.locator('.ai-chip-b', has_text='Ingreso').locator('.ai-tog').click(); page.wait_for_timeout(400)
    fila(page,'Tareas de hoy').locator('.ai-op', has_text='Con vencidas').click(); page.wait_for_timeout(400)
    if not cel: fila(page,'Esta semana').locator('.ai-ancho-sel button', has_text='Entero').click(); page.wait_for_timeout(400)
    else: chk(not page.locator('.ai-ancho-sel').first.is_visible(), 'ancho oculto en celular')
    page.screenshot(path=S+f'i19_aj2_{w}.png', full_page=True)
    ir(page,'home',1800)
    chk('Hoy puede ser el último.' in page.locator('.mm-cita').inner_text() and '— Yo' in page.locator('.mm-cita').inner_text(), 'frase fija')
    c=claves(page); print(c)
    chk('finanzas:disponible' not in c, 'disponible apagado')
    chk(c.index('bitacora:viendo') < c.index('calendario:semana'), 'seguir viendo subió')
    chk('Ingreso' in page.locator('.acceso').all_inner_texts(), 'botón ingreso')
    chk(page.locator('.bloque:has(.tr-lista) >> text=Pagar seguro').count()==0 and page.locator('.tr-inicio-vencidas').count()==1, 'sin vencidas + aviso')
    if not cel: chk('completo' in page.locator('.ini-pieza[data-clave="calendario:semana"]').get_attribute('class'), 'esta semana entero')
    # se mantiene al recargar
    page.reload(); page.wait_for_timeout(2000)
    chk(claves(page)==c, 'se mantiene al recargar')
    page.screenshot(path=S+f'i19d_{w}.png', full_page=True)
    # volver a fábrica
    ir(page,'ajustes/inicio',1000)
    page.locator('#ajustes-inicio button', has_text='Volver al Inicio de fábrica').click(); page.wait_for_timeout(300)
    page.locator('dialog[open] .boton', has_text='Volver a fábrica').click(); page.wait_for_timeout(800)
    ir(page,'home',1500)
    print('fab', claves(page), page.evaluate(CFG)); chk(claves(page)==['mm','botones','captura','tareas:hoy','calendario:semana','finanzas:disponible','bitacora:notas','bitacora:viendo'], 'volver a fábrica')
    chk(page.locator('.mm-num').count()==1, 'fábrica mantiene nacimiento')
    # botón + Nota crea una nota y la abre
    page.locator('.acceso', has_text='Nota').click(); page.wait_for_timeout(1500)
    chk('#/bitacora/n/' in page.url, '+ Nota abre una nota')
    print(w, 'err', err[:5])
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
