# Finanzas: si el fondo supera todo lo que hay que pagar, Crédito dice cuánto sobra.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const cat=id(await c('categorias').crear({nombre:'Varios',tipo:'variable',orden:1}));
 await c('cuentas').crear({nombre:'Fondo',tipo:'reserva',fondoCredito:true,saldoInicial:1000000,orden:2});
 const v=id(await c('creditos').crear({nombre:'Visa',diaCierre:28,diaVencimiento:10,orden:1}));
 await c('movimientos').crear({tipo:'gasto',fecha:'2026-10-05',importe:800000,creditoId:v,cuotas:1,categoriaId:cat,descripcion:'Compra'});
}"""
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    page=b.new_page(viewport={'width':w,'height':850}); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,11,3,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.goto(U+'#/finanzas/detalle/credito'); page.reload(); page.wait_for_timeout(2500)
    t=page.locator('main').inner_text()
    chk('Sobran $\xa0200.000 en el fondo' in t, 'métrica: sobran 200.000')
    chk(not err, f'errores {err}'); page.close()
print(ok[0],'ok',len(mal),'fallas')
