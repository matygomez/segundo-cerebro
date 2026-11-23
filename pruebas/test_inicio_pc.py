# Inicio en la PC (0.41.0): franja con fecha/tiempo/memento y aviso del Resumen, paneles fijos, sin columna,
# Resumen fuera de la barra y Estadísticas al final del Mes. El celular sigue con el Inicio de siempre.
from playwright.sync_api import sync_playwright
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open('test_020.py').read().split("\nwith sync_playwright")[0])
exec('SEEDR=' + open('test_021.py').read().split('SEEDR=', 1)[1].split('\nwith sync_playwright')[0])
with sync_playwright() as p:
  b=p.chromium.launch()
  for w, hgt in ((1366, 700), (1920, 940)):
    cx=b.new_context(viewport={'width':w,'height':hgt}); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEED); page.evaluate(SEEDH); page.evaluate(SEEDR)
    page.goto(U+'#/tareas'); page.wait_for_timeout(500); page.goto(U+'#/home'); page.wait_for_timeout(3000)
    chk(page.locator('.ip').count()==1, f'{w}: Inicio de la PC')
    lugares=page.evaluate("[...document.querySelectorAll('.ip-card')].map(c=>[...c.classList].find(x=>x.startsWith('ip-')&&x!=='ip-card'))"); print(lugares)
    chk(lugares==['ip-dia','ip-habitos','ip-mes','ip-bitacora','ip-semana','ip-viendo'], 'los seis paneles en su lugar')
    chk(page.evaluate("getComputedStyle(document.querySelector('.pc-colw')).display")=='none', 'sin columna')
    chk(page.locator('.pc-mods [data-id="resumen"]').count()==0, 'Resumen fuera de la barra')
    chk(page.evaluate("document.documentElement.scrollHeight<=innerHeight+2 && document.documentElement.scrollWidth<=innerWidth"), 'entra en una pantalla')
    chk(page.locator('.clp-ahora').count()==1, 'Mi día con la línea de ahora')
    chk(page.locator('.clp-sem .clp-dia').count()==7, 'semana de 7 días')
    # Aviso: ocupa el lugar del memento; con "Ahora no" pasa al siguiente y al final quedan Semana y Mes.
    chk(page.locator('.rsp-aviso').count()==1 and page.locator('.ip-mm').is_hidden(), 'aviso en lugar del memento')
    for _ in range(3):
      if page.locator('.rsp-b button:has-text("Ahora no")').count(): page.locator('.rsp-b button:has-text("Ahora no")').click(); page.wait_for_timeout(1200)
    chk(page.locator('.rsp-aviso').count()==0 and page.locator('.ip-mm').is_visible(), 'sin avisos vuelve el memento')
    chk(page.locator('.ip-aviso a:has-text("Semana")').count()==1 and page.locator('.ip-aviso a:has-text("Mes")').count()==1, 'botones Semana y Mes')
    # Tocar un día de la semana lo muestra en Mi día; "Hoy" vuelve.
    page.locator('.clp-dia').nth(3).click(); page.wait_for_timeout(800)
    chk(page.locator('.ip-dia h2').inner_text()!='Mi día', 'otro día en Mi día')
    page.locator('.ip-dia .ip-enlace').click(); page.wait_for_timeout(800)
    chk(page.locator('.ip-dia h2').inner_text()=='Mi día', 'vuelve a hoy')
    page.screenshot(path=S+f'inicio_pc_{w}.png')
    page.goto(U+'#/resumen/mes'); page.wait_for_timeout(2500)
    chk(page.locator('.rs-est-tit').count()==1, 'Estadísticas al final del Mes')
    print(w, err[:3]); chk(not err, 'sin errores')
    cx.close()
  cx=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); page=cx.new_page()
  page.goto(U+'#/home'); page.wait_for_timeout(1500)
  chk(page.locator('.ini').count()==1 and page.locator('.ip').count()==0, 'el celular no cambia')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
