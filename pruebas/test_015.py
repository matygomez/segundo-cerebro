from playwright.sync_api import sync_playwright
import datetime
exec(open('test_014.py').read().split("\nwith sync_playwright")[0])
SEEDT=open('test_tareas.py').read().split('SEED="""')[1].split('"""')[0]
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(700); page.evaluate(SEED, None); page.evaluate(EXTRA); page.evaluate(SEEDT)
    page.goto(U+'#/home'); page.reload(); page.wait_for_timeout(3000)
    page.evaluate(FAKE,1)
    # duplicado de proyecto Finanzas
    page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('tareas',n);const a=(await c('areas').listar()).find(x=>x.sistema);await c('proyectos').crear({nombre:'Finanzas',areaId:a.id,sistema:'finanzas',archivado:false,orden:9});}""")
    page.goto(U+'#/home'); page.reload(); page.wait_for_timeout(2000)
    chk(('Calendario' in page.locator('.menu').inner_text()) == (w>=600), 'calendario: en el menú de PC, fuera de la barra del celular')
    n=page.evaluate("""async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','proyectos').listar()).filter(p=>p.sistema==='finanzas'&&!p.enPapelera).length}""")
    chk(n==1, f'Finanzas sin duplicar ({n})')
    page.locator('.portada-enlace').click(); page.wait_for_timeout(1500)
    chk('#/calendario' in page.url and page.locator('.cl-titulo').count()==1, 'fecha abre calendario')
    chk(page.locator('.cl-celda.hoy').count()==1 and page.locator('.cl-celda.hoy.elegido').count()==1, 'hoy elegido')
    tit=page.locator('.cl-dia .cl-texto b').all_inner_texts(); print(tit)
    chk('Revisar recepción' in tit, 'tareas de hoy en la lista')
    page.screenshot(path=S+f't015_cal_{w}.png', full_page=True)
    # vencida en días pasados
    ayer=(hoy_-datetime.timedelta(days=1)).isoformat()
    chk(page.locator('.cl-p.t-venc, .cl-chip.t-venc').count()>0, 'vencidas marcadas')
    # día con feriado
    fer=(hoy_+datetime.timedelta(days=5))
    page.goto(U+f'#/calendario/{fer.isoformat()}'); page.wait_for_timeout(1200)
    chk(page.locator('.cl-dia-titulo small:has-text("Feriado")').count()==1, 'feriado en el día')
    chk(page.locator('.cl-celda.feriado').count()>=1, 'número violeta')
    # abrir tarea
    page.goto(U+'#/calendario/'+hoy_.isoformat()); page.wait_for_timeout(1200)
    page.locator('.cl-item:has-text("Revisar recepción")').click(); page.wait_for_timeout(800)
    chk(page.locator('dialog[open] .tr-editor, .tr-editor').count()>=1, 'abre el detalle')
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    page.locator('.cl-agregar').click(); page.wait_for_timeout(800)
    fv=page.locator('dialog[open] input[type=date]').first.input_value() if page.locator('dialog[open] input[type=date]').count() else ''
    chk(fv==hoy_.isoformat(), f'nueva tarea con fecha {fv}')
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    # pago → Finanzas
    dia_alq=[t for t in page.evaluate(TAREAS) if ':fijo:' in t[0]][0][2]
    page.goto(U+f'#/calendario/{dia_alq}'); page.wait_for_timeout(1200)
    page.locator('.cl-item.t-fin').first.click(); page.wait_for_timeout(1000)
    chk('#/finanzas/detalle/fijos' in page.url, 'pago abre Finanzas')
    # config semana domingo
    page.goto(U+'#/calendario'); page.wait_for_timeout(1000)
    page.click('button[aria-label="Configurar Calendario"]'); page.wait_for_timeout(400)
    page.locator('dialog[open] .cl-seg button:has-text("Domingo")').click(); page.wait_for_timeout(600)
    page.keyboard.press('Escape'); page.wait_for_timeout(800)
    chk(page.locator('.cl-dsem span').first.inner_text()=='D', 'semana desde domingo')
    # mostrar el módulo
    page.goto(U+'#/ajustes'); page.wait_for_timeout(800)
    disp='Celular' if w<600 else 'PC'
    if w<600:
      page.locator('button[aria-label="Bitácora en la barra"]').click(); page.wait_for_timeout(500)   # la barra ya tiene 5
      sw=page.locator('button[aria-label="Calendario en la barra"]')
      chk(not sw.is_disabled() and sw.get_attribute('aria-checked')=='false', 'switch de barra disponible y apagado')
      sw.click(); page.wait_for_timeout(600)
    chk('Calendario' in page.locator('.menu').inner_text(), 'en el menú / barra')
    # Sistemas sin agregar
    page.goto(U+'#/tareas'); page.wait_for_timeout(800)
    page.locator('.tr-nodo-area.tr-nodo-sistema').click(); page.wait_for_timeout(900)
    chk(page.locator('.tr-agregar').count()==0, 'Sistemas sin agregar tarea')
    chk(not err, f'err {err}')
    cx.close()
print(ok,'ok',len(fallas),'fallas')
