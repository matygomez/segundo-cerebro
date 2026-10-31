# Finanzas: Crédito muestra el resumen del mes elegido (pagado, falta o dejado para el mes siguiente), en el detalle y en el Panel.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const cat=id(await c('categorias').crear({nombre:'Varios',tipo:'variable',orden:1}));
 const g=id(await c('cuentas').crear({nombre:'Galicia',tipo:'cuenta',saldoInicial:1000000,orden:1}));
 const v=id(await c('creditos').crear({nombre:'Visa',diaCierre:28,diaVencimiento:10,orden:1}));
 const mv=x=>c('movimientos').crear(x);
 await mv({tipo:'gasto',fecha:'2026-09-10',importe:50000,creditoId:v,cuotas:1,categoriaId:cat,descripcion:'Coto'});
 await mv({tipo:'transferencia',fecha:'2026-10-09',importe:50000,cuentaId:g,destinoCreditoId:v});
 await mv({tipo:'gasto',fecha:'2026-10-05',importe:100000,creditoId:v,cuotas:1,categoriaId:cat,descripcion:'Heladera'});
 await c('ajustes').crear({clave:'credito-reparto',meses:{'2026-11':40000}});
}"""
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,10,31,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.goto(U+'#/finanzas/detalle/credito'); page.reload(); page.wait_for_timeout(2500)
    det=lambda: page.locator('.fz-det-grilla').last.inner_text()
    t=det(); print(t.replace('\n',' | ')[:250])
    chk('resumen de octubre' in t and 'Heladera' in t and 'Coto' not in t, 'octubre: resumen que cierra en octubre')
    chk('Falta pagar' in t and '60.000' in t and 'Pasado a noviembre' in t, 'falta 60.000 y 40.000 pasado a noviembre')
    ant=page.locator('.fz-mes button[aria-label="Mes anterior"]').first
    ant.click(); page.wait_for_timeout(800); t=det()
    chk('Coto' in t and 'Pagado' in t and 'Heladera' not in t, 'septiembre: pagado')
    page.locator('.fz-mes button[aria-label="Mes siguiente"]').first.click(); page.wait_for_timeout(500)
    page.locator('.fz-mes button[aria-label="Mes siguiente"]').first.click(); page.wait_for_timeout(800); t=det()
    chk('Sin resumen en noviembre' in t, 'noviembre: sin resumen')
    page.screenshot(path=S+f'tcm_det_{w}.png')
    # Panel
    page.locator('.fz-mes-centro').first.click(); page.wait_for_timeout(500)
    page.evaluate("localStorage.setItem('fz-plegados','[]')"); page.goto(U+'#/finanzas'); page.wait_for_timeout(1500)
    tj=page.locator('details.fz-tarjeta').first; tj.locator('summary').click(); page.wait_for_timeout(300)
    t=tj.inner_text(); chk('Falta pagar' in t and 'Heladera' in t, 'panel: misma información')
    page.locator('.fz-mes button[aria-label="Mes anterior"]').first.click(); page.wait_for_timeout(800)
    chk('Pagado' in page.locator('details.fz-tarjeta').first.inner_text(), 'panel: septiembre pagado')
    page.screenshot(path=S+f'tcm_panel_{w}.png')
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll de costado')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
