from playwright.sync_api import sync_playwright
exec(open('test_tareas.py').read().split("\nwith sync_playwright")[0])
EVT="""async (code) => { const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('tareas', n); return await (new Function('c', 'return (async()=>{'+code+'})()'))(c); }"""
RT="""async () => { const E = await import('/js/core/editor-texto.js');
  const md = ['# Título', '', 'Texto con **negrita**, *cursiva*, <u>sub</u>, ~~tachado~~, ==resaltado== y `código`.', 'Segunda línea [link](https://a.com)', '', '## Sub', '', '- uno', '  - dos', '- tres', '', '1. a', '2. b', '', '- [ ] pendiente', '- [x] hecha', '', '> una cita', '', '---', '', '### Chico', '', '| a | b |', '|---|---|', '| 1 | 2 |', '', '```', 'x = 1', '```'].join('\\n');
  const div = document.createElement('div'); div.append(...E.mdAElementos(md, {})); const back = E.elementosAMd(div); return [md, back]; }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366, 390):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEED)
    evt=lambda code: page.evaluate(EVT, code)
    md, back = page.evaluate(RT)
    chk(md==back, 'ida y vuelta markdown')
    if md!=back: print(repr(back))
    # ── Nueva tarea: notas con formato ──
    page.goto(U+'#/home'); page.wait_for_timeout(1500)
    page.locator('.acceso:has-text("Tarea")').click(); page.wait_for_timeout(800)
    chk(page.evaluate("document.activeElement?.classList.contains('tr-titulo-input')"), 'foco título')
    page.keyboard.type('Con formato')
    area=page.locator('dialog[open] .tr-notas .ed-area')
    chk(area.count()==1 and page.locator('dialog[open] textarea[aria-label=Notas]').count()==0, 'editor en notas')
    area.click(); page.keyboard.type('Encabezado'); page.wait_for_timeout(200)
    if cel:
      chk(page.locator('dialog[open] .ed-fija:not([hidden])').count()==1, 'barra fija celular')
      page.locator('dialog[open] .ed-fija .ed-b[title="Título grande"]').click()
    else:
      page.keyboard.press('Shift+Home'); page.wait_for_timeout(250)
      chk(page.locator('dialog[open] .ed-flot:not([hidden])').count()==1, 'barra flotante al seleccionar')
      page.locator('dialog[open] .ed-flot .ed-b[title="Título grande"]').click()
    page.keyboard.press('End'); page.keyboard.press('Enter'); page.keyboard.type('normal ')
    page.keyboard.down('Control'); page.keyboard.press('b'); page.keyboard.up('Control'); page.keyboard.type('fuerte')
    page.keyboard.down('Control'); page.keyboard.press('b'); page.keyboard.up('Control'); page.keyboard.type(' fin')
    barra='.ed-fija' if cel else '.ed-flot'
    if not cel: page.keyboard.press('Shift+Home'); page.wait_for_timeout(200)
    chk(page.locator(f'dialog[open] {barra}:not([hidden])').count()==1, 'barra visible')
    page.locator(f'dialog[open] {barra} .ed-b[title="Línea divisoria"]').click(); page.wait_for_timeout(200)
    page.screenshot(path=S+f'e18_notas_{w}.png')
    # ── comentario antes de crear ──
    page.locator('dialog[open] .tr-com-campo').fill('Primer comentario')
    page.locator('dialog[open] .tr-com-enviar').click(); page.wait_for_timeout(300)
    chk(page.locator('dialog[open] .tr-com-pendiente').count()==1, 'comentario en espera')
    page.set_input_files('dialog[open] .tr-nuevo-comentario input[type=file]', '/home/claude/segundo-cerebro/icons/icono-192.png'); page.wait_for_timeout(1500)
    chk(page.locator('dialog[open] .tr-nuevo-comentario .tr-miniatura').count()==1, 'imagen en borrador')
    page.locator('dialog[open] .tr-com-enviar').click(); page.wait_for_timeout(300)
    chk(page.locator('dialog[open] .tr-com-pendiente').count()==2, 'comentario solo imagen en espera')
    page.screenshot(path=S+f'e18_coms_{w}.png', full_page=True)
    page.locator('dialog[open] button[type=submit]').click(); page.wait_for_timeout(1200)
    t=evt("const t=(await c('tareas').listar()).find(x=>x.titulo==='Con formato'); const cs=(await c('comentarios').listar()).filter(x=>x.tareaId===t.id); return [t.notas, cs.map(x=>[x.texto,(x.adjuntos||[]).length])]")
    print(repr(t))
    notas=t[0]
    chk(notas.startswith('# Encabezado') and '**fuerte**' in notas and '---' in notas, 'notas guardadas en markdown')
    chk(sorted(t[1])==sorted([['Primer comentario',0],['',1]]), 'comentarios guardados al crear')
    # ── Cancelar descarta comentarios en espera ──
    page.goto(U+'#/home'); page.wait_for_timeout(1200)
    page.locator('.acceso:has-text("Tarea")').click(); page.wait_for_timeout(800)
    page.keyboard.type('Descartada')
    page.locator('dialog[open] .tr-com-campo').fill('no va'); page.locator('dialog[open] .tr-com-enviar').click(); page.wait_for_timeout(200)
    page.locator('dialog[open] .boton:has-text("Cancelar")').click(); page.wait_for_timeout(400)
    if page.locator('dialog[open] .boton.peligro').count(): page.locator('dialog[open] .boton.peligro').last.click(); page.wait_for_timeout(400)
    n=evt("return (await c('comentarios').listar()).filter(x=>x.texto==='no va').length + (await c('tareas').listar()).filter(x=>x.titulo==='Descartada').length")
    chk(n==0, 'cancelar descarta')
    # ── Tarea existente: comentario solo imagen + notas sin tocar ──
    tid=evt("const t=(await c('tareas').listar()).find(x=>x.titulo==='Pagar seguro'); await c('tareas').actualizar(t.id,{notas:'* item viejo\\n\\nTexto  raro'}); return t.id")
    page.goto(U+'#/tareas'); page.wait_for_timeout(1000)
    page.evaluate("async (id) => { const R = await import('/js/core/registro.js'); }", tid)
    page.goto(U+'#/tareas'); page.wait_for_timeout(800)
    page.locator('.tr-hojas .tr-pest[title="Hoy"]').click(); page.wait_for_timeout(700)
    page.locator('.tr-tarea:has(.tr-titulo:text-is("Pagar seguro")) .tr-cuerpo').first.click(); page.wait_for_timeout(900)
    ed='.tr-editor'
    chk(page.locator(f'{ed} .tr-notas .ed-area ul li').count()==1, 'notas existentes con formato')
    page.set_input_files(f'{ed} .tr-nuevo-comentario input[type=file]', '/home/claude/segundo-cerebro/icons/icono-192.png'); page.wait_for_timeout(1500)
    page.locator(f'{ed} .tr-com-enviar').click(); page.wait_for_timeout(800)
    cs=evt(f"return (await c('comentarios').listar()).filter(x=>x.tareaId==='{tid}').map(x=>[x.texto,(x.adjuntos||[]).length])")
    chk(cs==[['',1]], f'comentario solo imagen tarea existente {cs}')
    page.locator(f'{ed} .tr-titulo-input').fill('Pagar seguro auto')
    page.locator(f'{ed} button[type=submit]').click(); page.wait_for_timeout(800)
    nt=evt(f"return (await c('tareas').obtener ? await c('tareas').obtener('{tid}') : (await c('tareas').listar()).find(x=>x.id==='{tid}')).notas")
    chk(nt=='* item viejo\n\nTexto  raro', f'notas sin tocar quedan igual {nt!r}')
    print(w, 'err', err)
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
