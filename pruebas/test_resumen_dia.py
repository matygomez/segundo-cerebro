# Resumen del día: cartel del Inicio, pantalla Hoy y Configurar (tiempo simulado).
from playwright.sync_api import sync_playwright
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
S='capturas/'
U='http://localhost:8765/'
ok=0; fallas=[]
def chk(c, t):
  global ok
  if c: ok+=1
  else: fallas.append(t); print('FALLA', t)
CLIMA={'current':{'temperature_2m':19.4,'weather_code':2},'daily':{'temperature_2m_max':[24],'temperature_2m_min':[12],'precipitation_probability_max':[10]},'hourly':{'temperature_2m':[15]*24}}
afuera=[]
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel, permissions=['geolocation'], geolocation={'latitude':-34.6,'longitude':-58.4})
    page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.route('**/api.open-meteo.com/**', lambda r: r.fulfill(json=CLIMA))
    # Sin noticias: ningún pedido a Gemini ni a sitios de noticias.
    for patron in ('**/generativelanguage.googleapis.com/**', '**/newsdata.io/**', '**/api.allorigins.win/**', '**/api.rss2json.com/**'):
      page.route(patron, lambda r: (afuera.append(r.request.url), r.abort()))
    page.goto(U+'#/ajustes'); page.wait_for_timeout(800)
    page.evaluate("""async () => { const D = await import('/js/core/datos.js'); const p=(x)=>String(x).padStart(2,'0'); const d=new Date(); const f=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; const A=D.coleccion('tareas','areas'); const t=await A.crear({nombre:'Trabajo',orden:1}); for (const n of ['Informe','Mails']) await D.coleccion('tareas','tareas').crear({titulo:n, estado:'pendiente', fecha:f, areaId:t, proyectoId:'', etiquetas:[], subtareas:[], adjuntos:[], orden:1}); }""")
    page.goto(U+'#/home'); page.reload(); page.wait_for_timeout(3000)
    dia=page.locator('.rs-aviso.dia')
    chk(dia.count()==1, 'cartel del día')
    txt=dia.inner_text()
    chk('19°' in txt and 'matías' in txt.lower(), 'tiempo y saludo: '+txt.replace('\n',' | '))
    chk('📰' not in txt, 'sin noticias en el cartel')
    chk(dia.locator('.rs-chip:has-text("Trabajo")').count()==1, 'tareas por área')
    page.evaluate("document.querySelector('.rs-pistas').scrollLeft=99999"); page.wait_for_timeout(700)
    page.screenshot(path=S+f'rd_ini_{w}.png', clip={'x':0,'y':0,'width':w,'height':520})
    page.goto(U+'#/resumen/hoy'); page.wait_for_timeout(2000)
    chk(page.locator('.rs-clima').count()==1 and page.locator('text=Noticias').count()==0, 'Hoy sin noticias')
    page.goto(U+'#/resumen/config'); page.wait_for_timeout(1200)
    chk(page.locator('text=Intereses').count()==0 and page.locator('text=Clave de noticias').count()==0, 'Configurar sin noticias')
    page.screenshot(path=S+f'rd_cfg_{w}.png', full_page=True)
    page.locator('button:has-text("Relanzar el panel")').click(); page.wait_for_timeout(2500)
    chk('#/home' in page.url and page.locator('.rs-aviso.dia').count()==1, 'relanzar el panel')
    print(w, err[:3]); chk(not err, 'sin errores')
    cx.close()
  chk(not afuera, f'ningún pedido de noticias ({len(afuera)})')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
