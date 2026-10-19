# Finanzas: controlar resumen de crédito (tildar gastos, total del banco, agregar faltante).
from playwright.sync_api import sync_playwright
import datetime
U='http://localhost:8765/'; S='capturas/'; ok=[0]; mal=[]
def chk(c, t):
  if c: ok[0]+=1
  else: mal.append(t); print('FALLA', t)
hoy=datetime.date.today()
def f(n): return (hoy+datetime.timedelta(days=n)).isoformat()
SEED=f"""async()=>{{const D=await import('/js/core/datos.js');const c=n=>D.coleccion('finanzas',n);
 const cat0=await c('categorias').crear({{nombre:'Super',tipo:'variable',orden:1}}); const cat={{id:cat0.id||cat0}};
 const cu=await c('cuentas').crear({{nombre:'Banco',tipo:'cuenta',saldoInicial:500000,orden:1}});
 const cr0=await c('creditos').crear({{nombre:'Visa',diaCierre:{hoy.day},diaVencimiento:28,orden:1}}); const cr={{id:cr0.id||cr0}};
 const g=(x)=>c('movimientos').crear({{tipo:'gasto',creditoId:cr.id,categoriaId:cat.id,cuotas:1,...x}});
 await g({{fecha:'{f(-3)}',importe:1000,descripcion:'Coto'}});
 await g({{fecha:'{f(-2)}',importe:3000,descripcion:'Zapatillas',cuotas:3}});
 await g({{fecha:'{f(-1)}',importe:500,descripcion:'Netflix'}});
}}"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium') if __import__('os').path.exists('/opt/pw-browsers/chromium') else p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(1500); page.evaluate(SEED)
    page.goto(U+'#/finanzas/detalle/credito'); page.reload(); page.wait_for_timeout(2500)
    bt=page.locator('.fz-ctrl-abrir'); chk(bt.count()==1, 'botón Controlar resumen al lado de la tarjeta')
    page.screenshot(path=S+f't022_det_{w}.png')
    bt.click(); page.wait_for_timeout(600)
    dlg=page.locator('dialog[open]')
    items=dlg.locator('.fz-ctrl-item'); chk(items.count()==3, f'3 gastos en el resumen ({items.count()})')
    chk('cuota 1/3' in dlg.inner_text(), 'muestra la cuota')
    items.nth(0).click(); page.wait_for_timeout(300)
    chk('Tildados 1 de 3' in dlg.inner_text(), 'tilda')
    dlg.locator('input.fz-importe').fill('3000'); dlg.locator('input.fz-importe').blur(); page.wait_for_timeout(400)
    chk('te falta anotar' in dlg.locator('.fz-ctrl-dif').inner_text(), 'avisa que falta')
    page.screenshot(path=S+f't022_ctrl_{w}.png')
    dlg.locator('.fz-ctrl-agregar').click(); page.wait_for_timeout(700)
    top=page.locator('dialog[open]').last
    chk('Entra en el resumen' in top.inner_text(), 'formulario dice a qué resumen va')
    top.locator('input.fz-importe').fill('500'); top.locator('input[type=text]:not(.fz-importe)').last.fill('Farmacia')
    top.locator('.fz-combo-input').fill('Sup'); page.wait_for_timeout(300); page.locator('[role=option]').first.click(); page.wait_for_timeout(200)
    top.locator('button[type=submit]').click(); page.wait_for_timeout(1500)
    if page.locator('dialog[open]').count()>1: print('ERROR FORM:', top.locator('.formulario-error').inner_text()); print(top.inner_text()[:600])
    dlg=page.locator('dialog[open]')
    chk(dlg.count()==1 and dlg.locator('.fz-ctrl-item').count()==4, 'el faltante aparece en la lista')
    chk('Tildados 2 de 4' in dlg.inner_text(), 'el faltante queda tildado')
    chk('Coincide' in dlg.locator('.fz-ctrl-dif').inner_text(), f'coincide con el banco: {dlg.locator(".fz-ctrl-dif").inner_text()}')
    page.screenshot(path=S+f't022_ctrl2_{w}.png')
    # Lo tildado queda guardado
    page.keyboard.press('Escape'); page.wait_for_timeout(500); page.reload(); page.wait_for_timeout(2500)
    page.locator('.fz-ctrl-abrir').click(); page.wait_for_timeout(600)
    dlg=page.locator('dialog[open]')
    chk('Tildados 2 de 4' in dlg.inner_text(), 'tildes guardados')
    chk(dlg.locator('input.fz-importe').input_value() in ('3000','3.000','$ 3.000','3000,00') or dlg.locator('input.fz-importe').input_value()!='', f'total del banco guardado ({dlg.locator("input.fz-importe").input_value()})')
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll de costado')
    chk(not err, f'errores: {err}')
    cx.close()
print(ok[0],'ok',len(mal),'fallas')
