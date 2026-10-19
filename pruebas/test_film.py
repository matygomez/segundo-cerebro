from playwright.sync_api import sync_playwright
import json, datetime, urllib.parse
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
hoy=datetime.date.today(); fut=(hoy+datetime.timedelta(days=10)).isoformat(); fut2=(hoy+datetime.timedelta(days=40)).isoformat()
PNG=open('/home/claude/segundo-cerebro/icons/icono-192.png','rb').read()
TV={'id':101,'name':'El Eternauta','original_name':'El Eternauta','first_air_date':'2025-04-30','poster_path':'/ete.jpg','backdrop_path':'/ete_b.jpg','genres':[{'name':'Ciencia ficción'},{'name':'Drama'}],'episode_run_time':[50],'overview':'Una nevada mortal…','status':'Returning Series',
  'seasons':[{'season_number':0,'episode_count':2,'name':'Especiales'},{'season_number':1,'episode_count':6,'name':'Temporada 1','air_date':'2025-04-30'},{'season_number':2,'episode_count':6,'name':'Temporada 2','air_date':fut}],
  'last_episode_to_air':{'season_number':1,'episode_number':6,'runtime':50},'next_episode_to_air':{'season_number':2,'episode_number':1,'name':'Episodio 1','air_date':fut},
  'watch/providers':{'results':{'AR':{'flatrate':[{'provider_name':'Netflix'}]}}}}
MOV={'id':202,'title':'Relatos salvajes','original_title':'Relatos salvajes','release_date':'2014-08-21','poster_path':'/rel.jpg','backdrop_path':'','genres':[{'name':'Comedia'},{'name':'Drama'}],'runtime':122,'overview':'Seis relatos…','status':'Released',
  'watch/providers':{'results':{'AR':{'flatrate':[{'provider_name':'Netflix'}],'rent':[{'provider_name':'Apple TV'}]}}},'release_dates':{'results':[]}}
FUT={'id':303,'title':'Película futura','original_title':'Future Movie','release_date':fut2,'poster_path':'','genres':[],'runtime':0,'overview':'','status':'Post Production','watch/providers':{'results':{}},'release_dates':{'results':[{'iso_3166_1':'AR','release_dates':[{'release_date':fut2+'T00:00:00.000Z'}]}]}}
pedidos=[]
def tmdb(route, req):
    u=urllib.parse.urlparse(req.url); q=urllib.parse.parse_qs(u.query); pedidos.append(u.path)
    if q.get('api_key',[''])[0]!='CLAVE': return route.fulfill(status=401, body='{}')
    p=u.path.replace('/3','',1)
    body=None
    if p=='/search/multi':
        body={'results':[{**{k:TV[k] for k in ['id','name','original_name','first_air_date','poster_path','overview']},'media_type':'tv'},{**{k:MOV[k] for k in ['id','title','original_title','release_date','poster_path','overview']},'media_type':'movie'},{**{k:FUT[k] for k in ['id','title','original_title','release_date','poster_path','overview']},'media_type':'movie'},{'media_type':'person','name':'X'}]}
    elif p=='/tv/101': body=TV
    elif p=='/movie/202': body=MOV
    elif p=='/movie/303': body=FUT
    elif p=='/tv/101/season/1': body={'episodes':[{'episode_number':i,'name':f'Cap {i}','air_date':'2025-04-30','runtime':50,'overview':f'Resumen {i}','still_path':f'/s{i}.jpg'} for i in range(1,7)]}
    elif p=='/tv/101/season/2': body={'episodes':[{'episode_number':i,'name':f'Episodio {i}','air_date':fut} for i in range(1,7)]}
    if body is None: return route.fulfill(status=404, body='{}')
    route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin':'*'}, body=json.dumps(body))
EV="""async (code) => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const F = await import('/modules/bitacora/filmoteca.js'); const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx); const d = await m.cargar(); return await (new Function('m','d','M','F','ctx', 'return (async()=>{'+code+'})()'))(m,d,M,F,ctx); }"""
TAR="""async (code) => { const D = await import('/js/core/datos.js'); const c=(n)=>D.coleccion('tareas',n); return await (new Function('c', 'return (async()=>{'+code+'})()'))(c); }"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366,390):
    cx=b.new_context(viewport={'width':w,'height':900}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.route('https://api.themoviedb.org/**', tmdb)
    page.route('https://image.tmdb.org/**', lambda r: r.fulfill(status=200, content_type='image/png', body=PNG))
    page.goto(U); page.wait_for_timeout(800)
    ev=lambda code: page.evaluate(EV, code); tar=lambda code: page.evaluate(TAR, code)
    page.evaluate(SEED)
    # sin clave
    page.goto(U+'#/bitacora/f'); page.wait_for_timeout(900)
    chk(page.locator('.fm-aviso').count()==1, 'aviso falta clave')
    chk(page.locator('.bt-ar:has-text("Filmoteca")').count()==(1 if w>600 else 0), 'arbol filmoteca')
    # cargar clave
    page.goto(U+'#/bitacora/ajustes'); page.wait_for_timeout(800)
    page.fill('input[aria-label="Clave de TMDB"]', 'MALA'); page.click('button:has-text("Probar y guardar")'); page.wait_for_timeout(600)
    chk('no aceptó' in page.locator('.tarjeta:has-text("Filmoteca") .nota').first.inner_text() or 'no aceptó' in page.content(), 'clave mala')
    page.fill('input[aria-label="Clave de TMDB"]', 'CLAVE'); page.click('button:has-text("Probar y guardar")'); page.wait_for_timeout(900)
    chk(ev("return F.config(d).clave")=='CLAVE', 'clave guardada')
    # buscar y agregar
    page.goto(U+'#/bitacora/f/agregar'); page.wait_for_timeout(500)
    page.fill('.bt-busca-input', 'eter'); page.wait_for_timeout(1200)
    chk(page.locator('.fm-res').count()==3, 'resultados (sin personas)')
    page.locator('.fm-res:has-text("Relatos") button:has-text("Pendientes")').click(); page.wait_for_timeout(1500)
    chk(page.locator('dialog[open]').count()==0, 'pendientes sin recuadro')
    chk(page.locator('.aviso:has-text("Agregada a Pendientes") .aviso-accion:has-text("Deshacer")').count()==1, 'deshacer visible')
    page.locator('.aviso .aviso-accion:has-text("Deshacer")').first.click(); page.wait_for_timeout(1200)
    chk(ev("return F.items(d).length")==0, 'deshacer borra')
    page.locator('.fm-res:has-text("Relatos") button:has-text("Pendientes")').click(); page.wait_for_timeout(1500)
    ev("const n=F.items(d)[0]; await F.guardarCine(m,n,{recomendada:'Juan'})")
    # ver antes de guardar (serie) y agregar como Viendo
    page.locator('.fm-res:has-text("Eternauta")').click(); page.wait_for_timeout(1800)
    chk('/f/v/tv/101' in page.url, 'abre vista previa')
    chk(page.locator('.fm-barra-abajo button').count()==3, 'barra 3 botones serie')
    chk(page.locator('.fm-temp').count()==2 and page.locator('.fm-ep input').count()==0, 'previa sin casillas')
    page.locator('.fm-temp').first.locator('.fm-ep-n').first.click(); page.wait_for_timeout(500)
    chk(page.locator('.fm-ep.abierto .fm-ep-d p').inner_text().startswith('Resumen 1'), 'detalle episodio en previa')
    page.screenshot(path=S+f'fm2_previa_{w}.png', full_page=True)
    page.click('.fm-barra-abajo button:has-text("Viendo")'); page.wait_for_timeout(1500)
    chk('#/bitacora/n/' in page.url, 'agregada abre ficha')
    page.goto(U+'#/bitacora/f/v/movie/303'); page.wait_for_timeout(1500)
    chk(page.locator('.fm-barra-abajo button').count()==2, 'barra 2 botones peli')
    page.click('.fm-barra-abajo button:has-text("Pendientes")'); page.wait_for_timeout(1500)
    its=ev("return F.items(d).map(n=>({t:n.titulo,e:n.cine.estado,r:n.cine.recomendada,c:n.carpetaId, car:d.carpeta(n.carpetaId)?.sistema}))"); print(its)
    chk(len(its)==3 and all(x['car']=='filmoteca' for x in its), 'en carpeta filmoteca')
    # ficha serie: marcar episodios
    sid=ev("return F.items(d).find(n=>n.cine.tipo==='tv').id")
    page.goto(U+f'#/bitacora/n/{sid}'); page.wait_for_timeout(1800)
    chk(page.locator('.fm-hero h1').inner_text()=='El Eternauta', 'hero')
    chk(page.locator('.fm-plat span:has-text("Netflix")').count()==1 and 'Apple' not in page.locator('.fm-plat').inner_text(), 'plataformas solo streaming')
    chk(page.locator('.fm-temp').count()==2, 'temporadas sin especiales')
    chk(page.locator('.fm-temp').first.locator('.fm-ep').count()==6, 'episodios T1')
    page.locator('.fm-temp').first.locator('.fm-ep').nth(2).locator('.fm-hasta').click(); page.wait_for_timeout(1000)
    c=ev(f"return d.nota('{sid}').cine"); print(c['vistos'])
    chk(len(c['vistos'])==3, 'hasta acá marca 3')
    chk(page.locator('.fm-ep.prox').count()==1 and 'E4' in page.locator('.fm-ep.prox').inner_text(), 'proximo E4')
    page.screenshot(path=S+f'fm_serie_{w}.png', full_page=True)
    page.locator('.fm-temp').first.locator('summary button:has-text("Temporada completa")').click(); page.wait_for_timeout(1000)
    c=ev(f"return d.nota('{sid}').cine")
    chk(len(c['vistos'])==6 and c['estado']=='viendo', 'temporada completa, sigue viendo (en emisión)')
    # aviso
    page.locator('.fm-props button[role=switch]').click(); page.wait_for_timeout(4500)
    t=tar("return (await c('tareas').listar()).filter(t=>t.origen?.clave?.startsWith('filmoteca:'))"); print([x['titulo'] for x in t])
    chk(len(t)==1 and 'T2 E1' in t[0]['titulo'] and t[0]['fecha']==fut, 'tarea episodio nuevo')
    proy=tar("return (await c('proyectos').listar()).find(p=>p.sistema==='filmoteca')?.nombre"); chk(proy=='Filmoteca','proyecto Filmoteca')
    # pelicula: Vista con estrellas y deshacer
    mid=ev("return F.items(d).find(n=>n.titulo==='Relatos salvajes').id")
    page.goto(U+f'#/bitacora/n/{mid}'); page.wait_for_timeout(1500)
    chk(page.locator('.fm-estado button').all_inner_texts()==['Pendientes','Vista','Abandonada'], 'estados pelicula')
    page.click('.fm-estado button:has-text("Vista")'); page.wait_for_timeout(300)
    est=page.locator('dialog[open] .fm-estrella').nth(4); bb=est.bounding_box(); page.mouse.click(bb['x']+bb['width']*0.25, bb['y']+bb['height']/2)
    page.click('dialog[open] .boton.principal'); page.wait_for_timeout(1000)
    c=ev(f"return d.nota('{mid}').cine"); chk(c['estado']=='vista' and len(c['vistas'])==1 and c['calificacion']==9, 'vista 4,5 estrellas %s'%c['calificacion'])
    chk('4,5' in page.locator('.fm-props .fm-est-n').inner_text(), 'muestra 4,5')
    page.click('.fm-estado button:has-text("Abandonada")'); page.wait_for_timeout(900)
    page.locator('.aviso .aviso-accion:has-text("Deshacer")').last.click(); page.wait_for_timeout(900)
    chk(ev(f"return d.nota('{mid}').cine.estado")=='vista', 'deshacer cambio de estado')
    chk(page.locator('button:has-text("otra vez")').count()==0, 'sin la vi otra vez')
    page.click('.fm-nota .ed-area'); page.wait_for_timeout(400); page.keyboard.type('Tremenda la del casamiento'); page.wait_for_timeout(1200)
    chk('casamiento' in ev(f"return d.nota('{mid}').texto"), 'notas en ficha')
    page.screenshot(path=S+f'fm_peli_{w}.png', full_page=True)
    # portada
    page.goto(U+'#/bitacora/f'); page.wait_for_timeout(1200)
    titulos=page.locator('.fm-fila-t h2').all_inner_texts(); print(titulos)
    chk(titulos[:4]==['Seguir viendo','Pendientes','Próximos estrenos y episodios','Vistas hace poco'] and page.locator('.fm-chip').count()==0 and page.locator('.fm-tipo-sel button').count()==3, 'filas portada')
    page.click('.fm-tipo-sel button:has-text("Series")'); page.wait_for_timeout(400)
    chk(page.locator('.fm-fila-t h2:has-text("Vistas")').count()==0, 'filtro series')
    page.click('.fm-tipo-sel button:has-text("Ambos")'); page.wait_for_timeout(300)
    page.screenshot(path=S+f'fm_portada_{w}.png', full_page=True)
    page.goto(U+'#/bitacora/f/stats'); page.wait_for_timeout(900)
    chk(page.locator('.fm-stat b').first.inner_text().endswith('h'), 'stats')
    page.screenshot(path=S+f'fm_stats_{w}.png', full_page=True)
    # inicio bitacora bloque seguir viendo
    page.goto(U+'#/bitacora'); page.wait_for_timeout(900)
    chk(page.locator('.bt-bloque-h:has-text("Seguir viendo")').count()==1, 'bloque seguir viendo')
    # md
    e=ev("return M.espejoDe(d).archivos.filter(a=>a.ruta[0]==='Filmoteca').map(a=>a.contenido)"); print(e[0][:300])
    chk(len(e)==3 and 'tipo:' in e[0], 'md filmoteca')
    print(w,'err',err)
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
