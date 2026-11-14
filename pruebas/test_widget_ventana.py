# Ventanita del widget (app de Android): tocar una tarea → Completar / Pasar a mañana / Abrir en la app.
from playwright.sync_api import sync_playwright
U='http://localhost:8765/'; S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
ok=0; fallas=[]
def chk(c,n):
    global ok
    if c: ok+=1
    else: fallas.append(n); print('FALLA',n)
SEED="""async () => {
  const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('tareas', n);
  const per = await c('areas').crear({ nombre: 'Personal', orden: 1, archivada: false });
  const casa = await c('proyectos').crear({ nombre: 'Casa', areaId: per, orden: 1, archivado: false });
  const p=(x)=>String(x).padStart(2,'0'); const d=new Date(); const hoy=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  const T = (titulo, notas) => c('tareas').crear({ titulo, notas, fecha: hoy, hora:'10:00', estado:'pendiente', areaId: per, proyectoId: casa, seccionId:'', etiquetas:[], subtareas:[], adjuntos:[], orden: Date.now()+Math.random() });
  return [await T('Pagar la luz', 'Edenor, vence el 12'), await T('Llamar al dentista', ''), await T('Mandar presupuesto', '')];
}"""
# Imita la app de Android: dice qué ventanita se abrió y anota lo que la web le pide.
STUB="""(v) => { window.__log = []; window.CerebroAndroid = {
  version: () => 5, ventana: () => v, cerrarVentana: (g) => window.__log.push('cerrar:' + g),
  abrirEnApp: (a) => window.__log.push('app:' + a), tomarAccion: () => '', guardarTareas: () => {},
  ajustesAvisos: () => '', estadoAvisos: () => '' }; }"""
LEER="""async (id) => { const D = await import('/js/core/datos.js'); return (await D.coleccion('tareas','tareas').listar()).find(t => t.id === id); }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  ctx=b.new_context(viewport={'width':390,'height':800}); page=ctx.new_page(); err=[]
  page.on('pageerror', lambda e: err.append(str(e)))
  page.goto(U); page.wait_for_timeout(1500)
  ids=page.evaluate(SEED)
  def ventana(id):
    page.add_init_script(f"({STUB})('ver-tarea:{id}')")
    page.goto(U+'?v='+id); page.wait_for_selector('dialog.ventana-tarea', timeout=8000); page.wait_for_timeout(300)
  ventana(ids[0])
  chk('Pagar la luz' in page.inner_text('dialog.ventana-tarea'), 'titulo')
  chk('Edenor' in page.inner_text('dialog.ventana-tarea'), 'notas')
  chk('Casa' in page.inner_text('dialog.ventana-tarea') and 'Personal' in page.inner_text('dialog.ventana-tarea'), 'area y proyecto')
  page.screenshot(path=S+'widget_ventana.png')
  page.click('text=✓ Completar'); page.wait_for_timeout(2500)
  t=page.evaluate(LEER, ids[0]); chk(t['estado']=='hecha', 'completada %s'%t['estado'])
  chk('cerrar:true' in page.evaluate('window.__log'), 'cierra ventanita %s'%page.evaluate('window.__log'))
  ventana(ids[1]); page.click('text=Pasar a mañana'); page.wait_for_timeout(2500)
  t=page.evaluate(LEER, ids[1]); hoy=page.evaluate("(()=>{const d=new Date();return d.toISOString()})()")
  chk(t['fecha']>page.evaluate("(()=>{const p=x=>String(x).padStart(2,'0');const d=new Date();return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`})()"), 'mañana %s'%t['fecha'])
  ventana(ids[2]); page.click('text=Abrir en la app'); page.wait_for_timeout(800)
  chk(('app:abrir-tarea:'+ids[2]) in page.evaluate('window.__log'), 'abrir en app %s'%page.evaluate('window.__log'))
  t=page.evaluate(LEER, ids[2]); chk(t['estado']=='pendiente', 'abrir no cambia')
  ventana(ids[2]); page.keyboard.press('Escape'); page.wait_for_timeout(800)
  chk('cerrar:false' in page.evaluate('window.__log'), 'cerrar sin cambios')
  print('errores', err[:5])
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
