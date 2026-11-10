# Finanzas: resumen nombrado por el mes de las compras (cierre 1–15), valor por cuota, ajuste clasificado como transferencia, pestañas en el botón Gasto del Inicio.
from playwright.sync_api import sync_playwright
import datetime, os
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
SEED="""async()=>{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);const id=x=>x.id||x;
 const cat=id(await c('categorias').crear({nombre:'Hogar',tipo:'variable',orden:1}));
 const g=id(await c('cuentas').crear({nombre:'Galicia',tipo:'cuenta',saldoInicial:500000,orden:1}));
 const a=id(await c('cuentas').crear({nombre:'Ahorro',tipo:'cuenta',saldoInicial:0,orden:2}));
 const v=id(await c('creditos').crear({nombre:'Visa',diaCierre:4,diaVencimiento:15,orden:1}));
 const mv=x=>c('movimientos').crear(x);
 await mv({tipo:'gasto',fecha:'2026-11-10',importe:77777.76,creditoId:v,cuotas:2,categoriaId:cat,descripcion:'Compra'});
 await mv({tipo:'gasto',fecha:'2026-11-10',importe:150000,cuentaId:g,categoriaId:'ajuste',ajuste:true,descripcion:'Ajuste de saldo'});
}"""
MODELO="""async()=>{const R=await import('/js/core/registro.js');const M=await import('/modules/finanzas/modelo.js');
 const d=await M.crearModelo(R.contexto('finanzas')).cargar();const v=d.creditos[0];
 const qs=d.cuotas().filter(q=>q.mov.descripcion==='Compra');
 return {nombres:qs.map(q=>d.mesNombreResumen(v,q.mes)),claveNov:d.mesClaveResumen(v,'2026-11'),
   saldoG:d.saldo(d.cuentas.find(c=>c.nombre==='Galicia').id),saldoA:d.saldo(d.cuentas.find(c=>c.nombre==='Ahorro').id)};}"""
CLASIF="""async()=>{const R=await import('/js/core/registro.js');const M=await import('/modules/finanzas/modelo.js');const F=await import('/modules/finanzas/formularios.js');
 const ctx=R.contexto('finanzas');const m=M.crearModelo(ctx);const d=await m.cargar();F.abrirClasificar(ctx,m,d,d.movimientos.find(x=>x.ajuste));}"""
with sync_playwright() as p:
  ex='/opt/pw-browsers/chromium'
  b=p.chromium.launch(executable_path=ex) if os.path.exists(ex) else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.clock.set_fixed_time(datetime.datetime(2026,11,10,12,0))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.goto(U+'#/finanzas'); page.reload(); page.wait_for_timeout(2500)
    r=page.evaluate(MODELO); print(r)
    chk(r['nombres']==['2026-11','2026-12'], f"cuotas en noviembre y diciembre ({r['nombres']})")
    chk(r['claveNov']=='2026-12', 'el resumen de noviembre es el que cierra en diciembre')
    # Crédito de noviembre muestra la compra
    page.get_by_text('Crédito ›').first.click(); page.wait_for_timeout(1500)
    t=page.locator('main').inner_text()
    chk('resumen de noviembre' in t and 'Compra' in t, 'Crédito de noviembre muestra la compra de hoy')
    page.screenshot(path=S+f'tca_credito_{w}.png')
    # Botón Gasto del Inicio: pestañas, valor por cuota
    page.goto(U); page.wait_for_timeout(1500)
    page.get_by_role('button', name='Gasto', exact=True).first.click(); page.wait_for_timeout(800)
    dlg=page.locator('dialog[open]')
    chk(dlg.locator('.fz-tipos').count()==1, 'pestañas Gasto/Ingreso/Transferencia')
    chk(not dlg.get_by_text('"Ya pagado" es para gastos').is_visible(), 'nota de Ya pagado oculta')
    dlg.locator('select').first.select_option(label='Visa (crédito)') if dlg.locator('select').first.locator('option', has_text='Visa').count() else None
    page.wait_for_timeout(300)
    vc=dlg.locator('input[aria-label="Valor por cuota"]')
    chk(vc.is_disabled(), 'valor por cuota apagado con 1 cuota')
    dlg.locator('input[type=number]').fill('2'); page.wait_for_timeout(200)
    vc.fill('5000'); page.wait_for_timeout(200)
    chk(dlg.locator('input.fz-importe').input_value() in ('10000','10000,00'), f"importe = 10000 ({dlg.locator('input.fz-importe').input_value()})")
    t=dlg.inner_text(); chk('cuotas de' not in t, 'sin texto de cuotas abajo'); chk('resumen de noviembre' in t, f'entra en noviembre')
    page.screenshot(path=S+f'tca_gasto_{w}.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    # Clasificar ajuste como transferencia
    page.goto(U+'#/finanzas'); page.wait_for_timeout(1500)
    page.evaluate(CLASIF); page.wait_for_timeout(800)
    dlg=page.locator('dialog[open]')
    dlg.get_by_role('button', name='Transferencia').click(); page.wait_for_timeout(200)
    dlg.locator('input.fz-importe').fill('100000')
    sel=dlg.locator('label', has_text='¿A qué cuenta fue?').locator('select'); sel.select_option(label='Ahorro')
    dlg.get_by_role('button', name='Agregar línea').click(); page.wait_for_timeout(800)
    t=dlg.inner_text(); chk('Transferencia a Ahorro' in t, 'línea de transferencia')
    page.screenshot(path=S+f'tca_clasif_{w}.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    r=page.evaluate(MODELO); print(r)
    chk(r['saldoA']==100000 and r['saldoG']==350000, f"saldos ({r['saldoG']}, {r['saldoA']})")
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll de costado')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
