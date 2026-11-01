# Finanzas: cada cambio de presupuesto queda en el historial con su fecha.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  page=b.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
  page.clock.set_fixed_time(datetime.datetime(2026,11,1,12,0))
  page.goto(U); page.wait_for_timeout(1500)
  r=page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const R=await import('/js/core/registro.js');const M=await import('/modules/finanzas/modelo.js');
   const c=D.coleccion('finanzas','categorias');await c.crear({nombre:'Gas',tipo:'fijo',orden:1,presupuestos:[{desde:'2026-10',monto:38000}]});
   const m=M.crearModelo(R.contexto('finanzas'));let d=await m.cargar();let g=d.categoriasDe('fijo')[0];
   await m.cambiarPresupuesto(g,30000,'2026-11');d=await m.cargar();g=d.categoriasDe('fijo')[0];
   await m.cambiarPresupuesto(g,25000,'2026-11');d=await m.cargar();g=d.categoriasDe('fijo')[0];
   return {h:g.cambiosPresupuesto,p:d.presupuesto(g,'2026-11'),o:d.presupuesto(g,'2026-10')};}""")
  print(r)
  chk(len(r['h'])==2 and r['h'][0]['antes']==38000 and r['h'][1]['antes']==30000 and r['h'][1]['despues']==25000, 'dos cambios anotados en el mismo mes')
  chk(r['p']==25000 and r['o']==38000, 'presupuesto vigente y octubre intacto')
  page.evaluate("localStorage.setItem('fz-plegados','[]')"); page.goto(U+'#/finanzas'); page.reload(); page.wait_for_timeout(2500)
  page.locator('[title="Ver presupuesto e historial"]').filter(has_text='Gas').first.click(); page.wait_for_timeout(600)
  t=page.locator('dialog[open]').inner_text(); print(t[-200:].replace('\n',' | '))
  chk('01/11: $\xa030.000 → $\xa025.000' in t and '01/11: $\xa038.000 → $\xa030.000' in t, 'historial visible con fechas')
  chk(not err, f'errores: {err}')
print(ok[0],'ok',len(mal),'fallas')
