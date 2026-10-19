from playwright.sync_api import sync_playwright
import datetime
src=open('test_080.py').read(); exec(src[:src.index('with sync_playwright')])
hoyd=datetime.date.today(); dia=min(28,(hoyd+datetime.timedelta(days=2)).day)
EXTRA=f"""async()=>{{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const a=(await c('categorias').listar()).find(x=>x.nombre==='Alquiler');await c('categorias').actualizar(a.id,{{dia:{dia}}});
 await c('categorias').crear({{nombre:'Internet',tipo:'fijo',padreId:'',presupuestos:[{{desde:'2026-01',monto:18000}}],grupoFijo:'familia',automatico:true,dia:20,archivada:false,orden:1}});}}"""
TAREAS="""async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','tareas').listar()).filter(t=>t.origen).map(t=>[t.origen.clave,t.titulo,t.fecha,t.inicio,t.estado]);}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(700); page.evaluate(SEED, None); page.evaluate(EXTRA)
    page.goto(U+'#/tareas'); page.reload(); page.wait_for_timeout(3500)
    ts=page.evaluate(TAREAS); print(ts)
    claves=[t[0] for t in ts]
    chk(any(':fijo:' in c and c.endswith(hoyd.strftime('%Y-%m')) for c in claves), 'tarea alquiler mes actual')
    chk(sum(1 for c in claves if ':fijo:' in c)==2, 'alquiler actual y siguiente (internet automático apagado)')
    chk(any(':tarjeta:' in c for c in claves), 'tarea tarjeta')
    chk(page.locator('.tr-nodo:has-text("Sistemas")').count()==1, 'área Sistemas en inicio')
    chk(page.locator('.tr-pest[title=Sistemas]').count()==0, 'Sistemas no aparece como pestaña')
    page.locator('.tr-nodo:has-text("Sistemas")').first.click(); page.wait_for_timeout(800)
    tit=page.locator('.tr-cuerpo-vista .tr-titulo').all_inner_texts(); print(tit)
    chk(any(t.startswith('Pagar Alquiler') for t in tit), 'alquiler visible')
    chk(page.locator('.tr-programadas-boton').count()==1, 'programadas')
    page.locator('.tr-programadas-boton').click(); page.wait_for_timeout(500)
    chk(page.locator('.tr-programadas .tr-tarea').count()==2, 'dos programadas')
    chk(page.locator('.tr-programadas .tr-aparece').count()==2, 'dice cuándo aparece')
    page.screenshot(path=S+f't013_sis_{w}.png', full_page=True)
    # completar → registrar pago
    page.locator('.tr-proyectos .tr-tarea:has(.tr-titulo:text-matches("^Pagar Alquiler")) .tr-check').first.click(); page.wait_for_timeout(600)
    chk(page.locator('dialog[open]:has-text("Registrar el pago")').count()==1, 'pregunta pago')
    page.locator('dialog[open] button:has-text("Registrar pago")').click(); page.wait_for_timeout(800)
    imp=page.locator('dialog[open] .fz-importe')
    chk(imp.count()==1 and imp.evaluate("e=>e.textoEscrito()")=='200000', f'form con importe')
    page.screenshot(path=S+f't013_pago_{w}.png')
    page.locator('dialog[open] button[type=submit]').click(); page.wait_for_timeout(3000)
    ts=page.evaluate(TAREAS); act=[t for t in ts if ':fijo:' in t[0] and t[0].endswith(hoyd.strftime('%Y-%m'))]
    chk(act and act[0][4]=='hecha', f'completada sola {act}')
    # Finanzas config
    page.goto(U+'#/finanzas/config'); page.wait_for_timeout(900)
    chk(page.locator('.fz-conf-rec').count()>=3, 'controles de recordatorio')
    chk(page.locator('button[aria-label="Recordatorio de Internet"]').get_attribute('aria-checked')=='false', 'automático apagado')
    page.screenshot(path=S+f't013_cfg_{w}.png', full_page=True)
    page.locator('button[aria-label="Recordatorio de Alquiler"]').click(); page.wait_for_timeout(3000)
    ts=page.evaluate(TAREAS)
    chk(not any(':fijo:' in t[0] and t[4]=='pendiente' for t in ts), f'apagado borra pendientes {ts}')
    chk(any(':fijo:' in t[0] and t[4]=='hecha' for t in ts), 'la completada queda')
    # días de tarjeta
    page.locator('.fz-conf-fila:has-text("Visa") select').select_option('10'); page.wait_for_timeout(3000)
    ts=page.evaluate(TAREAS); tj=[t for t in ts if ':tarjeta:' in t[0]][0]
    f=datetime.date.fromisoformat(tj[2]); chk(tj[3]==(f-datetime.timedelta(days=10)).isoformat(), f'inicio 10 días {tj}')
    # aviso
    man=(hoyd+datetime.timedelta(days=1)).isoformat(); ayer=(hoyd-datetime.timedelta(days=1)).isoformat()
    page.evaluate(f"""async()=>{{const R=await import('/js/core/registro.js');await R.pedir('sistema-sincronizar',{{modulo:'prueba',prefijo:'prueba:',tareas:[{{clave:'prueba:1',titulo:'Feriado mañana',fecha:'{man}',aviso:true}},{{clave:'prueba:2',titulo:'Feriado ayer',fecha:'{ayer}',aviso:true}}]}});}}""")
    page.goto(U+'#/tareas/hoy'); page.wait_for_timeout(900)
    av=page.locator('.tr-tarea.tr-es-aviso'); chk(av.count()==1 and 'Feriado mañana' in av.first.inner_text(), 'aviso visible, el pasado oculto')
    chk(av.first.locator('.tr-check').count()==0, 'aviso sin casilla')
    chk(page.locator('#tr-ancla-vencidas .tr-titulo:has-text("Feriado")').count()==0, 'aviso no vencido')
    # eliminar Sistemas bloqueado
    page.goto(U+'#/tareas'); page.wait_for_timeout(800)
    # ajustes actualizar
    page.goto(U+'#/ajustes'); page.wait_for_timeout(800)
    chk(page.locator('button:has-text("Buscar actualización")').count()==1 and page.locator('button:has-text("Forzar actualización")').count()==1, 'botones actualizar')
    page.locator('button:has-text("Buscar actualización")').click(); page.wait_for_timeout(2500)
    print(page.locator('#avisos').inner_text() if page.locator('#avisos').count() else '')
    page.screenshot(path=S+f't013_aj_{w}.png', full_page=True)
    chk(not err, f'err {err}')
    cx.close()
print(ok,'ok',len(fallas),'fallas')
