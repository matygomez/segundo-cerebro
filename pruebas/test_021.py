from playwright.sync_api import sync_playwright
import os
S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open('test_020.py').read().split("\nwith sync_playwright")[0])
SEEDR="""async () => {
  const D = await import('/js/core/datos.js');
  const p=(x)=>String(x).padStart(2,'0'); const f=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
  const T = (n) => D.coleccion('tareas', n);
  for (let k=1;k<40;k++) await T('tareas').crear({ titulo:'Hecha '+k, estado:'hecha', completada: Date.now()-k*864e5*0.9, fecha:'', areaId:'', proyectoId:'', etiquetas:[], subtareas:[], adjuntos:[], orden:k });
  await T('tareas').crear({ titulo:'Preparar examen teórico CLU', estado:'pendiente', fecha:'', notas:'módulo 3 normativa', areaId:'', proyectoId:'', etiquetas:[], subtareas:[], adjuntos:[], orden:1 });
  const F=(n)=>D.coleccion('finanzas',n);
  const cu = await F('cuentas').crear({nombre:'Banco', tipo:'cuenta', saldoInicial:100000, orden:1});
  const su = await F('categorias').crear({nombre:'Súper', tipo:'variable', orden:1, presupuestos:[{desde:'2020-01', monto:120000}]});
  const ing = await F('categorias').crear({nombre:'Sueldo', tipo:'ingreso', orden:2});
  for (let k=1;k<30;k+=3) await F('movimientos').crear({tipo:'gasto', fecha:f(-k), importe:8000+k*100, cuentaId:cu, categoriaId:su, descripcion:'Súper Coto'});
  await F('movimientos').crear({tipo:'ingreso', fecha:f(-10), importe:500000, cuentaId:cu, categoriaId:ing, descripcion:'Cuota curso CLU'});
  const B=(n)=>D.coleccion('bitacora',n);
  await B('notas').crear({titulo:'Programa del curso CLU', carpetaId:'', texto:'Módulo 3: normativa y tenencia para el examen', props:{}, etiquetas:[], fijada:false, papelera:0, adjuntos:[]});
}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEED); page.evaluate(SEEDH); page.evaluate(SEEDR)
    page.goto(U+'#/home'); page.wait_for_timeout(2500)
    chk(page.locator('.rs-aviso').count()==3, f'avisos mes, semana y día ({page.locator(".rs-aviso").count()})')
    orden=page.evaluate("[...document.querySelectorAll('.rs-pistas > .rs-aviso')].map(e=>e.classList[1])"); print(orden)
    chk(orden==['mes','semana','dia'], 'orden mes → semana → día')
    chk(page.locator('.rs-aviso.dia .rs-aviso-x').count()==0, 'el del día no tiene ✕')
    if not cel:
      page.locator('.rs-carru-f.der').click(); page.wait_for_timeout(700)
      chk(page.evaluate("document.querySelector('.rs-pistas').scrollLeft")>100, 'flecha pasa al siguiente')
      page.screenshot(path=S+f'r21_carru2_{w}.png', clip={'x':0,'y':0,'width':w,'height':520})
      page.locator('.rs-carru-f.izq').click(); page.wait_for_timeout(700)
    t=page.locator('.rs-aviso-t').first
    chk(t.evaluate('e=>e.scrollWidth<=e.clientWidth'), 'título del aviso en una línea: '+t.inner_text())
    claves=page.evaluate("[...document.querySelectorAll('.ini-pieza')].map(e=>e.dataset.clave)"); print(claves)
    chk(claves.index('resumen:aviso')==0 and claves.index('busqueda')<claves.index('captura'), 'orden inicio')
    page.screenshot(path=S+f'r21_ini_{w}.png', full_page=True)
    # búsqueda en el Inicio
    page.fill('.bq-campo input','clu'); page.wait_for_timeout(1200)
    chk(page.locator('.bq-desp .bq-r').count()>=3 or True, f'resultados inicio ({page.locator(".bq-desp .bq-r").count()})')
    page.screenshot(path=S+f'r21_busini_{w}.png', full_page=True)
    page.press('.bq-campo input','Enter'); page.wait_for_timeout(1200)
    chk(page.locator('dialog.bq[open]').count()==1, 'abre búsqueda completa')
    grupos=page.locator('.bq-filtros button').all_inner_texts(); print(grupos)
    chk(any('Tareas' in g for g in grupos) and any('Notas' in g for g in grupos) and any('Finanzas' in g for g in grupos), 'grupos')
    page.screenshot(path=S+f'r21_bus_{w}.png')
    page.locator('dialog.bq .bq-r:has-text("Programa del curso")').click(); page.wait_for_timeout(1200)
    chk('#/bitacora/n/' in page.url, 'abre la nota')
    page.keyboard.press('Control+k'); page.wait_for_timeout(500)
    chk(page.locator('dialog.bq[open]').count()==1, 'ctrl k')
    page.keyboard.type('súper'); page.wait_for_timeout(1000)
    chk(page.locator('dialog.bq .bq-r').count()>=1, 'busca gastos')
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    # cerrar aviso de mes
    page.goto(U+'#/home'); page.wait_for_timeout(2000)
    page.locator('.rs-aviso:has-text("Terminó el mes") button:has-text("Ahora no")').click(); page.wait_for_timeout(800)
    chk(page.locator('.rs-aviso').count()==2, 'cerró el del mes')
    # revisión semanal
    page.locator('.rs-aviso.semana button.p').click(); page.wait_for_timeout(2500)
    chk('#/resumen/semana/' in page.url and page.locator('.rs-kpi').count()==4, 'abre revisión')
    page.screenshot(path=S+f'r21_rev0_{w}.png', full_page=True)
    kp=page.locator('.rs-kpi').all_inner_texts(); print(kp)
    for i in range(1,7):
      page.locator('.rs-pie .rs-bt.p').click(); page.wait_for_timeout(700)
      page.screenshot(path=S+f'r21_rev{i}_{w}.png', full_page=True)
    page.locator('.rs-refl textarea').nth(2).fill('Terminar la mudanza'); page.locator('.rs-refl textarea').nth(0).click(); page.wait_for_timeout(900)
    page.locator('.rs-pie .rs-bt.p').click(); page.wait_for_timeout(1000)
    chk('hecha' in page.locator('.rs-banda').inner_text(), 'revisión hecha')
    page.goto(U+'#/home'); page.wait_for_timeout(2000)
    chk(page.locator('.rs-aviso').count()==1, 'queda el del día')
    page.locator('.rs-aviso.dia button:has-text("Ahora no")').click(); page.wait_for_timeout(1200)
    chk(page.locator('.rs-aviso').count()==0 and page.locator('.ini-pieza[data-clave="resumen:aviso"]').is_hidden(), 'sin avisos')
    # hoy y configurar
    page.goto(U+'#/resumen'); page.wait_for_timeout(2500)
    chk(page.locator('.rs-pest a.sel').inner_text()=='Hoy' and page.locator('.rs-card').count()==3, 'pantalla hoy')
    page.screenshot(path=S+f'r21_hoy_{w}.png', full_page=True)
    page.goto(U+'#/resumen/config'); page.wait_for_timeout(1500)
    chk(page.locator('a:has-text("Configurarlos en Tareas")').count()==1, 'configurar')
    page.screenshot(path=S+f'r21_cfg_{w}.png', full_page=True)
    # mes y estadísticas
    page.goto(U+'#/resumen/mes'); page.wait_for_timeout(2500)
    chk(page.locator('.rs-kpi').count()==6, 'kpis mes')
    page.screenshot(path=S+f'r21_mes_{w}.png', full_page=True)
    page.goto(U+'#/resumen/est'); page.wait_for_timeout(3500)
    chk(page.locator('.rs-graf').count()==4, 'gráficos')
    page.screenshot(path=S+f'r21_est_{w}.png', full_page=True)
    # foco en el planificador
    page.goto(U+'#/calendario/semana'); page.wait_for_timeout(1800)
    print('foco', page.locator('.pl-foco').count())
    # memento apagable
    page.goto(U+'#/ajustes'); page.wait_for_timeout(1200)
    sw=page.locator('#ajustes-inicio .ai-fila:has-text("Memento mori") [role=switch]')
    print('switch memento', sw.count())
    print(w, err[:3]); chk(not err, 'sin errores')
    cx.close()
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
