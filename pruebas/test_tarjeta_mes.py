# Finanzas: tarjeta cuenta en el mes de la compra, un solo selector de mes en Movimientos, fijos excedidos ocultos en el Panel.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const serv=id(await c('categorias').crear({nombre:'Servicios',tipo:'variable',orden:1}));
 const luz=id(await c('categorias').crear({nombre:'Luz',tipo:'fijo',orden:2,presupuestos:[{desde:'2026-01',monto:45000}]}));
 const alq=id(await c('categorias').crear({nombre:'Alquiler',tipo:'fijo',orden:3,presupuestos:[{desde:'2026-01',monto:100000}]}));
 const inter=id(await c('categorias').crear({nombre:'Internet',tipo:'fijo',orden:4,presupuestos:[{desde:'2026-01',monto:22000}]}));
 const g=id(await c('cuentas').crear({nombre:'Galicia',tipo:'cuenta',saldoInicial:1000000,orden:1}));
 const v=id(await c('creditos').crear({nombre:'Visa',diaCierre:28,diaVencimiento:10,orden:1}));
 const mv=x=>c('movimientos').crear(x);
 await mv({tipo:'gasto',fecha:'2026-10-30',importe:45000,creditoId:v,cuotas:1,categoriaId:serv,descripcion:'Gas'});
 await mv({tipo:'gasto',fecha:'2026-10-20',importe:90000,creditoId:v,cuotas:3,categoriaId:serv,descripcion:'Zapatillas'});
 await mv({tipo:'gasto',fecha:'2026-10-05',importe:61000,cuentaId:g,categoriaId:luz,descripcion:'Luz'});
 await mv({tipo:'gasto',fecha:'2026-10-03',importe:100000,cuentaId:g,categoriaId:alq,descripcion:'Alquiler'});
 await mv({tipo:'ingreso',fecha:'2026-09-10',importe:5000,cuentaId:g,descripcion:'Viejo'});
 return v;
}"""
MODELO="""async()=>{const R=await import('/js/core/registro.js');const M=await import('/modules/finanzas/modelo.js');
 const d=await M.crearModelo(R.contexto('finanzas')).cargar();const s=l=>l.reduce((a,g)=>a+g.importe,0);
 const v=d.creditos[0];const res=d.resumenes(v.id).find(r=>r.mes==='2026-11');
 return {oct:s(d.gastosDelMes('2026-10')),nov:s(d.gastosDelMes('2026-11')),gasEnNov:!!res&&res.items.some(q=>q.mov.descripcion==='Gas')};}"""
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,10,31,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.evaluate("localStorage.setItem('fz-plegados','[]')"); page.goto(U+'#/finanzas'); page.reload(); page.wait_for_timeout(2500)
    r=page.evaluate(MODELO); print(r)
    chk(r['oct']==45000+30000+61000+100000, f"octubre cuenta gas y 1ª cuota ({r['oct']})")
    chk(r['nov']==30000, f"noviembre solo 2ª cuota ({r['nov']})")
    chk(r['gasEnNov'], 'el gas se paga en el resumen de noviembre')
    # Fijos en el panel
    cuadro=page.locator('[data-cuadro=fijos]')
    chip=cuadro.locator('.fz-chip-boton'); t=chip.inner_text() if chip.count() else ''; print('chip', t)
    chk('+1 ✓' in t and '+1 ✕' in t, 'botón +1 ✓ | +1 ✕')
    txt=cuadro.inner_text(); chk('Internet' in txt and 'Luz' not in txt and 'Alquiler' not in txt, 'excedido y pagado ocultos')
    chip.click(); page.wait_for_timeout(600)
    cuadro=page.locator('[data-cuadro=fijos]'); t=cuadro.locator('.fz-chip-boton').inner_text()
    chk('−1 ✓' in t and '−1 ✕' in t and 'Luz' in cuadro.inner_text(), 'muestra todos con −1 ✓ | −1 ✕')
    page.screenshot(path=S+f'ttm_panel_{w}.png')
    # Movimientos
    page.goto(U+'#/finanzas/movimientos'); page.wait_for_timeout(1500)
    chk(page.locator('select[aria-label=Mes]').count()==0, 'sin desplegable de mes')
    chk(page.locator('.fz-filtro-todos input').count()==1, 'casilla ver todos')
    cont=lambda: page.locator('.fz-hoja-mov').locator('p.nota').count()
    n_oct=page.locator('main').inner_text().count('Viejo'); chk(n_oct==0, 'octubre no muestra septiembre')
    page.locator('.fz-filtro-todos input').check(); page.wait_for_timeout(500)
    chk('Viejo' in page.locator('main').inner_text(), 'ver todos muestra septiembre')
    page.locator('.fz-filtro-todos input').uncheck(); page.wait_for_timeout(300)
    page.locator('.fz-mes button[aria-label="Mes anterior"]').first.click(); page.wait_for_timeout(800)
    c=page.locator('.fz-mes-centro').first; chk('Septiembre' in c.inner_text() and 'otro' in (c.get_attribute('class') or ''), 'otro mes en amarillo')
    chk('Viejo' in page.locator('main').inner_text(), 'flechas cambian el mes de Movimientos')
    c.click(); page.wait_for_timeout(800)
    chk('Octubre' in page.locator('.fz-mes-centro').first.inner_text(), 'tocar el centro vuelve al mes actual')
    page.screenshot(path=S+f'ttm_mov_{w}.png')
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll de costado')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
