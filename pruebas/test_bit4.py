from playwright.sync_api import sync_playwright
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
EV="""async (code) => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx); const d = await m.cargar(); return await (new Function('m','d','M','ctx', 'return (async()=>{'+code+'})()'))(m,d,M,ctx); }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600, color_scheme='dark' if w>600 else 'light'); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800)
    ids=page.evaluate(SEED); ev=lambda code: page.evaluate(EV, code)
    page.goto(U+f'#/bitacora/n/{ids["clase"]}'); page.wait_for_timeout(1000)
    page.locator('.bt-ed .ed-area').click(); page.keyboard.press('Control+End')
    page.set_input_files('.bt-formato input[type=file]', '/home/claude/segundo-cerebro/icons/icono-192.png'); page.wait_for_timeout(1500)
    v=ev(f"return d.nota('{ids['clase']}').texto"); chk('![[icono-192.png]]' in v, 'inserta imagen')
    chk(page.locator('.bt-img-caja img[src^="blob:"]').count()==1, 'muestra imagen local')
    chk(page.locator('.bt-adj').count()==1, 'lista archivos')
    page.screenshot(path=S+f'b4_nota_{w}.png', full_page=True)
    page.goto(U+'#/bitacora'); page.wait_for_timeout(900)
    page.screenshot(path=S+f'b4_ini_{w}.png')
    page.goto(U+f'#/bitacora/c/{ids["alu"]}'); page.wait_for_timeout(900)
    page.screenshot(path=S+f'b4_base_{w}.png')
    print(w, 'err', err)
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
