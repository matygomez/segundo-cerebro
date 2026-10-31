# Finanzas: movimientos con fecha futura (saldo de hoy, a cobrar/pagar del mes, el mes que viene aparte).
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);
 const id=x=>x.id||x;
 const cat=id(await c('categorias').crear({nombre:'Varios',tipo:'variable',orden:1}));
 const ing=id(await c('categorias').crear({nombre:'Sueldo',tipo:'ingreso',orden:2}));
 const g=id(await c('cuentas').crear({nombre:'Galicia',tipo:'cuenta',saldoInicial:1000000,orden:1}));
 const mv=x=>c('movimientos').crear({cuentaId:g,...x});
 await mv({tipo:'ingreso',fecha:'2026-10-10',importe:200000,categoriaId:ing,descripcion:'Cobro viejo'});
 await mv({tipo:'gasto',fecha:'2026-10-25',importe:300000,categoriaId:cat,descripcion:'Alquiler'});
 await mv({tipo:'ingreso',fecha:'2026-10-28',importe:1800000,categoriaId:ing,descripcion:'Honorarios'});
 await mv({tipo:'ingreso',fecha:'2026-11-05',importe:2900000,categoriaId:ing,descripcion:'Sueldo'});
}"""
num=lambda t: int(''.join(ch for ch in t if ch.isdigit()) or 0)
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,10,20,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.goto(U+'#/finanzas'); page.reload(); page.wait_for_timeout(2500)
    fila=page.locator('.fz-subcuenta[data-id]').filter(has_text='Galicia').first
    chk(fila.count()==1, 'cuenta en el panel')
    t=fila.inner_text(); print(t.replace('\n',' | '))
    chk('1.200.000' in t, 'saldo de hoy sin lo futuro')
    chk('5.600.000' not in t and '4.100.000' not in t, 'lo de noviembre no suma en octubre')
    l2=fila.locator('.fz-cta-linea2'); chk(l2.count()==1, 'segunda línea')
    chk('2.700.000' in l2.inner_text(), 'queda a fin de mes')
    disp=num(page.locator('.fz-disponible-valor').first.inner_text()); chk(disp==2700000, f'disponible de octubre {disp}')
    l2.click(); page.wait_for_timeout(500)
    movs=page.locator('.fz-subcuenta[data-id]').filter(has_text='Galicia').first.locator('.fz-cta-mov').all_inner_texts()
    print(movs); chk(len(movs)==2 and 'Alquiler' in movs[0] and 'Honorarios' in movs[1], 'detalle ordenado por fecha, sin noviembre')
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll de costado')
    page.screenshot(path=S+f'tfut_oct_{w}.png')
    # Noviembre
    page.locator('.fz-mes button, button[aria-label*="siguiente" i]').last.click(); page.wait_for_timeout(1200)
    fila=page.locator('.fz-subcuenta[data-id]').filter(has_text='Galicia').first; t=fila.inner_text(); print(t.replace('\n',' | '))
    chk('2.700.000' in t and '5.600.000' in t, 'noviembre: arranca en lo de fin de octubre y suma el sueldo')
    disp=num(page.locator('.fz-disponible-valor').first.inner_text()); chk(disp==5600000, f'disponible de noviembre {disp}')
    page.screenshot(path=S+f'tfut_nov_{w}.png')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
