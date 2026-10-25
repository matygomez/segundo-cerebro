# Bitácora: subir archivo directo a una carpeta + vista previa del PDF en la nota. Gemini se simula.
from playwright.sync_api import sync_playwright
import json, os
U='http://localhost:8765/'; S=os.path.dirname(os.path.abspath(__file__))+'/capturas/'
ok=0; fallas=[]
def chk(c,n):
    global ok
    if c: ok+=1
    else: fallas.append(n); print('FALLA',n)
def pdf(texto):
    # PDF mínimo de una página con un texto (para que PDF.js tenga algo que dibujar)
    cont=f'BT /F1 24 Tf 72 700 Td ({texto}) Tj ET'.encode()
    objs=[b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
          b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
          b'<< /Length %d >>\nstream\n' % len(cont) + cont + b'\nendstream', b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
    out=b'%PDF-1.4\n'; ofs=[]
    for i,o in enumerate(objs): ofs.append(len(out)); out+=b'%d 0 obj\n' % (i+1) + o + b'\nendobj\n'
    x=len(out); out+=b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs)+1) + b''.join(b'%010d 00000 n \n' % o for o in ofs)
    return out+b'trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs)+1, x)
SEED="""async () => {
  const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
  const m = M.crearModelo(R.contexto('bitacora'));
  const casa = await m.crearCarpeta({ nombre: 'Casa' });
  const luz = await m.crearCarpeta({ nombre: 'Luz', padreId: casa });
  await m.guardarAjuste('gemini', { api: 'clave-de-prueba' });
  return { casa, luz };
}"""
NOTAS="""async () => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
  const d = await M.crearModelo(R.contexto('bitacora')).cargar();
  return { notas: d.notas.filter(n => n.archivo).map(n => ({ id: n.id, titulo: n.titulo, carpeta: d.nombreRuta(n.carpetaId), a: n.archivo, adj: n.adjuntos.map(x => [x.nombre, !!x.principal]) })), rec: d.recordatorios.map(r => r.titulo), pend: d.pendientes.length }; }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366,390):
    cx=b.new_context(viewport={'width':w,'height':900}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e))); page.on('console', lambda m: err.append(m.text) if m.type=='error' else None)
    est={'falla':False,'pedidos':0}
    def gem(route):
        est['pedidos']+=1; est['prompt']=json.loads(route.request.post_data)['contents'][0]['parts'][0]['text']
        if est['falla']: route.fulfill(status=429, body='{}'); return
        if est.get('malo'): route.fulfill(status=400, body='{"error":"bad"}'); return
        x={'nombre':'2026-10 Luz Edenor','carpetaId':ids['luz'],'seguro':True,'alternativas':[],'carpetaNueva':'','que':'Factura de luz','de':'Edenor','fecha':'2026-10-08','vence':'2026-11-03','monto':22910,'contenido':'Edenor consumo 312 kWh total 22910'}
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(x)}]}}]}))
    page.goto(U); page.wait_for_timeout(800)
    ids=page.evaluate(SEED)
    page.route('https://generativelanguage.googleapis.com/**', gem)
    page.goto(U+f'#/bitacora/c/{ids["luz"]}'); page.wait_for_timeout(1200)
    page.locator('.bt-nueva').first.click(); page.wait_for_timeout(400)
    chk(page.locator('dialog[open] .bt-menu-op:has-text("Subir archivo acá")').count()==1,'opcion subir aca')
    with page.expect_file_chooser() as fc: page.locator('dialog[open] .bt-menu-op:has-text("Subir archivo acá")').click()
    fc.value.set_files(files=[{'name':'factura_edenor.pdf','mimeType':'application/pdf','buffer':pdf('Edenor 22910')}])
    page.wait_for_timeout(2500)
    r=page.evaluate(NOTAS); n=r['notas'][0] if r['notas'] else {}
    print(n.get('titulo'), n.get('carpeta'), n.get('adj'), (n.get('a') or {}).get('lectura'))
    chk(len(r['notas'])==1 and n['carpeta']=='Casa › Luz','guardada directo en la carpeta')
    chk(r['pend']==0,'no pasa por Para revisar')
    chk(n.get('titulo')=='2026-10 Luz Edenor' and n['adj']==[['2026-10 Luz Edenor.pdf',True]],'Gemini puso nombre')
    chk(n['a']['lectura']=='lista' and n['a']['monto']==22910 and n['a']['vence']=='2026-11-03' and 'kWh' in n['a']['contenido'],'datos completados')
    chk('Casa › Luz' in est.get('prompt',''),'Gemini sabe la carpeta')
    chk(page.locator('.bt-fila:has-text("2026-10 Luz Edenor"), .bt-lista a:has-text("2026-10 Luz Edenor")').count()>=1,'aparece en la carpeta')
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    chk(page.locator('.bt-or-item:has-text("2026-10 Luz Edenor"):has-text("Para confirmar")').count()==1,'leido queda para confirmar')
    chk(page.locator('.bt-or-item:has-text("2026-10 Luz Edenor") button:has-text("Leer con Gemini")').count()==1,'leer con gemini en para confirmar')
    # Nota: vista previa y sugerencias
    page.goto(U+f'#/bitacora/n/{n["id"]}'); page.wait_for_timeout(3500)
    chk(page.locator('.bt-portada img').count()==1,'vista previa del pdf')
    chk(page.locator('.bt-ficha-sug button:has-text("Crear tarea")').count()==1 and page.locator('.bt-ficha-sug button:has-text("Cargar gasto")').count()==1,'sugerencias tarea y gasto')
    page.screenshot(path=S+f'car_nota_{w}.png', full_page=True)
    page.locator('.bt-ficha-sug button:has-text("Crear tarea")').click(); page.wait_for_timeout(800)
    r=page.evaluate(NOTAS)
    chk(r['rec']==['Pagar Factura de luz ($ 22.910)'],'tarea creada')
    chk(page.locator('.bt-ficha-sug button:has-text("Crear tarea")').count()==0,'sugerencia de tarea se va')
    page.locator('.bt-portada').click(); page.wait_for_timeout(2500)
    chk(page.locator('dialog.bt-visor[open] canvas.bt-visor-pag').count()==1,'visor pantalla completa')
    page.screenshot(path=S+f'car_visor_{w}.png')
    chk(not page.evaluate("async () => !!(await (await caches.open('sc-imagenes')).keys()).find(k => k.url.includes('__archivos'))"),'no se guarda solo')
    page.locator('dialog.bt-visor button:has-text("Guardar en este dispositivo")').click(); page.wait_for_timeout(800)
    chk(page.evaluate("async () => !!(await (await caches.open('sc-imagenes')).keys()).find(k => k.url.includes('__archivos'))"),'guardado en el dispositivo')
    chk(page.locator('dialog.bt-visor button:has-text("Quitar del dispositivo")').count()==1,'boton quitar')
    page.locator('dialog.bt-visor button[aria-label="Cerrar"]').click(); page.wait_for_timeout(300)
    page.goto(U+f'#/bitacora/n/{n["id"]}'); page.wait_for_timeout(1200)
    page.locator('.bt-ficha button:has-text("Listo, completado")').click(); page.wait_for_timeout(800)
    chk(page.locator('.bt-ficha:has-text("Revisado")').count()==1,'marca revisado')
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    chk(page.locator('.bt-or-item:has-text("2026-10 Luz Edenor")').count()==0,'confirmado sale de revisar')
    # Repetido: avisa
    page.goto(U+f'#/bitacora/c/{ids["luz"]}'); page.wait_for_timeout(1000)
    page.locator('.bt-nueva').first.click(); page.wait_for_timeout(300)
    with page.expect_file_chooser() as fc: page.locator('dialog[open] .bt-menu-op:has-text("Subir archivo acá")').click()
    fc.value.set_files(files=[{'name':'otra.pdf','mimeType':'application/pdf','buffer':pdf('Edenor 22910')}])
    page.wait_for_timeout(1000)
    chk(page.locator('dialog[open]:has-text("ya lo tenés")').count()==1,'avisa repetido')
    page.locator('dialog[open] button:has-text("Cancelar"), dialog[open] button:has-text("No")').first.click(); page.wait_for_timeout(500)
    chk(len(page.evaluate(NOTAS)['notas'])==1,'repetido cancelado')
    # Arrastrar a la carpeta abierta, con Gemini en el límite → en espera
    est['falla']=True
    page.evaluate("""async (b64) => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([bytes], 'agua.pdf', { type: 'application/pdf' }));
      const main = document.querySelector('.bt-main');
      main.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
      main.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); }""", __import__('base64').b64encode(pdf('Agua 5000')).decode())
    page.wait_for_timeout(2500)
    r=page.evaluate(NOTAS); agua=[x for x in r['notas'] if x['titulo']=='agua']
    chk(len(agua)==1 and agua[0]['carpeta']=='Casa › Luz','arrastrar a la carpeta')
    chk(agua and agua[0]['a']['lectura']=='espera','en espera si Gemini no puede')
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1200)
    chk(page.locator('.bt-or-sec:has-text("Ya ubicados")').count()==1 and page.locator('.bt-or-item:has-text("agua"):has-text("Casa › Luz") button:has-text("Leer con Gemini")').count()==1,'apartado sin leer en Para revisar')
    page.screenshot(path=S+f'car_sinleer_{w}.png', full_page=True)
    page.goto(U+f'#/bitacora/n/{agua[0]["id"]}' if agua else U); page.wait_for_timeout(1500)
    chk(page.locator('.bt-ficha button:has-text("Leer con Gemini")').count()==1 and page.locator('.bt-ficha button:has-text("Listo, completado")').count()==1,'botones leer y completado en la nota')
    est['falla']=False
    page.locator('.bt-ficha button:has-text("Leer con Gemini")').click(); page.wait_for_timeout(2500)
    r=page.evaluate(NOTAS)
    chk(any(x['a']['lectura']=='lista' for x in r['notas'] if x['id']==(agua[0]['id'] if agua else '')),'reintento completó')
    # Completado a mano: sale de Para revisar
    est['falla']=True
    page.goto(U+f'#/bitacora/c/{ids["luz"]}'); page.wait_for_timeout(1000)
    page.locator('.bt-nueva').first.click(); page.wait_for_timeout(300)
    with page.expect_file_chooser() as fc: page.locator('dialog[open] .bt-menu-op:has-text("Subir archivo acá")').click()
    fc.value.set_files(files=[{'name':'gas.pdf','mimeType':'application/pdf','buffer':pdf('Gas 1234')}])
    page.wait_for_timeout(2000)
    gas=[x for x in page.evaluate(NOTAS)['notas'] if x['titulo']=='gas'][0]
    page.goto(U+f'#/bitacora/n/{gas["id"]}'); page.wait_for_timeout(1500)
    page.locator('.bt-ficha button:has-text("Listo, completado")').click(); page.wait_for_timeout(800)
    chk([x for x in page.evaluate(NOTAS)['notas'] if x['id']==gas['id']][0]['a']['lectura']=='lista','completado a mano')
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    chk(page.locator('.bt-or-item:has-text("gas")').count()==0,'sale de Para revisar')
    # Forzar lectura aunque esté completado
    est['falla']=False
    page.goto(U+f'#/bitacora/n/{gas["id"]}'); page.wait_for_timeout(1200)
    n0=est['pedidos']; page.locator('.bt-ficha button:has-text("Leer con Gemini")').click(); page.wait_for_timeout(2500)
    chk(est['pedidos']==n0+1,'forzar lectura')
    # No se pudo leer: botón Leer con Gemini en la lista
    est['malo']=True
    page.goto(U+f'#/bitacora/c/{ids["luz"]}'); page.wait_for_timeout(1000)
    page.locator('.bt-nueva').first.click(); page.wait_for_timeout(300)
    with page.expect_file_chooser() as fc: page.locator('dialog[open] .bt-menu-op:has-text("Subir archivo acá")').click()
    fc.value.set_files(files=[{'name':'raro.pdf','mimeType':'application/pdf','buffer':pdf('Raro 1')}])
    page.wait_for_timeout(2000)
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    fila=page.locator('.bt-or-item:has-text("raro"):has-text("Revisar a mano")')
    chk(fila.locator('button:has-text("Leer con Gemini")').count()==1 and fila.locator('button:has-text("Completar")').count()==1,'leer con gemini en la lista')
    est['malo']=False; n0=est['pedidos']
    fila.locator('button:has-text("Leer con Gemini")').click(); page.wait_for_timeout(2500)
    chk(est['pedidos']==n0+1 and page.locator('.bt-or-item:has-text("Para confirmar")').count()>=1,'lectura forzada desde la lista')
    # Buscador
    res=page.evaluate("""async () => { const B = await import('/js/core/busqueda.js'); return (await B.buscar('312 kWh')).map(x => x.titulo); }""")
    chk('2026-10 Luz Edenor' in res,'buscador encuentra')
    print(w, 'errores', [e for e in err if 'favicon' not in e][:5])
    cx.close()
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
