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
  const tra = await c('areas').crear({ nombre: 'Trabajo', orden: 2, archivada: false });
  const mud = await c('proyectos').crear({ nombre: 'Mudanza', areaId: per, orden: 1, archivado: false });
  const proc = await c('proyectos').crear({ nombre: 'Procedimientos', areaId: tra, orden: 1, archivado: false });
  const sec = await c('secciones').crear({ nombre: 'Pendientes de firma', proyectoId: proc, orden: 1 });
  const T = (titulo, d, areaId='', proyectoId='', seccionId='', estado='pendiente') => c('tareas').crear({ titulo, fecha: d===null?'':f(d), hora:'', estado, areaId, proyectoId, seccionId, etiquetas:[], subtareas:[], adjuntos:[], orden: Date.now()+Math.random() });
  await T('Pagar seguro', -2, per); await T('Llamar mecánico', -1, per, mud);
  await T('Revisar recepción', 0, tra, proc); await T('Comprar cajas', 0, per, mud); await T('Responder mails', 0, tra);
  await T('Idea suelta', null); await T('Armar clase', 1, per);
  await T('Informe semanal', 2, tra); await T('Contratar flete', 3, per, mud); await T('Lejos', 20, tra);
  await T('Revisar stock', null, tra, proc, sec); await T('Firmar contrato', null, per, mud, '', 'hecha');
  await T('Cortar pasto', null, per);
  for (let i=0;i<14;i++) await T('Relleno '+i, i%5+1, tra);
}"""
def tx(page, sel): return page.locator(sel).first.inner_text().replace('\xa0',' ')
def hojas(page): return [x.get_attribute('title') for x in page.locator('.tr-hojas .tr-pest').all()]
def swipe(page, sel, dx):
    page.evaluate("""([sel,dx])=>{const el=document.querySelector(sel);const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
      const ev=(t,cx)=>el.dispatchEvent(new PointerEvent(t,{pointerType:'touch',clientX:cx,clientY:y,bubbles:true,pointerId:7}));
      ev('pointerdown',x);for(let i=1;i<=8;i++)ev('pointermove',x+dx*i/8);ev('pointerup',x+dx);}""", [sel,dx])
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390, 1366):
    cel = w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(600); page.evaluate(SEED)
    page.goto(U+'#/tareas'); page.wait_for_timeout(900)
    chk(hojas(page)[:5]==['Inicio','Hoy','Bandeja','Personal','Trabajo'], f'hojas {hojas(page)}')
    cu=page.locator('.tr-cuadrito').all_inner_texts(); print(cu)
    chk(cu[0].startswith('2') and cu[1].startswith('3'), 'cuadritos vencidas/hoy')
    chk(page.locator('.tr-tarjeta').first.locator('.tr-tarea').count()==3, 'Inicio Hoy solo de hoy')
    chk('Personal' in tx(page,'.tr-arbol') and 'Mudanza' in tx(page,'.tr-arbol'), 'árbol')
    chk(page.locator('.tr-pest[title=Hoy] .tr-marca.alerta').inner_text()=='5', 'marca Hoy roja con 5')
    page.screenshot(path=S+f'tr_inicio_{w}.png', full_page=True)
    # cuadrito Esta semana -> hoy/proximos y baja
    page.click('.tr-cuadrito:has-text("Esta semana")'); page.wait_for_timeout(1200)
    chk(page.evaluate('location.hash')=='#/tareas/hoy/proximos', 'va a hoy/proximos')
    top=page.evaluate("document.getElementById('tr-ancla-proximos').getBoundingClientRect().top"); print('top proximos', top, page.evaluate('scrollY'))
    chk(page.evaluate('scrollY')>0 and top<200, 'bajó a próximos')
    chk(page.locator('.tr-pest.activa').get_attribute('title')=='Hoy', 'hoja Hoy activa')
    chk(page.locator('#tr-ancla-vencidas .tr-tarea').count()==2 and page.locator('#tr-ancla-hoy > .tr-lista .tr-tarea').count()==3, 'vencidas y hoy')
    chk('Más adelante (1)' in tx(page,'.tr-proximos'), 'más adelante')
    page.screenshot(path=S+f'tr_hoy_{w}.png', full_page=True)
    # area Trabajo: proyecto con sección
    page.click('.tr-pest[title=Trabajo]'); page.wait_for_timeout(700)
    chk('Procedimientos' in tx(page,'.tr-cuerpo-vista') and 'PENDIENTES DE FIRMA' in tx(page,'.tr-cuerpo-vista').upper(), 'área con proyecto y sección')
    # Personal: ver completadas
    page.click('.tr-pest[title=Personal]'); page.wait_for_timeout(700)
    n0=page.locator('.tr-tarea').count(); page.click('.tr-chip:has-text("Ver completadas")'); page.wait_for_timeout(300)
    chk(page.locator('.tr-tarea').count()==n0+1, 'ver completadas')
    # config: compacto + proyecto como hoja + solo ícono + límite
    page.click('[aria-label="Configurar Tareas"]'); page.wait_for_timeout(300)
    page.locator('.tr-config .tr-seg button:has-text("Compacto")').click(); page.wait_for_timeout(500)
    page.locator('.tr-cfg-hoja:has-text("Mudanza") .tr-switch').click(); page.wait_for_timeout(500)
    page.locator('.tr-cfg-hoja:has-text("Trabajo") .tr-seg button[title="Solo ícono"]').click(); page.wait_for_timeout(500)
    page.screenshot(path=S+f'tr_cfg_{w}.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(400)
    chk(page.locator('.tr-cuerpo-vista.tr-compacto').count()==1, 'compacto')
    chk('Mudanza' in hojas(page), 'proyecto como hoja')
    chk(page.locator('.tr-pest[title=Trabajo].solo-icono').count()==1, 'solo ícono')
    page.screenshot(path=S+f'tr_compacto_{w}.png', full_page=True)
    page.reload(); page.wait_for_timeout(900)
    chk(page.locator('.tr-cuerpo-vista.tr-compacto').count()==1 and 'Mudanza' in hojas(page), 'config persiste')
    # límite
    page.click('[aria-label="Configurar Tareas"]'); page.wait_for_timeout(300)
    page.select_option('.tr-config select', '3'); page.wait_for_timeout(500); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    chk(page.locator('.tr-hojas .tr-pest').count()==4 and 'Más' in tx(page,'.tr-hojas'), 'límite y Más')
    page.click('[aria-label="Configurar Tareas"]'); page.wait_for_timeout(300); page.select_option('.tr-config select', '0'); page.wait_for_timeout(400); page.keyboard.press('Escape'); page.wait_for_timeout(300)
    # eliminar Personal reubicando en Trabajo
    page.goto(U+'#/tareas/area/'+page.evaluate("(async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','areas').listar()).find(a=>a.nombre==='Personal').id})()")); page.wait_for_timeout(800)
    page.click('.tr-titulo-vista [aria-label="Opciones de Personal"]'); page.wait_for_timeout(200)
    page.click('.tr-menu-item:has-text("Eliminar")'); page.wait_for_timeout(300)
    t=tx(page,'dialog[open]'); print(t.replace('\n',' | ')[:200])
    chk('1 proyecto' in t and 'completada' in t, 'diálogo muestra contenido')
    page.select_option('dialog[open] select', label='Trabajo'); page.click('dialog[open] .boton.peligro'); page.wait_for_timeout(1200)
    chk(page.evaluate('location.hash')=='#/tareas', 'vuelve a inicio')
    chk('Personal' not in hojas(page), 'Personal fuera de hojas')
    arbol=tx(page,'.tr-arbol'); chk('Mudanza' in arbol, 'Mudanza pasó a Trabajo')
    page.goto(U+'#/tareas/bandeja'); page.wait_for_timeout(500)
    # deshacer desde papelera
    page.click('[aria-label="Configurar Tareas"]'); page.wait_for_timeout(300); page.click('.tr-cfg-item:has-text("Papelera")'); page.wait_for_timeout(300)
    chk('Personal' in tx(page,'dialog[open]'), 'papelera lista Personal')
    page.click('dialog[open] .tr-chip:has-text("Recuperar")'); page.wait_for_timeout(900)
    chk('Personal' in hojas(page), 'recuperado')
    # eliminar todo proyecto Procedimientos
    pid=page.evaluate("(async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','proyectos').listar()).find(a=>a.nombre==='Procedimientos').id})()")
    page.goto(U+'#/tareas/proyecto/'+pid); page.wait_for_timeout(700)
    page.click('.tr-titulo-vista button[aria-label^="Opciones"]'); page.click('.tr-menu-item:has-text("Eliminar")'); page.wait_for_timeout(300)
    page.click('dialog[open] .tr-opcion[data-valor=todo]'); page.click('dialog[open] .boton.peligro'); page.wait_for_timeout(1000)
    chk(page.locator('text=Revisar recepción').count()==0 or 'Revisar recepción' not in page.locator('.tr-cuerpo-vista').inner_text(), 'tareas del proyecto eliminadas')
    # Deshacer con el aviso
    page.locator('.aviso-accion:has-text("Deshacer")').last.click(); page.wait_for_timeout(1000)
    page.goto(U+'#/tareas/hoy'); page.wait_for_timeout(700)
    chk('Revisar recepción' in page.locator('.tr-cuerpo-vista').inner_text(), 'deshacer devuelve tareas')
    # deslizar (celular): completar y mañana
    if cel:
      n=page.locator('#tr-ancla-hoy .tr-tarea').count()
      swipe(page, '#tr-ancla-hoy .tr-tarea .tr-fila', 160); page.wait_for_timeout(900)
      chk(page.locator('#tr-ancla-hoy > .tr-lista .tr-tarea').count()==n-1, 'deslizar derecha completa')
      swipe(page, '#tr-ancla-vencidas .tr-tarea .tr-fila', -160); page.wait_for_timeout(900)
      chk(page.locator('#tr-ancla-vencidas .tr-tarea').count()==1, 'deslizar izquierda pasa a mañana')
      chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll horizontal')
    # archivar sección y restaurar
    page.goto(U+'#/tareas/proyecto/'+pid); page.wait_for_timeout(700)
    page.click('.tr-seccion-cab button[aria-label^="Opciones"]'); page.click('.tr-menu-item:has-text("Archivar")'); page.wait_for_timeout(700)
    chk(page.locator('.tr-seccion').count()==0, 'sección archivada')
    page.click('[aria-label="Configurar Tareas"]'); page.click('.tr-cfg-item:has-text("Archivados")'); page.wait_for_timeout(300)
    page.click('dialog[open] .tr-chip:has-text("Restaurar")'); page.wait_for_timeout(800)
    chk(page.locator('.tr-seccion').count()==1, 'sección restaurada')
    # cambiar ícono
    page.click('.tr-titulo-vista button[aria-label^="Opciones"]'); page.click('.tr-menu-item:has-text("Cambiar ícono")'); page.wait_for_timeout(200)
    page.click('dialog[open] .tr-iconos button[aria-label=libro]'); page.wait_for_timeout(600)
    chk(page.evaluate("(async()=>{const D=await import('/js/core/datos.js');return (await D.coleccion('tareas','proyectos').listar()).find(a=>a.nombre==='Procedimientos').icono})()")=='libro', 'ícono guardado')
    # editor abre
    page.locator('.tr-cuerpo').first.click(); page.wait_for_timeout(300); chk(page.locator('dialog[open]').count()==1 if cel else page.locator('.tr-panel:not([hidden]) .tr-editor').count()==1, 'editor abre'); page.keyboard.press('Escape')
    # inicio de la app (bloque)
    page.goto(U+'#/'); page.wait_for_timeout(700); chk(page.locator('.tr-tarea').count()>0, 'bloque inicio')
    chk(not err, f'errores {w} {err}')
    cx.close()
  # PC y celular separados
print(ok,'ok',len(fallas),'fallas')
