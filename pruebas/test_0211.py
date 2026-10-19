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
    txt=page.locator('.tr-proximos .tr-programadas').inner_text(); chk('15/03/2099' in txt, f'año en aparece: {txt[:200]}')
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
    page.locator('.tr-ocultar input').check()
    page.click('.tr-editor button[type=submit]'); page.wait_for_timeout(900)
    t=page.evaluate("async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','tareas').listar()).find(t=>t.titulo==='Normal')}")
    chk(t['inicio']==t['fecha'], f'ocultar guarda inicio=fecha {t["inicio"]} {t["fecha"]}')
    chk(page.locator('.tr-proximos .tr-programadas-boton').inner_text().startswith('3 programadas'), 'ahora 3 programadas')
    chk(not err, f'errores {err}')
  b.close()
print(ok,'ok',len(fallas),'fallas')
