# Para revisar en la PC: panel al costado, "Listo, siguiente" guarda y abre el próximo; en el celular sigue la ventana.
from playwright.sync_api import sync_playwright
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
CREAR="""async (ids) => { const R = await import('/js/core/registro.js'); const ctx = R.contexto('bitacora'); const col = ctx.datos('pendientes'); let t = Date.now();
  for (const n of ['scan_001.pdf','scan_002.pdf','scan_003.pdf']) await col.crear({ estado: 'espera', error: 'Gemini llegó al límite gratis en todos los modelos.', proximo: Date.now()+3600e3, original: n, tipo: 'application/pdf', via: 'Prueba', adjunto: { pendiente: 'x', nombre: n, tipo: 'application/pdf' }, huella: n, propuesta: null, creado: t++ }); }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366, 390):
    cx=b.new_context(viewport={'width':w,'height':900}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800)
    ids=page.evaluate(SEED); page.evaluate(CREAR, ids)
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1200)
    page.locator('.bt-or-item', has_text='scan_001.pdf').click(); page.wait_for_timeout(800)
    if w>=900:
      chk(page.locator('.bt-rev-panel').count()==1 and page.locator('dialog[open]').count()==0, 'abre al costado, no ventana')
      chk('1 de 3' in page.locator('.bt-rev-cab').inner_text(), 'muestra 1 de 3')
      chk(page.locator('.bt-or-item.sel', has_text='scan_001').count()==1, 'marca el elegido en la lista')
      page.locator('.bt-rev-panel input[type=text]').first.fill('Factura gas')
      page.locator('.bt-rev-panel .bt-or-op, .bt-rev-panel .bt-elegir-boton').first.click(); page.wait_for_timeout(400)
      page.locator('dialog[open] button', has_text='Curso CLU').first.click(); page.wait_for_timeout(400)
      page.locator('.bt-rev-panel button', has_text='Listo, siguiente').click(); page.wait_for_timeout(1500)
      chk('scan_002' in page.locator('.bt-rev-cab').inner_text(), 'pasa al siguiente')
      n=page.evaluate("(async()=>{const M=await import('/modules/bitacora/modelo.js');const R=await import('/js/core/registro.js');const d=await M.crearModelo(R.contexto('bitacora')).cargar();return [d.pendientes.length, d.notas.filter(n=>n.titulo==='Factura gas').length]})()")
      chk(n==[2,1], 'guardó el primero %s'%n)
      page.locator('.bt-rev-panel button', has_text='Saltar').click(); page.wait_for_timeout(1000)
      chk('scan_003' in page.locator('.bt-rev-cab').inner_text(), 'saltar pasa al siguiente')
      # se redibuja la pantalla (sincronización) y el panel sigue con lo escrito
      page.locator('.bt-rev-panel input[type=text]').first.fill('Escrito a mano')
      page.evaluate("(async()=>{const R=await import('/js/core/registro.js');await R.contexto('bitacora').datos('ajustes').crear({clave:'x'})})()"); page.wait_for_timeout(800)
      page.evaluate("document.activeElement.blur()"); page.evaluate("(async()=>{const R=await import('/js/core/registro.js');await R.contexto('bitacora').datos('ajustes').crear({clave:'y'})})()"); page.wait_for_timeout(800)
      chk(page.locator('.bt-rev-panel input[type=text]').first.input_value()=='Escrito a mano', 'no pierde lo escrito al redibujar')
      page.screenshot(path=S+'revisar_lateral_1366.png')
      page.locator('.bt-rev-cab button[aria-label=Cerrar]').click(); page.wait_for_timeout(600)
      chk(page.locator('.bt-rev-panel').count()==0, 'cerrar')
    else:
      chk(page.locator('dialog[open]').count()==1 and page.locator('.bt-rev-panel').count()==0, 'celular: ventana como antes')
    print(w,'errores',err); cx.close()
  print(f'FIN {ok} ok {len(fallas)} fallas', fallas)
