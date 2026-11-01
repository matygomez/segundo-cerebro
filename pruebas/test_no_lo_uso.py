# Finanzas: "No lo uso más este mes" en fijos y flechas del mes limitadas a meses con datos.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const gas=id(await c('categorias').crear({nombre:'Gas',tipo:'fijo',orden:1,presupuestos:[{desde:'2026-09',monto:2000}]}));
 const luz=id(await c('categorias').crear({nombre:'Luz',tipo:'fijo',orden:2,presupuestos:[{desde:'2026-09',monto:5000}]}));
 const g=id(await c('cuentas').crear({nombre:'Galicia',tipo:'cuenta',saldoInicial:100000,orden:1}));
 await c('movimientos').crear({tipo:'gasto',fecha:'2026-11-01',importe:1000,cuentaId:g,categoriaId:gas,descripcion:'Gas'});
 await c('movimientos').crear({tipo:'ingreso',fecha:'2026-09-05',importe:1,cuentaId:g,descripcion:'Viejo'});
}"""
num=lambda t: int(''.join(ch for ch in t if ch.isdigit()) or 0)
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,11,1,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.evaluate("localStorage.setItem('fz-plegados','[]');localStorage.setItem('fz-plegados-pc','[]')"); page.goto(U+'#/finanzas'); page.reload(); page.wait_for_timeout(2500)
    d0=num(page.locator('.fz-disponible-valor').first.inner_text()); print('disp', d0)
    chk(d0==99001-1000-5000, f'disponible inicial {d0}')
    page.locator('[title="Ver presupuesto e historial"]').filter(has_text='Gas').first.click(); page.wait_for_timeout(500)
    dlg=page.locator('dialog[open]'); chk('Libera $\xa01.000' in dlg.inner_text(), 'ofrece liberar lo que falta')
    dlg.get_by_role('button', name='No lo uso más este mes').click(); page.wait_for_timeout(1200)
    d1=num(page.locator('.fz-disponible-valor').first.inner_text()); chk(d1==d0+1000, f'vuelven 1000 al disponible ({d1})')
    cuadro=page.locator('[data-cuadro=fijos]'); t=cuadro.inner_text()
    chk('Gas\n' not in t and '+1 ✓' in t, 'Gas se oculta como pagado')
    cuadro.locator('.fz-chip-boton').click(); page.wait_for_timeout(500)
    chk('No lo uso este mes' in page.locator('[data-cuadro=fijos]').inner_text(), 'marca visible')
    page.locator('[title="Ver presupuesto e historial"]').filter(has_text='Gas').first.click(); page.wait_for_timeout(500)
    dlg=page.locator('dialog[open]'); t=dlg.inner_text(); chk('solo noviembre' in t, 'queda en el historial')
    dlg.get_by_role('button', name='Deshacer').click(); page.wait_for_timeout(1200)
    chk(num(page.locator('.fz-disponible-valor').first.inner_text())==d0, 'deshacer vuelve a reservar')
    # Flechas
    nxt=page.locator('.fz-mes button[aria-label="Mes siguiente"]').first; prv=page.locator('.fz-mes button[aria-label="Mes anterior"]').first
    chk(nxt.is_disabled(), 'no avanza más allá del último mes con datos')
    prv.click(); page.wait_for_timeout(600); prv=page.locator('.fz-mes button[aria-label="Mes anterior"]').first
    chk(not prv.is_disabled(), 'octubre: se puede ir atrás'); prv.click(); page.wait_for_timeout(600)
    chk(page.locator('.fz-mes button[aria-label="Mes anterior"]').first.is_disabled() and 'Septiembre' in page.locator('.fz-mes-centro').first.inner_text(), 'septiembre es el primero')
    page.screenshot(path=S+f'tnlu_{w}.png')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
