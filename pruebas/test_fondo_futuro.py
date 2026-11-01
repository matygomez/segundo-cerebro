# Finanzas: una transferencia al fondo cargada para el mes que viene no se descuenta dos veces.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const cat=id(await c('categorias').crear({nombre:'Varios',tipo:'variable',orden:1}));
 const g=id(await c('cuentas').crear({nombre:'Nacion',tipo:'cuenta',saldoInicial:3000000,orden:1}));
 const f=id(await c('cuentas').crear({nombre:'Fondo',tipo:'reserva',fondoCredito:true,saldoInicial:184000,orden:2}));
 const v=id(await c('creditos').crear({nombre:'Visa',diaCierre:28,diaVencimiento:10,orden:1}));
 await c('movimientos').crear({tipo:'gasto',fecha:'2026-10-05',importe:800000,creditoId:v,cuotas:1,categoriaId:cat,descripcion:'Compra'});
 await c('movimientos').crear({tipo:'transferencia',fecha:'2026-11-01',importe:700000,cuentaId:g,destinoId:f});
}"""
DISP="""async(mes)=>{const R=await import('/js/core/registro.js');const M=await import('/modules/finanzas/modelo.js');
 const d=await M.crearModelo(R.contexto('finanzas')).cargar();return d.resumenMes(mes).disponible;}"""
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  res={}
  for dia in (31,1):
    cx=b.new_context(); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,10 if dia==31 else 11,dia,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    res[dia]=page.evaluate(DISP,'2026-11'); print(dia, res[dia])
    chk(not err, f'errores {err}'); cx.close()
  chk(res[31]==res[1], f'noviembre igual el 31/10 y el 1/11 ({res[31]} vs {res[1]})')
  chk(res[1]==3000000-700000, f'valor esperado ({res[1]})')
print(ok[0],'ok',len(mal),'fallas')
