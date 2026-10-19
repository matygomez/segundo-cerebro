from playwright.sync_api import sync_playwright
exec(open('test_tareas.py').read().split("\nwith sync_playwright")[0])
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page()
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEED)
    page.goto(U+'#/home'); page.wait_for_timeout(1500)
    page.locator('.acceso:has-text("Tarea")').click(); page.wait_for_timeout(800)
    chk(page.evaluate("document.activeElement?.classList.contains('tr-titulo-input')"), f'foco titulo inicio {w}')
    page.keyboard.type('Probar foco'); chk(page.input_value('dialog[open] .tr-titulo-input')=='Probar foco', 'escribe directo')
    page.keyboard.press('Escape'); page.wait_for_timeout(400)
    if page.locator('dialog[open]').count(): page.click('dialog[open] .boton.peligro'); page.wait_for_timeout(300)
    page.goto(U+'#/calendario'); page.wait_for_timeout(1200)
    page.locator('.cl-agregar').click(); page.wait_for_timeout(1000)
    chk(page.evaluate("document.activeElement?.classList.contains('tr-titulo-input')"), f'foco titulo calendario {w}')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
