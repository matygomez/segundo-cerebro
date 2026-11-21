# Visor con zoom (PDF con hoja diminuta se ve grande) y resumen al subir varios archivos.
from playwright.sync_api import sync_playwright
import base64
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
def pdf(w,h):
    objs=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] /Contents 4 0 R >>"]
    c=f"0 0 1 rg 2 2 {w-4} {h-4} re f".encode(); out=b"%PDF-1.4\n"; offs=[]
    for i,o in enumerate(objs,1): offs.append(len(out)); out+=f"{i} 0 obj\n{o}\nendobj\n".encode()
    offs.append(len(out)); out+=b"4 0 obj\n<< /Length %d >>\nstream\n"%len(c)+c+b"\nendstream\nendobj\n"
    x=len(out); out+=b"xref\n0 5\n0000000000 65535 f \n"+b"".join(b"%010d 00000 n \n"%o for o in offs)+b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF"%x
    return out
CHICO=base64.b64encode(pdf(30,42)).decode()
with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(viewport={'width':1366,'height':900}); err=[]
  page.on('pageerror',lambda e: err.append(str(e)))
  page.goto(U); page.wait_for_timeout(1200)
  page.evaluate("""async (b64)=>{const V=await import('/modules/bitacora/visor.js');const R=await import('/js/core/registro.js');const ctx=R.contexto('bitacora');
   const f=new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'x.pdf',{type:'application/pdf'}); const adj=await ctx.archivos.subir(f); V.visor(ctx,{...adj,nombre:'x.pdf'});}""", CHICO)
  page.wait_for_timeout(2500)
  w=page.evaluate("document.querySelector('.bt-visor-pag').getBoundingClientRect().width")
  chk(w>1000, f'hoja diminuta se ve grande ({w:.0f}px)')
  page.get_by_role('button', name='Acercar').click(); page.wait_for_timeout(200)
  w2=page.evaluate("document.querySelector('.bt-visor-pag').getBoundingClientRect().width")
  chk(w2>w*1.2 and '125%' in page.locator('.bt-vis-pct').inner_text(), 'zoom +')
  page.get_by_role('button', name='Ajustar').click(); page.wait_for_timeout(200)
  chk('100%' in page.locator('.bt-vis-pct').inner_text(), 'ajustar')
  page.keyboard.press('Escape'); page.wait_for_timeout(300)
  # Subir 3 juntos, dos iguales: el aviso final dice cuál no entró y queda a la vista.
  page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1200)
  with page.expect_file_chooser() as fc: page.locator('.bt-or-zona').click()
  fc.value.set_files([{'name':'a.pdf','mimeType':'application/pdf','buffer':b'%PDF a'},{'name':'b.pdf','mimeType':'application/pdf','buffer':base64.b64decode(CHICO)},{'name':'a-copia.pdf','mimeType':'application/pdf','buffer':b'%PDF a'}])
  page.wait_for_timeout(9000)
  t=page.locator('.aviso').all_inner_texts(); print(t)
  chk(any('2 de 3' in x and 'a-copia.pdf' in x for x in t), 'resumen nombra el repetido')
  page.locator('.aviso button', has_text='Cerrar').click()
  page.locator('.bt-or-item', has_text='b.pdf').click(); page.wait_for_timeout(2500)
  chk(page.locator('.bt-rev-panel .bt-vis-barra').count()==1, 'panel con visor y zoom')
  page.screenshot(path=S+'panel_visor.png')
  print('errores', err)
  print(f'FIN {ok} ok {len(fallas)} fallas', fallas)
