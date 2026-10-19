from playwright.sync_api import sync_playwright
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
EV="""async (code) => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx); const d = await m.cargar(); return await (new Function('m','d','M','ctx', 'return (async()=>{'+code+'})()'))(m,d,M,ctx); }"""
TAR="""async (code) => { const D = await import('/js/core/datos.js'); const c=(n)=>D.coleccion('tareas',n); return await (new Function('c', 'return (async()=>{'+code+'})()'))(c); }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  cx=b.new_context(viewport={'width':390,'height':850}, is_mobile=True, has_touch=True); page=cx.new_page(); err=[]
  page.on('pageerror',lambda e: err.append(str(e)))
  page.goto(U); page.wait_for_timeout(800)
  ids=page.evaluate(SEED)
  ev=lambda code: page.evaluate(EV, code); tar=lambda code: page.evaluate(TAR, code)
  # ── Recordarme esta nota ──
  page.goto(U+f'#/bitacora/n/{ids["clase"]}'); page.wait_for_timeout(1500)
  page.screenshot(path=S+'b3_nota_cel.png', full_page=True)
  page.click('.bt-nota-barra .boton-icono[aria-label="Más opciones"]'); page.wait_for_timeout(400)
  chk(page.locator('.bt-menu-op:has-text("Recordarme")').count()==1, 'opcion recordarme')
  page.click('.bt-menu-op:has-text("Recordarme")'); page.wait_for_timeout(400)
  page.click('dialog[open] .bt-opc button:has-text("Mañana")'); page.click('dialog[open] .boton.principal'); page.wait_for_timeout(2500)
  t=tar("return (await c('tareas').listar()).filter(t=>t.origen?.modulo==='bitacora')")
  print(t)
  chk(len(t)==1 and t[0]['titulo'].startswith('Ver: ') and t[0]['origen']['enlace']==f'bitacora/n/{ids["clase"]}', 'tarea recordatorio')
  proy=tar("const p=(await c('proyectos').listar()).find(p=>p.sistema==='bitacora'); return p?.nombre")
  chk(proy=='Bitácora', 'proyecto Sistemas › Bitácora')
  # abrir la tarea en Tareas y volver a la nota con el link
  page.evaluate("async(id)=>{const R=await import('/js/core/registro.js'); await R.pedir('abrir-tarea',{id})}", t[0]['id']); page.wait_for_timeout(900)
  chk(page.locator('dialog[open] button:has-text("Abrir la nota en la Bitácora")').count()==1, 'link a nota en tarea')
  page.click('dialog[open] button:has-text("Abrir la nota en la Bitácora")'); page.wait_for_timeout(1200)
  chk(f'#/bitacora/n/{ids["clase"]}' in page.url, 'vuelve a la nota')
  # completar la tarea → el recordatorio se borra
  tar(f"await c('tareas').actualizar('{t[0]['id']}', {{estado:'hecha', completada: Date.now()}})"); page.wait_for_timeout(4500)
  chk(ev("return d.recordatorios.length")==0, 'recordatorio se borra al completar')
  chk(tar(f"return (await c('tareas').obtener('{t[0]['id']}'))?.estado")=='hecha', 'tarea queda hecha')
  # ── Crear tarea desde la nota ──
  page.goto(U+f'#/bitacora/n/{ids["clase"]}'); page.wait_for_timeout(1000)
  page.click('.bt-nota-barra .boton-icono[aria-label="Más opciones"]'); page.wait_for_timeout(400)
  page.click('.bt-menu-op:has-text("Crear tarea")'); page.wait_for_timeout(1000)
  chk(page.input_value('dialog[open] .tr-titulo-input')=='Curso CLU – Clase básica', 'tarea prellenada')
  page.click('dialog[open] button[type=submit]'); page.wait_for_timeout(900)
  t2=tar("return (await c('tareas').listar()).filter(t=>t.origen?.clave?.startsWith('bitacora-tarea:'))")
  chk(len(t2)==1 and t2[0]['origen']['enlace'].endswith(ids['clase']) and not t2[0]['areaId'], 'tarea creada con enlace en bandeja')
  # ── Compartir (simulado: lo que deja el service worker) ──
  page.evaluate("""async()=>{const c=await caches.open('sc-compartido'); const b=new URL('./__compartido/',location.href).href;
    await c.put(b+'datos', new Response(JSON.stringify({titulo:'',texto:'Mirá esto https://youtube.com/watch?v=abc',url:'',archivos:[{clave:'archivo-0',nombre:'foto.png',tipo:'image/png'}]})));
    const png=await (await fetch('/icons/icono-192.png')).blob(); await c.put(b+'archivo-0', new Response(png));}""")
  page.goto(U+'#/bitacora/compartir'); page.wait_for_timeout(2000)
  chk(page.locator('dialog[open] h2:has-text("Guardar en Bitácora")').count()==1, 'dialogo compartir')
  chk(page.url.endswith('#/bitacora'), 'url limpia')
  page.screenshot(path=S+'b3_compartir.png')
  page.fill('dialog[open] textarea', 'para la clase'); page.click('dialog[open] .boton.principal'); page.wait_for_timeout(1000)
  n=ev("return d.notasDe('').find(n=>n.texto.includes('youtube'))")
  print(n['titulo'], repr(n['texto']), n['adjuntos'])
  chk(n and n['texto'].startswith('para la clase') and '![[foto.png]]' in n['texto'] and len(n['adjuntos'])==1, 'nota compartida')
  chk(page.evaluate("async()=>!(await caches.has('sc-compartido'))"), 'cache limpia')
  # ── Inicio celular con portada ──
  ev(f"await m.guardarAjuste('inicio-cel', {{ portada: '{ids['clase']}', bloques: [] }})")
  page.goto(U+'#/bitacora'); page.wait_for_timeout(1000)
  chk(page.locator('.bt-portada').count()==0, 'sin portada (quitada en 0.17.1)')
  ev("await m.guardarAjuste('inicio-cel', { portada: '', bloques: [{id:'recientes',on:false}] })")
  page.wait_for_timeout(800)
  chk(page.locator('.bt-bloque-h:has-text("Recientes")').count()==0, 'ocultar bloque')
  page.screenshot(path=S+'b3_ini_cel.png', full_page=True)
  page.goto(U+'#/bitacora/ajustes'); page.wait_for_timeout(900)
  page.screenshot(path=S+'b3_ajustes.png', full_page=True)
  chk(page.locator('.bt-tipo').count()==14, 'tipos en ajustes')
  print('errores', err[:5])
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
