from playwright.sync_api import sync_playwright
import os
S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open('test_tareas.py').read().split("\nwith sync_playwright")[0])
SEEDH="""async () => {
  const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('habitos', n);
  const p=(x)=>String(x).padStart(2,'0'); const f=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
  const leer = await c('habitos').crear({ nombre:'Leer 20 minutos', tipo:'si', frecuencia:{tipo:'diario'}, momento:'manana', desde:f(-60), orden:0, archivado:false, enEstadisticas:true });
  const agua = await c('habitos').crear({ nombre:'Tomar agua', tipo:'cant', objetivo:8, unidad:'vasos', frecuencia:{tipo:'diario'}, momento:'tarde', desde:f(-60), orden:1, archivado:false, enEstadisticas:true });
  const gym = await c('habitos').crear({ nombre:'Entrenar', tipo:'si', frecuencia:{tipo:'diario'}, momento:'noche', desde:f(-60), orden:2, archivado:false, enEstadisticas:true });
  for (let k=2;k<40;k++){ await c('registros').crear({habitoId:leer, fecha:f(-k), estado:'s'}); await c('registros').crear({habitoId:gym, fecha:f(-k), estado: k%6? 's':'x'}); await c('registros').crear({habitoId:agua, fecha:f(-k), estado:'s', valor:8}); }
  // ayer: leer y gym sin marcar (pendientes), agua hecho
  await c('registros').crear({habitoId:agua, fecha:f(-1), estado:'s', valor:8});
  await c('metas').crear({ nombre:'Leer 24 libros', desde:f(-30), fechaLimite:`${new Date().getFullYear()}-12-31`, objetivo:24, unidad:'libros', fuente:{tipo:'manual'}, valorManual:5, hitos:[], habitos:[leer], archivada:false });
  await c('metas').crear({ nombre:'Entrenar 100 veces', desde:f(-30), fechaLimite:f(200), objetivo:100, unidad:'', fuente:{tipo:'habito', habitoId:gym, modo:'veces', periodo:'meta', etiqueta:'Hábito Entrenar · cada ✓'}, hitos:[], habitos:[], archivada:false });
}"""
def swipeL(loc, dx):
    loc.evaluate("""(el,dx)=>{const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
      const ev=(t,cx)=>el.dispatchEvent(new PointerEvent(t,{pointerType:'touch',clientX:cx,clientY:y,bubbles:true,pointerId:7}));
      ev('pointerdown',x);for(let i=1;i<=8;i++)ev('pointermove',x+dx*i/8);ev('pointerup',x+dx);}""", dx)
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEED); page.evaluate(SEEDH)
    page.goto(U+'#/habitos'); page.wait_for_timeout(1500)
    page.screenshot(path=S+f'hb_hoy_{w}.png', full_page=True)
    chk(page.locator('.hb-pend .hb-desl').count()==2, f'2 pendientes ({page.locator(".hb-pend .hb-desl").count()})')
    chk('2 de 3' not in tx(page,'.hb-resumen') and '0 de 3' in tx(page,'.hb-resumen'), 'resumen 0 de 3: '+tx(page,'.hb-resumen'))
    chk(page.locator('.hb-pend .hb-mini7 i.pd').count()==2, 'cuadradito punteado')
    # marcar pendiente de Leer (ayer) como hecho
    page.locator('.hb-pend .hb-desl:has-text("Leer") .hb-check').click(); page.wait_for_timeout(700)
    chk(page.locator('.hb-pend .hb-desl').count()==1, 'queda 1 pendiente')
    # deslizar izquierda en Entrenar pendiente → confirmar No
    swipe(page,'.hb-pend .hb-desl .hb-fila',-120); page.wait_for_timeout(400)
    chk(page.locator('dialog[open]').count()==1 and 'no completado' in page.locator('dialog[open]').inner_text(), 'confirma no')
    page.locator('dialog[open] button:has-text("Sí")').click(); page.wait_for_timeout(700)
    chk(page.locator('.hb-pend').count()==0, 'sin pendientes')
    # hoy: marcar Leer
    page.locator('.hb-desl:has-text("Leer") .hb-check').first.click(); page.wait_for_timeout(700)
    chk('1 de 3' in tx(page,'.hb-resumen'), 'resumen 1 de 3')
    chk(page.locator('.hb-listos').count()==1 and '1 completado' in tx(page,'.hb-listos'), 'agrupado')
    # agua +
    for _ in range(3): page.locator('.hb-cant button[aria-label="Más"]').click(); page.wait_for_timeout(250)
    chk('3/8' in tx(page,'.hb-cant'), 'agua 3/8')
    # descanso deslizando derecha en Entrenar
    swipeL(page.locator('.hb-desl:has-text("Entrenar") .hb-fila').first,120); page.wait_for_timeout(400)
    chk('Te quedan 2' in page.locator('dialog[open]').inner_text(), 'confirma descanso con restantes')
    page.locator('dialog[open] button:has-text("Sí")').click(); page.wait_for_timeout(700)
    chk('1 descanso' in tx(page,'.hb-listos'), 'descanso agrupado: '+tx(page,'.hb-listos'))
    chk(page.locator('.hb-meta').count()==2, 'metas en Hoy')
    page.screenshot(path=S+f'hb_hoy2_{w}.png', full_page=True)
    # Metas
    page.goto(U+'#/habitos/metas'); page.wait_for_timeout(1200)
    chk('5 de 24' in tx(page,'.hb-card'), 'meta manual')
    page.locator('.hb-mas1 button:has-text("+1")').click(); page.wait_for_timeout(700)
    chk('6 de 24' in tx(page,'.hb-card'), '+1')
    page.locator('.hb-link:has-text("Nueva meta")').click(); page.wait_for_timeout(800)
    chk(page.locator('.hb-op:has-text("Tareas")').count()==1 and page.locator('.hb-op:has-text("Bitácora")').count()==1 and page.locator('.hb-op:has-text("Finanzas")').count()==1, 'fuentes de otros módulos')
    page.locator('.hb-op:has-text("Tareas")').click(); page.wait_for_timeout(300)
    page.fill('dialog[open] input[type=text]','Terminar mudanza')
    page.locator('dialog[open] select').first.select_option(label='Personal › Mudanza'); page.wait_for_timeout(500)
    chk('Hoy da:' in page.locator('.hb-prueba').inner_text(), 'prueba: '+page.locator('.hb-prueba').inner_text())
    page.screenshot(path=S+f'hb_formmeta_{w}.png')
    page.locator('dialog[open] button[type=submit]').click(); page.wait_for_timeout(900)
    chk(page.locator('.hb-meta').count()==3, 'meta de tareas creada')
    chk('de 4 tareas' in tx(page,'.hb-card') or 'de 5 tareas' in tx(page,'.hb-card'), 'tareas cuenta')
    page.screenshot(path=S+f'hb_metas_{w}.png', full_page=True)
    # Bitácora fuente
    page.locator('.hb-link:has-text("Nueva meta")').click(); page.wait_for_timeout(800)
    page.locator('.hb-op:has-text("Bitácora")').click(); page.wait_for_timeout(300)
    opts=page.locator('dialog[open] .hb-regla select').first.locator('option').all_inner_texts()
    chk(len(opts)>=1, f'carpetas {opts}')
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    # Estadísticas
    page.goto(U+'#/habitos/est'); page.wait_for_timeout(1000)
    chk(page.locator('.hb-slide').count()==3 and page.locator('.hb-heat i.n3').count()>20, 'carrusel y mapa')
    page.locator('.hb-flecha[aria-label=Siguiente]').click(); page.wait_for_timeout(400)
    chk('2 de 3' in page.locator('.hb-card > small.nota').inner_text(), 'flecha siguiente')
    page.screenshot(path=S+f'hb_est_{w}.png', full_page=True)
    # Detalle y corregir
    page.goto(U+'#/habitos/lista'); page.wait_for_timeout(900)
    page.locator('.hb-lnom:has-text("Entrenar")').click(); page.wait_for_timeout(900)
    chk(page.locator('.hb-dia-c').count()>=28, 'mes del detalle')
    page.locator('.hb-dia-c.hoy').click(); page.wait_for_timeout(300)
    page.locator('.hb-corregir button.si').click(); page.wait_for_timeout(800)
    chk('hb-dia-c e-s hoy' in page.locator('.hb-dia-c.hoy').get_attribute('class'), 'corregido a hecho')
    page.screenshot(path=S+f'hb_det_{w}.png', full_page=True)
    # Nuevo hábito
    page.goto(U+'#/habitos/lista/nuevo'); page.wait_for_timeout(900)
    chk(page.locator('dialog[open]').count()==1, 'form nuevo')
    page.fill('dialog[open] input[type=text]','Meditar'); page.locator('dialog[open] button[type=submit]').click(); page.wait_for_timeout(800)
    chk(page.locator('.hb-lfila:has-text("Meditar")').count()==1, 'creado')
    # Config
    page.goto(U+'#/habitos/config'); page.wait_for_timeout(900)
    page.locator('.hb-seg button:has-text("Apagados")').click(); page.wait_for_timeout(700)
    page.goto(U+'#/habitos'); page.wait_for_timeout(900)
    chk(page.locator('.hb-fondo.de').count()==0, 'descansos apagados')
    # Inicio
    page.goto(U+'#/'); page.wait_for_timeout(1500)
    page.screenshot(path=S+f'hb_ini_{w}.png', full_page=True)
    print(w, 'inicio hb:', page.locator('.hb-ini').count())
    # planificador
    page.goto(U+'#/calendario/semana'); page.wait_for_timeout(1500)
    chk(page.locator('.pl-sinfecha .pl-tar').count()>=2, 'planificador sin fecha')
    print(w, err[:3]); chk(not err, 'sin errores')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
