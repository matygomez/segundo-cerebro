from playwright.sync_api import sync_playwright
exec(open('test_tareas.py').read().split("with sync_playwright")[0])
EXTRA="""async () => {
  const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('tareas', n);
  const p=(x)=>String(x).padStart(2,'0'); const f=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
  const per=(await c('areas').listar()).find(a=>a.nombre==='Personal').id;
  const id = await c('tareas').crear({ titulo:'Tarea completa con todo', fecha:f(0), hora:'18:00', estado:'pendiente', areaId:per, notas:'algo', repeticion:{tipo:'semanal',cada:1}, recordatorio:f(0)+'T09:00', adjuntos:[{driveId:'x1',nombre:'doc.pdf',tipo:'application/pdf',url:'https://drive.google.com/x'}], etiquetas:[], orden:1 });
  await c('tareas').crear({ titulo:'Hija 1', estado:'hecha', padreId:id, areaId:per, adjuntos:[], etiquetas:[], orden:2, fecha:'' });
  await c('tareas').crear({ titulo:'Hija 2', estado:'pendiente', padreId:id, areaId:per, adjuntos:[], etiquetas:[], orden:3, fecha:'' });
  await c('comentarios').crear({ tareaId:id, texto:'hola', editado:false });
  await c('tareas').crear({ titulo:'Regar plantas', fecha:f(1), estado:'pendiente', areaId:per, repeticion:{tipo:'diaria',cada:3}, adjuntos:[], etiquetas:[], orden:4 });
  for (const k of ['hojas-pc','hojas-cel']) await c('ajustes').crear({ clave:k, compacto:true });
}"""
PEGAR="""async (sel) => {
  const cv=document.createElement('canvas'); cv.width=40; cv.height=30; const g=cv.getContext('2d'); g.fillStyle='#c33'; g.fillRect(0,0,40,30);
  const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
  const dt=new DataTransfer(); dt.items.add(new File([blob],'image.png',{type:'image/png'}));
  if (sel) document.querySelector(sel).focus();
  const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});
  (document.activeElement||document).dispatchEvent(ev);
}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (1366, 390):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(500); page.evaluate(SEED); page.evaluate(EXTRA)
    page.goto(U+'#/tareas/hoy'); page.wait_for_timeout(1000)
    chk(page.locator('.tr-compacto').count()==1, 'compacto activo')
    fila=page.locator('.tr-tarea:has(.tr-titulo:text-is("Tarea completa con todo")) > .tr-fila').first
    ind=fila.locator('.tr-indic .tr-ind').count(); chk(ind==5, f'5 íconos ({ind})')
    # íconos justo después del título
    bt=fila.locator('.tr-titulo').bounding_box(); bi=fila.locator('.tr-indic').bounding_box()
    chk(abs(bi['x']-(bt['x']+bt['width']))<16, f'íconos pegados al título {bt} {bi}')
    rep=fila.locator('.tr-col-rep').inner_text().strip(); fe=fila.locator('.tr-col-fecha').inner_text().strip()
    print(w, repr(rep), repr(fe))
    chk(rep==('Cada semana' if w>600 else 'Semanal'), f'texto repetición {rep}')
    chk(fe.startswith('Hoy'), 'fecha en columna')
    cw=fila.locator('.tr-col-rep').bounding_box()['width']; fw=fila.locator('.tr-col-fecha').bounding_box()['width']
    chk((cw,fw)==((96,82) if w>600 else (64,70)), f'anchos {cw},{fw}')
    enc=page.locator('.tr-col-enc').first
    chk(enc.is_visible() and 'Repetición' in enc.inner_text(), 'encabezado Repetición')
    # alineación encabezado/columna
    chk(abs(enc.locator('.tr-col-fecha').bounding_box()['x']-fila.locator('.tr-col-fecha').bounding_box()['x'])<2, 'encabezado alineado')
    nums=fila.locator('.tr-ind-num').first.is_visible(); chk(nums==(w>600), 'números según dispositivo')
    rg=page.locator('.tr-tarea:has(.tr-titulo:text-is("Regar plantas")) .tr-col-rep').first.inner_text().strip()
    chk(rg==('Cada 3 días' if w>600 else 'c/3 días'), f'regar {rg}')
    chk(page.locator('.tr-cuerpo-vista .tr-metas:visible').count()==0, 'sin línea meta en compacto')
    # sin overflow horizontal
    chk(page.evaluate('document.documentElement.scrollWidth')<=w, 'sin scroll horizontal')
    page.screenshot(path=S+f't110_lista_{w}.png', full_page=False)
    # abrir detalle y pegar imagen
    fila.locator('.tr-cuerpo').click(); page.wait_for_timeout(700)
    page.evaluate(PEGAR, None); page.wait_for_timeout(1200)
    mins=page.locator('.tr-adjuntos-zona .tr-miniatura img[src^="blob:"]').count(); chk(mins==1, f'miniatura pegada {mins}')
    chk(page.locator('.tr-adjuntos-zona .tr-adjuntos li').count()==1, 'pdf como enlace')
    nom=page.locator('.tr-adjuntos-zona .tr-miniatura').first.get_attribute('title'); print(nom); chk(nom.startswith('Captura '), 'nombre Captura')
    # visor
    page.locator('.tr-adjuntos-zona .tr-miniatura').first.click(); page.wait_for_timeout(500)
    chk(page.locator('dialog.tr-visor[open] img[src^="blob:"]').count()==1, 'visor abierto')
    page.screenshot(path=S+f't110_visor_{w}.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(300)
    chk(page.locator('dialog.tr-visor').count()==0, 'visor cerrado')
    chk(page.locator('.tr-editor').count()==1, 'editor sigue abierto')
    # pegar en comentario
    page.evaluate(PEGAR, '.tr-nuevo-comentario textarea'); page.wait_for_timeout(1000)
    chk(page.locator('.tr-nuevo-comentario .tr-miniatura img[src^="blob:"]').count()==1, 'imagen en borrador comentario')
    chk(page.locator('.tr-adjuntos-zona .tr-miniatura').count()==1, 'no se sumó a adjuntos')
    page.click('.tr-com-enviar'); page.wait_for_timeout(900)
    chk(page.locator('.tr-lista-comentarios li .tr-miniatura').count()==1, 'comentario con imagen')
    page.screenshot(path=S+f't110_detalle_{w}.png', full_page=True)
    # pie fijo: visible sin bajar
    pie=page.locator('.tr-editor .tr-botones').bounding_box(); chk(pie and pie['y']+pie['height']<=851, f'pie visible {pie}')
    ab=page.locator('.tr-adj-botones').bounding_box(); cb=page.locator('.tr-editor .formulario-campos').first.bounding_box()
    chk(abs(ab['width']-cb['width'])<3, f'botones a todo el ancho {ab["width"]} {cb["width"]}')
    chk(page.locator('.tr-pegar').count()==0, 'sin recuadro pegar')
    page.screenshot(path=S+f't111_detalle_{w}.png')
    page.click('.tr-editor button[type=submit]'); page.wait_for_timeout(900)
    adj=page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const t=(await D.coleccion('tareas','tareas').listar()).find(x=>x.titulo==='Tarea completa con todo');return t.adjuntos.length}""")
    chk(adj==2, f'guardado con 2 adjuntos ({adj})')
    # pegar sin editor abierto no hace nada
    page.evaluate(PEGAR, None); page.wait_for_timeout(400)
    # Inicio: contadores
    page.goto(U+'#/tareas'); page.wait_for_timeout(900)
    per=page.locator('.tr-nodo:has-text("Personal")').first
    chk(per.locator('.tr-cont.venc').count()==1 and per.locator('.tr-cont.hoy').count()==1 and per.locator('.tr-cont.total').count()==1, 'contadores Personal')
    chk(per.locator('.tr-cont .icono').count()==3, 'con símbolo')
    chk(page.locator('.tr-leyenda').count()==1, 'leyenda')
    page.screenshot(path=S+f't111_inicio_{w}.png')
    # cambiar a nada y sin contador en pestañas
    page.locator('.tr-herramientas button[aria-label*="onfigur"], button[aria-label="Configurar Tareas"]').first.click(); page.wait_for_timeout(500)
    page.locator('dialog[open] .tr-seg button:has-text("Nada")').click(); page.wait_for_timeout(400)
    page.locator('dialog[open] button[aria-label="Contador en las pestañas"]').click(); page.wait_for_timeout(400)
    chk(page.locator('dialog[open] button[aria-label="Leyenda en Inicio"]').count()==0, 'leyenda oculta con Nada')
    page.keyboard.press('Escape'); page.wait_for_timeout(700)
    chk(page.locator('.tr-leyenda').count()==0 and page.locator('.tr-cont.venc').count()==0, 'modo nada')
    chk(page.locator('.tr-cont.total').count()>0, 'total sigue')
    chk(page.locator('.tr-pest .tr-marca').count()==0, 'sin contador pestañas')
    chk(not err, f'errores {w} {err}')
    cx.close()
print(ok,'ok',len(fallas),'fallas')
