# Carpeta en miniaturas (miniatura de Google, sin guardar nada) y total de "Para revisar".
from playwright.sync_api import sync_playwright
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
exec(open('fake_drive.py').read())
exec(open('test_espejo.py').read().split("\nwith sync_playwright")[0].split("exec(open('fake_drive.py').read())")[1])
PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    fd=FakeDrive(); page,err=armar(b, fd); page.set_viewport_size({'width':w,'height':900})
    page.goto(U); page.wait_for_timeout(1500)
    ids=page.evaluate(SEED)
    con=fd.nuevo('factura.pdf',[],'application/pdf',b'%PDF'); con['thumbnailLink']=PNG
    sin=fd.nuevo('nueva.pdf',[],'application/pdf',b'%PDF')
    page.evaluate(EV, f"""
      await m.crearNota({{titulo:'Factura gas', carpetaId:'{ids['clu']}', archivo:{{lectura:'lista'}}, adjuntos:[{{origen:'subido', principal:true, driveId:'{con['id']}', nombre:'factura.pdf', tipo:'application/pdf'}}]}});
      await m.crearNota({{titulo:'Recién subida', carpetaId:'{ids['clu']}', adjuntos:[{{origen:'subido', principal:true, driveId:'{sin['id']}', nombre:'nueva.pdf', tipo:'application/pdf'}}]}});
      await ctx.datos('pendientes').crear({{original:'x.pdf', estado:'lista', creado:Date.now()}});""")
    page.goto(U+'#/bitacora/c/'+ids['clu']); page.wait_for_timeout(1500)
    total=page.evaluate("(async()=>{const M=await import('/modules/bitacora/modelo.js');const R=await import('/js/core/registro.js');return (await M.crearModelo(R.contexto('bitacora')).cargar()).totalRevisar})()")
    chk(total==2, f'{w} total para revisar cuenta pendientes + ya ubicados ({total})')
    if w>=900: chk('2' in page.locator('.bt-ar', has_text='Para revisar').inner_text(), 'panel muestra el total')
    chk(page.locator('.bt-lista').count()==1, f'{w} arranca en lista')
    page.get_by_role('button', name='Ver en miniaturas').click(); page.wait_for_timeout(1500)
    chk(page.locator('.bt-grilla .bt-mtarj').count()>=3, f'{w} grilla con tarjetas')
    chk(page.locator('.bt-mtarj', has_text='Factura gas').locator('.bt-mini.con-img img').count()==1, f'{w} miniatura de Google')
    chk(page.locator('.bt-mtarj', has_text='Recién subida').locator('.bt-mini-ic').is_visible(), f'{w} sin miniatura: ícono')
    chk(page.evaluate("caches.keys().then(k=>caches.open('sc-imagenes').then(c=>c.keys())).then(x=>x.length)")==0, f'{w} no guarda nada')
    page.screenshot(path=S+f'miniaturas_{w}.png')
    page.reload(); page.wait_for_timeout(1500)
    chk(page.locator('.bt-grilla').count()==1, f'{w} recuerda miniaturas')
    print(w,'errores',err)
    page.context.close()
  print(f'FIN {ok} ok {len(fallas)} fallas', fallas)
