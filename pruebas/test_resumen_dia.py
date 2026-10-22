# Resumen del día: tiempo (Open-Meteo) y noticias (Gemini) simulados.
from playwright.sync_api import sync_playwright
import os, json
os.chdir(os.path.dirname(os.path.abspath(__file__)))
S='capturas/'
U='http://localhost:8765/'
ok=0; fallas=[]
def chk(c, t):
  global ok
  if c: ok+=1
  else: fallas.append(t); print('FALLA', t)
CLIMA={'current':{'temperature_2m':19.4,'weather_code':2},'daily':{'temperature_2m_max':[24],'temperature_2m_min':[12],'precipitation_probability_max':[10]},'hourly':{'temperature_2m':[15]*24}}
NOTI={'noticias':[{'n':1,'resumen':'Calma en el mercado.','detalle':'Párrafo uno.\n\nPárrafo dos.'},{'n':2,'resumen':'Gasta menos.','detalle':'Detalle.'}],'sugeridos':['Energía']}
GEM={'candidates':[{'content':{'parts':[{'text':'```json\n'+json.dumps(NOTI)+'\n```'}]}}]}
TODOS=[('El dólar cerró estable tras el anuncio del BCRA - Infobae','https://ejemplo/infobae'),('Sube la nafta en Argentina - Clarín','https://ejemplo/2'),('Inflación de septiembre en Argentina - La Nación','https://ejemplo/3'),
  ('Nuevo chip de inteligencia artificial - Xataka','https://ejemplo/chip'),('Ataque con misiles en Ucrania - BBC','https://ejemplo/6'),('El Senado debate el presupuesto de Milei - Perfil','https://ejemplo/7'),
  ('Wall Street cierra en alza y el mercado mundial respira - Reuters','https://ejemplo/8'),('Otra del dólar blue en Argentina - Ámbito','https://ejemplo/9')]
def XML():
  it=''.join(f'<item><title>{t}</title><link>{l}</link><pubDate></pubDate><description></description></item>' for t,l in TODOS)
  return f'<?xml version="1.0"?><rss><channel>{it}</channel></rss>'
pedidos=[]
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel, permissions=['geolocation'], geolocation={'latitude':-34.6,'longitude':-58.4})
    page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.route('**/api.open-meteo.com/**', lambda r: r.fulfill(json=CLIMA))
    def gem(r):
      pedidos.append(r.request.url)
      if 'gemini-flash-latest:' in r.request.url: r.fulfill(status=429, body='{"error":{"message":"Quota exceeded"}}')
      else: r.fulfill(json=GEM)
    page.route('**/generativelanguage.googleapis.com/**', gem)
    rss=[]; nd=[]
    ND={'status':'success','results':[{'title':'Milei anunció cambios en el gabinete','link':'https://nd/1','source_name':'Perfil','description':'x','pubDate':''},{'title':'Récord de exportaciones de chips con inteligencia artificial','link':'https://nd/2','source_name':'Reuters','description':'','pubDate':''}]}
    page.route('**/newsdata.io/**', lambda r: (nd.append(r.request.url), r.fulfill(json=ND)))
    page.route('**/api.allorigins.win/**', lambda r: (rss.append(1), r.fulfill(body=XML(), content_type='application/rss+xml')))
    page.goto(U+'#/ajustes'); page.wait_for_timeout(800)
    page.evaluate("""async () => { const D = await import('/js/core/datos.js'); await D.coleccion('bitacora','ajustes').crear({ clave:'gemini', api:'CLAVE' }); }""")
    page.goto(U+'#/home'); page.reload(); page.wait_for_timeout(3500)
    dia=page.locator('.rs-aviso.dia')
    chk(dia.count()==1, 'cartel del día')
    chk('19°' in dia.inner_text(), 'tiempo en el cartel: '+dia.inner_text().replace('\n',' | '))
    chk('Wall Street' in dia.inner_text(), 'primera noticia en el cartel')
    chk(dia.locator('.rs-aviso-t').count()==0, 'sin el renglón de la fecha')
    chk('matías' in dia.inner_text().lower(), 'saludo con nombre')
    page.screenshot(path=S+f'rd_ini_{w}.png', clip={'x':0,'y':0,'width':w,'height':560})
    page.goto(U+'#/resumen/hoy'); page.wait_for_timeout(2500)
    print(page.locator('.rs-noti b').all_inner_texts(), page.locator('.rs-noti .rs-aviso-et').all_inner_texts())
    temas=set(page.locator('.rs-noti .rs-aviso-et').all_inner_texts())
    chk(len(temas)>=4 and len(rss)==1, f'varios temas con un solo pedido ({len(temas)} temas, {len(rss)} pedidos)')
    chk(page.locator('.rs-noti').count()==6, f'6 noticias en Hoy ({page.locator(".rs-noti").count()})')
    chk(page.locator('.rs-clima').count()==1, 'tiempo en Hoy')
    page.screenshot(path=S+f'rd_hoy_{w}.png', full_page=True)
    page.locator('.rs-noti:has-text("El dólar")').click(); page.wait_for_timeout(600)
    dlg=page.locator('dialog.rs-hoja[open]')
    chk(dlg.count()==1 and dlg.locator('p').count()>=1, 'detalle de la noticia')
    chk(dlg.locator('a').get_attribute('href')=='https://ejemplo/infobae', 'enlace a la fuente real')
    page.screenshot(path=S+f'rd_noti_{w}.png')
    dlg.locator('button:has-text("No me interesa")').click(); page.wait_for_timeout(800)
    page.goto(U+'#/resumen/config'); page.wait_for_timeout(1500)
    chk(page.locator('.rs-chip.sug:has-text("Energía")').count()==1, 'tema sugerido')
    peso=page.evaluate("""async () => { const D = await import('/js/core/datos.js'); const l = await D.coleccion('resumen','ajustes').listar(); return l[0].intereses.find(i=>i.nombre==='Economía argentina').peso; }""")
    chk(peso==-2, f'aprende: +1 al abrir, -3 al no interesar ({peso})')
    page.goto(U+'#/home'); page.wait_for_timeout(2000)
    chk(page.locator('.rs-aviso.dia').count()==0, 'abrir Hoy saca el cartel del día')
    page.goto(U+'#/resumen/config'); page.wait_for_timeout(1200)
    page.locator('button:has-text("Relanzar el panel")').click(); page.wait_for_timeout(2500)
    chk('#/home' in page.url and page.locator('.rs-aviso.dia').count()==1, 'relanzar el panel')
    page.goto(U+'#/resumen/config'); page.wait_for_timeout(1200)
    page.locator('input[type=password]').fill('MICLAVE'); page.locator('input[type=password]').press('Tab'); page.wait_for_timeout(1500)
    page.goto(U+'#/resumen/hoy'); page.wait_for_timeout(3000)
    t=page.locator('.rs-noti b').all_inner_texts(); print('ND', t, len(nd))
    chk(len(nd)==2 and 'apikey=MICLAVE' in nd[0] and any('Milei' in x for x in t), 'noticias con la clave de NewsData')
    print(w, err[:3]); chk(not err, 'sin errores')
    cx.close()
  print(pedidos)
  chk(len(pedidos)>=2, f'Gemini explica los titulares ({len(pedidos)})')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
