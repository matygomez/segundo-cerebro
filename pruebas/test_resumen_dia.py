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
NOTI={'noticias':[{'tema':'Economía argentina','titulo':'El dólar cerró estable','resumen':'Calma en el mercado.','detalle':'Párrafo uno.\n\nPárrafo dos.','fuente':'Infobae'},
                  {'tema':'Tecnología','titulo':'Nuevo chip','resumen':'Gasta menos.','detalle':'Detalle.','fuente':'Otro'}],'sugeridos':['Energía']}
GEM={'candidates':[{'content':{'parts':[{'text':'```json\n'+json.dumps(NOTI)+'\n```'}]},'groundingMetadata':{'groundingChunks':[{'web':{'title':'infobae.com','uri':'https://ejemplo/infobae'}}]}}]}
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
      if 'gemini-2.5-flash:' in r.request.url: r.fulfill(status=429, body='{"error":{"message":"Quota exceeded"}}')
      else: r.fulfill(json=GEM)
    page.route('**/generativelanguage.googleapis.com/**', gem)
    page.goto(U); page.wait_for_timeout(800)
    page.evaluate("""async () => { const D = await import('/js/core/datos.js'); await D.coleccion('bitacora','ajustes').crear({ clave:'gemini', api:'CLAVE' }); }""")
    page.goto(U+'#/home'); page.wait_for_timeout(3500)
    dia=page.locator('.rs-aviso.dia')
    chk(dia.count()==1, 'cartel del día')
    chk('19°' in dia.inner_text(), 'tiempo en el cartel: '+dia.inner_text().replace('\n',' | '))
    chk('El dólar cerró estable' in dia.inner_text(), 'primera noticia en el cartel')
    chk(dia.locator('.rs-aviso-t').count()==0, 'sin el renglón de la fecha')
    chk('matías' in dia.inner_text().lower(), 'saludo con nombre')
    page.screenshot(path=S+f'rd_ini_{w}.png', clip={'x':0,'y':0,'width':w,'height':560})
    page.goto(U+'#/resumen/hoy'); page.wait_for_timeout(2500)
    chk(page.locator('.rs-noti').count()==2, 'noticias en Hoy')
    chk(page.locator('.rs-clima').count()==1, 'tiempo en Hoy')
    page.screenshot(path=S+f'rd_hoy_{w}.png', full_page=True)
    page.locator('.rs-noti').first.click(); page.wait_for_timeout(600)
    dlg=page.locator('dialog.rs-hoja[open]')
    chk(dlg.count()==1 and dlg.locator('p').count()==2, 'detalle de la noticia')
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
    print(w, err[:3]); chk(not err, 'sin errores')
    cx.close()
  print(pedidos)
  chk(len(pedidos)==4 and all('2.5-flash' in u for u in pedidos), f'si un modelo llegó al límite prueba el siguiente; uno por día ({len(pedidos)})')
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
