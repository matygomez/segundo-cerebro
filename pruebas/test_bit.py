from playwright.sync_api import sync_playwright
import datetime, json
U='http://localhost:8765/'; S=__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/capturas/'
ok=0; fallas=[]
def chk(c,n):
    global ok
    if c: ok+=1
    else: fallas.append(n); print('FALLA',n)
SEED="""async () => {
  const R = await import('/js/core/registro.js'); const M = await import('/modules/bitacora/modelo.js');
  const ctx = R.contexto('bitacora'); const m = M.crearModelo(ctx);
  const tiro = await m.crearCarpeta({ nombre: 'Tiro', color: '#A3423A' });
  const clu = await m.crearCarpeta({ nombre: 'Curso CLU', padreId: tiro });
  const alu = await m.crearCarpeta({ nombre: 'Alumnos', padreId: tiro });
  const much = await m.crearCarpeta({ nombre: 'Muchtek', color: '#2F5E8C', icono: '🏭' });
  await m.guardarCarpeta(alu, { base: true, campos: [
    { id: 'tel', nombre: 'Teléfono', tipo: 'telefono', visible: true },
    { id: 'fecha', nombre: 'Fecha de clase', tipo: 'fecha', visible: true },
    { id: 'pago', nombre: 'Pagó', tipo: 'sino', visible: true },
    { id: 'imp', nombre: 'Importe', tipo: 'numero', visible: true },
    { id: 'est', nombre: 'Estado MiRenar', tipo: 'opcion', visible: true, opciones: [{id:'i',nombre:'Inscripto',color:'azul'},{id:'r',nombre:'Rindió',color:'laton'},{id:'a',nombre:'Aprobado',color:'verde'}] },
    { id: 'cal', nombre: 'Nivel', tipo: 'calificacion', visible: false },
  ], vistas: [] });
  const clase = await m.crearNota({ titulo: 'Curso CLU – Clase básica', carpetaId: clu, texto: 'Clase de 2–3 h. Va con [[Normas de seguridad]] primero. #tiro/clu\\n\\n## Orden\\n- Normas\\n- Partes de la pistola\\n  - Corredera\\n\\n## Pendientes\\n- [x] Armar presentación\\n- [ ] Imprimir blancos\\n\\n> Ojo con **la seguridad** y ==siempre== `apuntar` a zona segura\\n\\n| A | B |\\n|---|---|\\n| 1 | 2 |\\n\\nVer https://example.com y [link](https://example.org)' });
  await m.crearNota({ titulo: 'Normas de seguridad', carpetaId: clu, texto: 'Las 4 reglas. Ver la Curso CLU – Clase básica antes.' });
  await m.crearNota({ titulo: 'Lucía Fernández', carpetaId: alu, texto: 'Tomó la [[Curso CLU – Clase básica]] el 10/10.', props: { tel: '11 5555-1234', fecha: '2026-10-10', pago: true, imp: 45000, est: 'r' } });
  await m.crearNota({ titulo: 'Martín Ruiz', carpetaId: alu, texto: '', props: { tel: '11 4444-9876', fecha: '2026-10-17', pago: false, imp: 45000, est: 'i' } });
  await m.crearNota({ titulo: 'Carla Benítez', carpetaId: alu, texto: '', props: { fecha: '2026-09-12', pago: true, imp: 40000, est: 'a' } });
  await m.crearNota({ titulo: 'Idea: checklist de cierre', carpetaId: '', texto: 'algo #idea' });
  await m.crearNota({ titulo: 'PG-LOG-012 Recepción', carpetaId: much, texto: 'Procedimiento #muchtek/logistica' });
  return { tiro, clu, alu, much, clase };
}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366,390):
    cx=b.new_context(viewport={'width':w,'height':900}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e))); page.on('console', lambda m: err.append(m.text) if m.type=='error' else None)
    page.goto(U); page.wait_for_timeout(800)
    ids=page.evaluate(SEED)
    page.goto(U+'#/bitacora'); page.wait_for_timeout(1500)
    page.screenshot(path=S+f'b_ini_{w}.png', full_page=True)
    chk(page.locator('.bt-titulo').first.inner_text().strip()=='Bitácora','titulo inicio')
    chk(page.locator('.bt-bloque-bandeja .bt-fila').count()==1,'bandeja 1')
    chk(page.locator('.bt-ar:has-text("Alumnos")').count()==1,'arbol alumnos')
    page.goto(U+f'#/bitacora/n/{ids["clase"]}'); page.wait_for_timeout(1200)
    page.screenshot(path=S+f'b_nota_{w}.png', full_page=True)
    chk(page.locator('.ed-area .ed-wl').count()>=1,'wikilink')
    chk(page.locator('.ed-area ul.ed-chk > li').count()==2,'casillas')
    chk(page.locator('.ed-area pre.ed-crudo').count()==1,'tabla md')
    chk(page.locator('.bt-men:has-text("Lucía")').count()==1,'mencionada en')
    page.goto(U+f'#/bitacora/c/{ids["alu"]}'); page.wait_for_timeout(1200)
    page.screenshot(path=S+f'b_base_{w}.png', full_page=True)
    chk(page.locator('.bt-tabla tbody tr').count()==3,'filas base')
    chk('130.000' in page.locator('.bt-tabla tfoot').inner_text(),'total suma')
    print(w, 'errores', err[:5])
  print('FIN', ok, 'ok', len(fallas), 'fallas', fallas)
