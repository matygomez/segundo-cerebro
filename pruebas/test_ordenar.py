# Bitácora: archivos para revisar (ordenar.js). Gemini se simula.
from playwright.sync_api import sync_playwright
import json, os
U='http://localhost:8765/'; S=os.path.dirname(os.path.abspath(__file__))+'/capturas/'
ok=0; fallas=[]
def chk(c,n):
    global ok
    if c: ok+=1
    else: fallas.append(n); print('FALLA',n)
PDF=b'%PDF-1.4\n% factura metrogas\n'
SEED="""async () => {
  const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
  const m = M.crearModelo(R.contexto('bitacora'));
  const casa = await m.crearCarpeta({ nombre: 'Casa' });
  const serv = await m.crearCarpeta({ nombre: 'Servicios', padreId: casa });
  const gas = await m.crearCarpeta({ nombre: 'Gas', padreId: serv });
  const luz = await m.crearCarpeta({ nombre: 'Luz', padreId: serv });
  const exp = await m.crearCarpeta({ nombre: 'Expensas', padreId: casa });
  await m.guardarAjuste('gemini', { api: 'clave-de-prueba' });
  return { casa, serv, gas, luz, exp };
}"""
def respuesta(ids, seguro=True):
    x={'nombre':'2026-10 Gas Metrogas','carpetaId':ids['gas'] if seguro else ids['exp'],'seguro':seguro,'alternativas':[ids['casa']],'carpetaNueva':'',
       'que':'Factura de gas','de':'Metrogas','fecha':'2026-10-05','vence':'2026-10-27','monto':18430,'contenido':'Metrogas S.A. Período 09/2026 Total a pagar 18430'}
    return {'candidates':[{'content':{'parts':[{'text':json.dumps(x)}]}}]}
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366,390):
    cx=b.new_context(viewport={'width':w,'height':900}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e))); page.on('console', lambda m: err.append(m.text) if m.type=='error' else None)
    estado={'seguro':True,'pedidos':0}
    page.goto(U); page.wait_for_timeout(800)
    ids=page.evaluate(SEED)
    def gem(route):
        estado['pedidos']+=1
        if estado.get('falla'): route.fulfill(status=429, body='{}'); return
        cuerpo=json.loads(route.request.post_data)
        estado['tieneArchivo']=any('inline_data' in pt for pt in cuerpo['contents'][0]['parts'])
        route.fulfill(status=200, content_type='application/json', body=json.dumps(respuesta(ids, estado['seguro'])))
    page.route('https://generativelanguage.googleapis.com/**', gem)
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1200)
    chk(page.locator('.bt-or-zona').count()==1,'zona subir')
    with page.expect_file_chooser() as fc: page.locator('.bt-or-zona').click()
    fc.value.set_files(files=[{'name':'factura_0458812.pdf','mimeType':'application/pdf','buffer':PDF}])
    page.wait_for_timeout(2000)
    chk(estado['pedidos']==1 and estado.get('tieneArchivo'),'gemini recibió el pdf')
    chk(page.locator('.bt-or-item:has-text("2026-10 Gas Metrogas")').count()==1,'item listo')
    chk(page.locator('.bt-or-est.confirmar').count()==1,'estado para confirmar')
    page.screenshot(path=S+f'or_lista_{w}.png', full_page=True)
    page.locator('.bt-or-item').first.click(); page.wait_for_timeout(600)
    chk(page.locator('dialog .bt-or-elegida:has-text("Casa › Servicios › Gas")').count()==1,'carpeta propuesta')
    page.screenshot(path=S+f'or_revisar_{w}.png', full_page=True)
    page.locator('dialog button:has-text("Confirmar")').click(); page.wait_for_timeout(1500)
    r=page.evaluate("""async () => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
      const d = await M.crearModelo(R.contexto('bitacora')).cargar(); const n = d.notas.find(x => x.archivo);
      const esp = M.espejoDe(d).archivos.filter(x => x.copiaDe || x.clave.startsWith('nota:'+n?.id));
      return { titulo: n?.titulo, carpeta: n && d.nombreRuta(n.carpetaId), monto: n?.archivo.monto, adj: n?.adjuntos?.[0]?.nombre, pend: d.pendientes.length, rec: d.recordatorios.map(x => [x.titulo, x.fecha]), esp: esp.map(x => x.ruta.join('/') + '/' + x.nombre), id: n?.id }; }""")
    print(r)
    chk(r['titulo']=='2026-10 Gas Metrogas' and r['carpeta']=='Casa › Servicios › Gas','nota creada en carpeta')
    chk(r['monto']==18430 and r['adj']=='2026-10 Gas Metrogas.pdf','datos y adjunto')
    chk(r['pend']==0,'pendiente borrado')
    hoy=__import__('datetime').date.today().isoformat()
    chk(r['rec']==[['Pagar Factura de gas ($ 18.430)',max('2026-10-24',hoy)]],'recordatorio 3 días antes (o hoy si ya pasó)')
    chk('Casa/Servicios/Gas/2026-10 Gas Metrogas.md' in r['esp'],'espejo md en carpeta')
    # Finanzas: se abrió el formulario de gasto con el monto
    chk(page.locator('dialog input').evaluate_all("l => l.some(i => String(i.value).replace(/\\D/g,'').startsWith('18430'))"),'formulario de gasto con monto')
    page.keyboard.press('Escape'); page.wait_for_timeout(400)
    # Ficha en la nota
    page.goto(U+f'#/bitacora/n/{r["id"]}'); page.wait_for_timeout(1200)
    chk(page.locator('.bt-ficha:has-text("Metrogas")').count()==1,'ficha en la nota')
    page.screenshot(path=S+f'or_nota_{w}.png', full_page=True)
    # Buscador general: encuentra por lo que dice adentro
    res=page.evaluate("""async () => { const B = await import('/js/core/busqueda.js'); return (await B.buscar('periodo 09/2026')).map(x => [x.grupo, x.titulo]); }""")
    chk(['Archivos','2026-10 Gas Metrogas'] in res,'buscador por contenido')
    # Repetido + duda
    estado['seguro']=False
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    with page.expect_file_chooser() as fc: page.locator('.bt-or-zona').click()
    fc.value.set_files(files=[{'name':'otra.pdf','mimeType':'application/pdf','buffer':PDF}])
    page.wait_for_timeout(2000)
    chk(page.locator('.bt-or-est.repetido').count()==1,'repetido')
    page.locator('.bt-or-item').first.click(); page.wait_for_timeout(1500)
    chk(page.locator('dialog[open] .bt-comp-lado').count()==2,'comparar lado a lado')
    chk(page.locator('dialog[open] .bt-comp-lado .bt-portada').count()==2,'vista de los dos')
    page.screenshot(path=S+f'or_comparar_{w}.png', full_page=True)
    page.locator('dialog[open] button:has-text("Decidir después")').click(); page.wait_for_timeout(600)
    chk(page.locator('.bt-or-est.repetido').count()==1,'decidir despues queda en revisar')
    page.locator('.bt-or-item button:has-text("Comparar")').click(); page.wait_for_timeout(800)
    page.locator('dialog[open] .bt-or-op:has-text("Guardar los dos")').click(); page.wait_for_timeout(200)
    page.locator('dialog[open] .bt-comp-donde button:has-text("Cambiar")').click(); page.wait_for_timeout(300)
    page.locator('dialog[open] .bt-elegir:has-text("Casa")').first.click(); page.wait_for_timeout(300)
    page.locator('dialog[open] button.principal:has-text("Guardar los dos")').click(); page.wait_for_timeout(1200)
    n2=page.evaluate("""async () => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
      const d = await M.crearModelo(R.contexto('bitacora')).cargar(); return d.notas.filter(x => x.archivo).map(x => d.nombreRuta(x.carpetaId)); }""")
    chk(sorted(n2)==['Casa','Casa › Servicios › Gas'],'guardar los dos en otra carpeta')
    # Cargas mensuales: Luz falta → tarea en Sistemas; Gas subido → sin tarea
    t=page.evaluate("""async (ids) => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const O = await import('/modules/bitacora/ordenar.js');
      const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx);
      await m.guardarAjuste('mensuales', { lista: [{ id: 'a', carpetaId: ids.luz, dia: 1 }, { id: 'b', carpetaId: ids.gas, dia: 1 }] });
      await O.sincronizarMensuales(ctx, m);
      return (await R.contexto('tareas').datos('tareas').listar()).filter(x => String(x.origen?.clave||'').startsWith('bitacora-mes:')).map(x => x.titulo); }""", ids)
    print(t)
    chk(len(t)==1 and t[0].startswith('Falta subir: Luz'),'tarea mensual solo de Luz')
    page.goto(U+'#/bitacora/ajustes'); page.wait_for_timeout(1200)
    chk(page.locator('section:has-text("Cargas mensuales") .bt-or-falta').count()==1 and page.locator('section:has-text("Cargas mensuales") .bt-or-ok').count()==1,'ajustes mensuales')
    chk(page.locator('section:has-text("Clave de Gemini") input[type=password]').count()==1,'ajustes clave')
    page.screenshot(path=S+f'or_ajustes_{w}.png', full_page=True)
    # Compartir desde el celular: va a Para revisar
    page.evaluate("""async () => { const c = await caches.open('sc-compartido'); const u = (n) => new URL('./__compartido/'+n, location.href).href;
      await c.put(u('a1'), new Response(new Blob(['%PDF-1.4 luz'], { type: 'application/pdf' })));
      await c.put(u('datos'), new Response(JSON.stringify({ titulo: '', texto: '', url: '', archivos: [{ clave: 'a1', nombre: 'luz.pdf', tipo: 'application/pdf' }] }))); }""")
    page.goto(U+'#/bitacora/compartir'); page.wait_for_timeout(2500)
    chk('pendientes' in page.url and page.locator('.bt-or-item:has-text("Compartido")').count()==1,'compartido a revisar')
    # Gemini con límite (429): queda en espera, se reintenta y se puede ordenar a mano
    estado['seguro']=True; estado['falla']=True
    page.goto(U+'#/bitacora/pendientes'); page.wait_for_timeout(1000)
    with page.expect_file_chooser() as fc: page.locator('.bt-or-zona').click()
    fc.value.set_files(files=[{'name':'agua.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 agua'}])
    page.wait_for_timeout(2000)
    chk(page.locator('.bt-or-item:has-text("agua.pdf"):has-text("En espera")').count()==1,'en espera por limite')
    chk(page.locator('.bt-or-item:has-text("agua.pdf") button:has-text("Reintentar ahora")').count()==1,'boton reintentar ahora')
    estado['falla']=False
    page.locator('.bt-or-item:has-text("agua.pdf") button:has-text("Reintentar ahora")').click(); page.wait_for_timeout(2000)
    chk(page.locator('.bt-or-item:has-text("2026-10 Gas Metrogas"):has-text("Para confirmar")').count()>=1,'reintento lo leyó')
    estado['falla']=True
    with page.expect_file_chooser() as fc: page.locator('.bt-or-zona').click()
    fc.value.set_files(files=[{'name':'internet.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4 internet'}])
    page.wait_for_timeout(2000)
    page.locator('.bt-or-item:has-text("internet.pdf")').click(); page.wait_for_timeout(500)
    chk(page.locator('dialog[open] .bt-or-duda:has-text("límite")').count()==1,'revisar a mano en espera')
    page.locator('dialog[open] input[type=text]').first.fill('Internet octubre')
    page.locator('dialog[open] button:has-text("Otra carpeta")').click(); page.wait_for_timeout(300)
    page.locator('dialog[open] .bt-elegir:has-text("Luz")').click(); page.wait_for_timeout(300)
    page.locator('dialog[open] button:has-text("Confirmar")').click(); page.wait_for_timeout(1200)
    chk(page.evaluate("async () => { const R = await import('/js/core/registro.js'); return (await R.contexto('bitacora').datos('notas').listar()).some(n => n.titulo === 'Internet octubre'); }"),'guardado a mano')
    estado['falla']=False
    print(w, 'errores', [e for e in err if 'favicon' not in e][:5])
    cx.close()
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
