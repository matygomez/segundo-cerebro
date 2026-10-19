from playwright.sync_api import sync_playwright
import time
exec(open('test_bit.py').read().split("\nwith sync_playwright")[0])
exec(open('fake_drive.py').read())
EV="""async (code) => { const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js'); const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx); const d = await m.cargar(); return await (new Function('m','d','M','ctx', 'return (async()=>{'+code+'})()'))(m,d,M,ctx); }"""
SYNC="async()=>{const s=await import('/js/core/sincronizacion.js'); await s.sincronizar(); await new Promise(r=>setTimeout(r,300)); await s.sincronizar(); return s.estadoSync();}"
def armar(b, fd):
    cx=b.new_context(viewport={'width':1366,'height':900}); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body="export const GOOGLE_CLIENT_ID='x.apps.googleusercontent.com'; export const GOOGLE_API_KEY=''; export const GOOGLE_APP_ID=''; export const CARPETA_DRIVE='Segundo Cerebro';"))
    page.route('https://www.googleapis.com/**', lambda r, req: fd.handle(r, req))
    page.add_init_script("localStorage.setItem('sc-sesion', JSON.stringify({token:'tok', expira: Date.now()+3600e3, alcances:'https://www.googleapis.com/auth/drive.file'})); localStorage.setItem('sc-cuenta','yo@test.com');")
    page.route('https://accounts.google.com/**', lambda r: r.fulfill(status=200, body='window.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}}),revoke(){}}}};'))
    return page, err
with sync_playwright() as p:
  b=p.chromium.launch(); fd=FakeDrive()
  page,err=armar(b, fd)
  page.goto(U); page.wait_for_timeout(1500)
  ids=page.evaluate(SEED)
  ev=lambda code: page.evaluate(EV, code)
  page.goto(U+'#/bitacora'); page.wait_for_timeout(1500)
  st=page.evaluate(SYNC); print(st)
  for i in range(4):
      page.wait_for_timeout(2500); st=page.evaluate(SYNC)
  md={fd.ruta(f['id']):f for f in fd.vivos() if f['name'].endswith('.md')}
  print(sorted(md))
  chk('Segundo Cerebro/Bitácora/Tiro/Alumnos/Lucía Fernández.md' in md, 'md lucia')
  chk('Segundo Cerebro/Bitácora/Bandeja/Idea- checklist de cierre.md' in md, 'md bandeja')
  chk(b'Estado MiRenar: "Rindi' in md['Segundo Cerebro/Bitácora/Tiro/Alumnos/Lucía Fernández.md']['content'], 'contenido md')
  chk(any(fd.ruta(f['id'])=='Segundo Cerebro/bitacora/espejo.json' for f in fd.vivos()), 'espejo.json')
  # renombrar + mover carpeta + borrar nota
  ev(f"await m.renombrar('{ids['clase']}', 'Clase básica CLU')")
  ev(f"await m.guardarCarpeta('{ids['clu']}', {{ nombre: 'Curso CLU 2026' }})")
  ev(f"const n=d.notas.find(x=>x.titulo==='PG-LOG-012 Recepción'); await m.aPapelera(n.id)")
  for i in range(3):
      page.wait_for_timeout(2500); st=page.evaluate(SYNC)
  md={fd.ruta(f['id']):f for f in fd.vivos() if f['name'].endswith('.md')}
  print(sorted(md))
  chk('Segundo Cerebro/Bitácora/Tiro/Curso CLU 2026/Clase básica CLU.md' in md, 'renombrar y mover')
  chk(not any('PG-LOG' in k for k in md), 'papelera saca md')
  chk(b'[[Clase b\xc3\xa1sica CLU]]' in md['Segundo Cerebro/Bitácora/Tiro/Alumnos/Lucía Fernández.md']['content'], 'enlace actualizado en md')
  vacias=[fd.ruta(f['id']) for f in fd.vivos() if f['mimeType'].endswith('folder') and f['name']=='Curso CLU']
  chk(not vacias, 'carpeta vieja vacia a papelera %s'%vacias)
  n_md=len(md)
  # Segundo dispositivo: misma Drive, no duplica
  page2,err2=armar(b, fd)
  page2.goto(U); page2.wait_for_timeout(1500)
  for i in range(4):
      page2.evaluate(SYNC); page2.wait_for_timeout(2500)
  page2.goto(U+'#/bitacora'); page2.wait_for_timeout(1500)
  for i in range(3):
      page2.evaluate(SYNC); page2.wait_for_timeout(2500)
  md2=[fd.ruta(f['id']) for f in fd.vivos() if f['name'].endswith('.md')]
  print(len(md2), n_md)
  chk(len(md2)==n_md and len(set(md2))==len(md2), 'segundo dispositivo no duplica')
  print('errores', err[:5], err2[:5]); print('estado', st)
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
