# 0.21.1 Tareas: una sola fecha + "Ocultar hasta ese día", año en fechas de otro año, barra de formato no tapa Guardar.
from playwright.sync_api import sync_playwright
U='http://localhost:8765/'; S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
ok=0; fallas=[]
def chk(c,n):
    global ok
    if c: ok+=1
    else: fallas.append(n); print('FALLA',n)
SEED="""async () => {
  const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('tareas', n);
  const p=(x)=>String(x).padStart(2,'0'); const f=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
  const per = await c('areas').crear({ nombre: 'Personal', orden: 1, archivada: false });
  const T = (titulo, fecha, inicio) => c('tareas').crear({ titulo, fecha, inicio, hora:'', estado:'pendiente', areaId: per, proyectoId:'', seccionId:'', etiquetas:[], subtareas:[], adjuntos:[], orden: Date.now()+Math.random() });
  await T('Solo inicio', '', f(5)); await T('Año que viene', '2099-03-15', '2099-03-15'); await T('Normal', f(3), '');
}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390, 1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(500); page.evaluate(SEED)
    page.goto(U+'#/tareas/hoy/proximos'); page.wait_for_timeout(1200)
    fechas=page.evaluate("async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','tareas').listar()).map(t=>[t.titulo,t.fecha,t.inicio])}")
    si=[x for x in fechas if x[0]=='Solo inicio'][0]; chk(si[1]==si[2] and si[1], f'migró fecha {si}')
    chk(page.locator('.tr-proximos .tr-programadas').count()==1, 'programadas en Próximos')
    page.click('.tr-proximos .tr-programadas-boton'); page.wait_for_timeout(300)
    txt=page.locator('.tr-proximos .tr-programadas').inner_text(); chk('aparecen solas' not in txt, 'sin aclaración'); chk('15/03/2099' in txt, f'año en aparece: {txt[:200]}')
    page.screenshot(path=S+f'0211_proximos_{w}.png', full_page=True)
    page.locator('.tr-tarea:has(.tr-titulo:text-is("Normal")) .tr-titulo').first.click(); page.wait_for_timeout(700)
    chk(page.locator('.tr-editor').count()==1, 'editor abierto')
    chk(page.locator('.tr-ocultar').is_visible(), 'casilla visible con fecha')
    chk('Fecha de inicio' not in page.locator('.tr-editor').inner_text(), 'sin fecha de inicio')
    if cel:
      page.locator('.tr-editor .ed-area').first.click(); page.wait_for_timeout(500)
      fb=page.locator('.ed-fija').bounding_box(); bb=page.locator('.tr-editor .tr-botones').bounding_box(); print(fb, bb)
      chk(fb and bb and bb['y']+bb['height']<=fb['y']+1, 'botones arriba de la barra de formato')
      page.screenshot(path=S+f'0211_editor_{w}.png')
      page.locator('.tr-editor input[type=date]').first.focus()
    page.locator('.tr-mas summary:has-text("Más opciones")').click(); page.wait_for_timeout(200)
    yr=page.locator('.tr-editor select').filter(has=page.locator('option[value=""]')).first
    rb=page.locator('.fila-campo:has-text("Repetición")').first.bounding_box(); db=page.locator('.fila-campo:has-text("Duración estimada")').first.bounding_box()
    chk(abs(rb['y']-db['y'])<2, f'repetición y duración en la misma fila {rb} {db}')
    if cel:
      page.set_viewport_size({'width':390,'height':450})  # como con el teclado abierto
      page.locator('.tr-nuevo-comentario textarea').focus(); page.wait_for_timeout(500)
      cb=page.locator('.tr-nuevo-comentario').bounding_box(); bb=page.locator('.tr-editor .tr-botones').bounding_box(); print(cb, bb)
      chk(cb['y']+cb['height']<=bb['y']+1, 'comentario arriba de los botones')
      page.screenshot(path=S+f'0211_comentario_{w}.png')
      page.set_viewport_size({'width':390,'height':844})
    page.locator('.tr-ocultar input').check()
    page.click('.tr-editor button[type=submit]'); page.wait_for_timeout(900)
    t=page.evaluate("async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','tareas').listar()).find(t=>t.titulo==='Normal')}")
    chk(t['inicio']==t['fecha'], f'ocultar guarda inicio=fecha {t["inicio"]} {t["fecha"]}')
    chk(page.locator('.tr-proximos .tr-programadas-boton').inner_text().startswith('3 programadas'), 'ahora 3 programadas')
    chk(not err, f'errores {err}')
  b.close()
print(ok,'ok',len(fallas),'fallas')

# 0.24.5: "Ocultar si está vacía" por hoja
with sync_playwright() as p:
  b=p.chromium.launch(); ok2=ok
  for w in (390, 1366):
    cx=b.new_context(viewport={'width':w,'height':844}, is_mobile=w<600, has_touch=w<600); page=cx.new_page()
    page.goto(U); page.wait_for_timeout(500)
    page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const c=(n)=>D.coleccion('tareas',n);
      await c('areas').crear({nombre:'Vacía',orden:1,archivada:false});const a=await c('areas').crear({nombre:'Llena',orden:2,archivada:false});
      await c('tareas').crear({titulo:'Algo',fecha:'',inicio:'',estado:'pendiente',areaId:a,proyectoId:'',seccionId:'',etiquetas:[],subtareas:[],adjuntos:[],orden:1});}""")
    page.goto(U+'#/tareas'); page.wait_for_timeout(900)
    chk(page.locator('.tr-pest[title="Vacía"]').count()==1, 'vacía visible por defecto')
    page.click('[aria-label="Configurar Tareas"]'); page.wait_for_timeout(400)
    page.screenshot(path=S+f'0245_config_{w}.png')
    page.click('[aria-label="Ocultar Vacía si está vacía"]'); page.click('[aria-label="Ocultar Llena si está vacía"]'); page.click('[aria-label="Ocultar Bandeja si está vacía"]'); page.wait_for_timeout(400)
    page.keyboard.press('Escape'); page.wait_for_timeout(500)
    chk(page.locator('.tr-pest[title="Vacía"]').count()==0, 'vacía oculta'); chk(page.locator('.tr-pest[title="Llena"]').count()==1, 'llena visible')
    chk(page.locator('.tr-pest[title="Bandeja"]').count()==0, 'bandeja vacía oculta')
    page.reload(); page.wait_for_timeout(900); chk(page.locator('.tr-pest[title="Vacía"]').count()==0, 'se guarda')
  b.close()
print(ok,'ok',len(fallas),'fallas')
