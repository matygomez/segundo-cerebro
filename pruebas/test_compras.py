from playwright.sync_api import sync_playwright
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
exec(open('test_tareas.py').read().split("\nwith sync_playwright")[0])
SEEDC="""async () => {
  const D = await import('/js/core/datos.js'); const c = (n) => D.coleccion('compras', n);
  const p=(x)=>String(x).padStart(2,'0'); const f=(n)=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
  const T = async (nombre, base, emoji, sector, lugar) => c('tipos').crear({ nombre, base, emoji, sector, lugar, preferidoId:'', gusto:'' });
  const leche = await T('Leche entera','L','🥛','Lácteos','Heladera');
  const yerba = await T('Yerba','kg','🧉','Almacén','Alacena');
  const cebolla = await T('Cebolla','kg','🧅','Verdulería','Alacena');
  const pollo = await T('Pechuga de pollo','kg','🍗','Carnes y freezer','Freezer');
  const papel = await T('Papel higiénico','u.','🧻','Baño','Baño');
  const P = (nombre, marca, codigo, tipoId, contenido) => c('productos').crear({ nombre, marca, codigo, tipoId, contenido, origen: codigo?'off':'mio', duracion:'' });
  const ser = await P('Leche La Serenísima Entera 1 L','La Serenísima','7790742362109',leche,1);
  const san = await P('Leche Sancor Entera 750 ml','Sancor','7790080054508',leche,0.75);
  const pla = await P('Yerba Playadito 1 kg','Playadito','7790387000017',yerba,1);
  const ceb = await P('Cebolla','', '',cebolla,1);
  const pap = await P('Papel Higienol x4','Higienol','7790250001234',papel,4);
  await c('compras').crear({ fecha:f(-40), super:'Coto', items:[{productoId:ser,tipoId:leche,nombre:'Leche',precio:1150,cantidad:12,contenido:1,descuento:0},{productoId:pla,tipoId:yerba,nombre:'Yerba',precio:5900,cantidad:2,contenido:1,descuento:0}], bruto:30000, descTarjeta:0, total:30000, ahorro:0 });
  await c('compras').crear({ fecha:f(-10), super:'Día', items:[{productoId:ser,tipoId:leche,nombre:'Leche',precio:1290,cantidad:6,contenido:1,descuento:500},{productoId:pap,tipoId:papel,nombre:'Papel',precio:3900,cantidad:2,contenido:4,descuento:0,fueraDeLista:true}], bruto:15540, descTarjeta:1000, total:14040, ahorro:1500 });
  await c('despensa').crear({ tipoId:leche, lugar:'Heladera', cantidad:2, vence:f(2), nota:'' });
  await c('despensa').crear({ tipoId:yerba, lugar:'Alacena', cantidad:0.5, vence:'', nota:'' });
  await c('despensa').crear({ tipoId:pollo, lugar:'Freezer', cantidad:0.8, vence:'', nota:'' });
  await c('lista').crear({ tipoId:leche, cantidad:6, sugerida:true, motivo:'Se termina en ~3 días' });
  await c('lista').crear({ tipoId:cebolla, cantidad:1, sugerida:false, motivo:'' });
  await c('lista').crear({ tipoId:pollo, cantidad:1, sugerida:false, motivo:'' });
  await c('consumo').crear({ fecha:f(-3), tipoId:leche, tipo:'tiro', cantidad:1, motivo:'Venció', valor:1290 });
  const rec = await c('recetas').crear({ nombre:'Pollo al horno con papas', emoji:'🍗', porciones:4, ingredientes:[{tipoId:pollo,nombre:'Pechuga de pollo',cantidad:1,unidad:'kg'},{tipoId:cebolla,nombre:'Cebolla',cantidad:500,unidad:'g'}], preparacion:'1. Horno', veces:3 });
  const rec2 = await c('recetas').crear({ nombre:'Fideos con salsa', emoji:'🍝', porciones:3, ingredientes:[{tipoId:cebolla,nombre:'Cebolla',cantidad:300,unidad:'g'}], preparacion:'', veces:9 });
  await c('comidas').crear({ fecha:f(1), recetaId:rec2, porciones:3, hecha:false });
  await c('comidas').crear({ fecha:f(3), recetaId:rec, porciones:4, hecha:false });
  await c('comidas').crear({ fecha:f(5), recetaId:rec2, porciones:6, hecha:false });
  await c('base').crear({ tipoId:leche, cantidad:10 });
  await c('base').crear({ tipoId:yerba, cantidad:2 });
}"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
  for w in (390,1366):
    cel=w<600
    cx=b.new_context(viewport={'width':w,'height':844 if cel else 900}, is_mobile=cel, has_touch=cel); page=cx.new_page(); err=[]
    page.on('pageerror',lambda e: err.append(str(e)))
    page.on('console',lambda m: err.append('console: '+m.text) if m.type=='error' and 'favicon' not in m.text and 'config' not in m.text else None)
    page.goto(U); page.wait_for_timeout(800); page.evaluate(SEEDC)
    page.goto(U+'#/compras'); page.wait_for_timeout(1500)
    page.screenshot(path=S+f'cp_lista_{w}.png', full_page=True)
    t=tx(page,'.cp-cuerpo')
    chk('Leche entera' in t and '6 L' in t, 'lista leche 6 L')
    chk('6 de Leche La Serenísima' in t, 'envases preferido: '+t[:300])
    chk('Lista del mes' in t, 'tarjeta mes')
    # agregar por texto
    page.fill('#cp-agregar','2 kg papa'); page.press('#cp-agregar','Enter'); page.wait_for_timeout(700)
    chk('Papa' in tx(page,'.cp-cuerpo') and '2 kg' in tx(page,'.cp-cuerpo'), 'agregó papa 2 kg')
    # revisar mes
    page.click('text=Revisar y sumar a la lista'); page.wait_for_timeout(400)
    chk(page.locator('.cp-rev').count()>=2, 'filas revision')
    page.click('.cp-mes >> text=Cerrar'); page.wait_for_timeout(300)
    # empezar compra: carnicería solo carnes
    page.click('text=Empezar la compra'); page.wait_for_timeout(400)
    chk(page.locator('dialog[open]').count()==1, 'dialogo empezar')
    page.fill('#cp-super','Carnicería')
    page.click('dialog[open] >> text=Nada'); page.locator('dialog[open] label.cp-grupo:has-text("Carnes")').click(); page.wait_for_timeout(200)
    page.click('dialog[open] .hoja-botones .principal'); page.wait_for_timeout(1200)
    t=tx(page,'.cp-cuerpo'); print('URL',page.url, 'DLG', page.locator('dialog[open]').count()); print(t[:600]); page.screenshot(path=S+'dbg.png')
    chk('Pechuga de pollo' in t and 'Cebolla' not in t.split('Te falta')[1] if 'Te falta' in t else False, 'solo carnes en te falta')
    chk('más quedan en la lista' in t, 'quedan para otra compra')
    # tocar pollo en te falta -> suelto -> panel
    page.locator('.cp-lc:has-text("Pechuga de pollo")').last.click(); page.wait_for_timeout(600)
    if page.locator('dialog[open]').count(): page.click('dialog[open] .hoja-botones .principal'); page.wait_for_timeout(600)
    chk(page.locator('.cp-encontrado').count()==1, 'panel abierto')
    page.fill('#cp-otro','6000'); page.fill('#cp-cuanto','1,2'); page.wait_for_timeout(200)
    chk('Cubre' in tx(page,'.cp-encontrado'), 'cubre lista pollo: '+tx(page,'.cp-cuenta'))
    page.click('text=Agregar al carrito'); page.wait_for_timeout(800)
    chk('$ 7.200' in tx(page,'.cp-total'), 'total 7200: '+tx(page,'.cp-total'))
    # escanear con código a mano: Sancor (otro tipo de la lista: leche, no elegida -> igual cuenta)
    page.click('text=Escanear un producto'); page.wait_for_timeout(800)
    page.fill('.cp-esc input','7790080054508'); page.press('.cp-esc input','Enter'); page.wait_for_timeout(900)
    chk(page.locator('.cp-encontrado').count()==1 and 'Cuenta para' in tx(page,'.cp-encontrado'), 'sancor cuenta para leche')
    page.screenshot(path=S+f'cp_super_{w}.png', full_page=True)
    page.fill('#cp-otro','1180'); page.wait_for_timeout(200); chk('/L' in tx(page,'.cp-encontrado'), 'precio por litro: '+tx(page,'.cp-encontrado')[:400]); page.click('text=Agregar al carrito'); page.wait_for_timeout(800)
    # código desconocido -> OFF falla -> formulario nombre -> elegir tipo
    page.click('text=Escanear un producto'); page.wait_for_timeout(600)
    page.fill('.cp-esc input','7799999999999'); page.press('.cp-esc input','Enter'); page.wait_for_timeout(9000)
    if page.locator('dialog[open] #campo-nombre').count():
      page.fill('#campo-nombre','Chocolate Águila 150 g'); page.click('dialog[open] button[type=submit]'); page.wait_for_timeout(500)
    chk(page.locator('dialog[open] #cp-tipo').count()==1, 'pregunta tipo')
    page.click('dialog[open] .hoja-botones .principal'); page.wait_for_timeout(700)
    chk('No estaba en la lista' in tx(page,'.cp-encontrado'), 'fuera de lista')
    page.fill('#cp-otro','3400'); page.click('text=Agregar al carrito'); page.wait_for_timeout(800)
    chk('fuera de lista' in tx(page,'.cp-cuerpo'), 'marca fuera de lista')
    # terminar
    page.click('text=Terminar ›'); page.wait_for_timeout(900)
    page.locator('.cp-dsc input').first.fill('500'); page.fill('#cp-dtar','1000'); page.wait_for_timeout(200)
    t=tx(page,'.cp-cuenta'); print(t)
    page.screenshot(path=S+f'cp_terminar_{w}.png', full_page=True)
    page.click('text=Guardar la compra'); page.wait_for_timeout(1500)
    if page.locator('dialog[open]').count(): page.keyboard.press('Escape'); page.wait_for_timeout(500)
    page.goto(U+'#/compras'); page.wait_for_timeout(1000)
    t=tx(page,'.cp-cuerpo')
    chk('Pechuga de pollo' not in t, 'pollo salió de la lista')
    chk('Cebolla' in t, 'cebolla sigue')
    page.goto(U+'#/compras/despensa'); page.wait_for_timeout(1000)
    t=tx(page,'.cp-cuerpo'); chk('Pechuga de pollo' in t and '2\nkg' in t, 'despensa pollo 2 kg: '+t.replace(chr(10),' ')[150:700])
    page.screenshot(path=S+f'cp_desp_{w}.png', full_page=True)
    page.locator('.cp-menos').first.click(); page.wait_for_timeout(600)
    if page.locator('dialog[open]').count(): page.click('dialog[open] button[type=submit]'); page.wait_for_timeout(500)
    page.goto(U+'#/compras/recuento'); page.wait_for_timeout(1000)
    page.locator('.cp-igual').first.click(); page.wait_for_timeout(200)
    page.click('text=Aplicar y seguir'); page.wait_for_timeout(800)
    page.goto(U+'#/compras/comidas'); page.wait_for_timeout(1000)
    t=tx(page,'.cp-cuerpo'); print(t[t.find('te falta'):t.find('te falta')+250])
    chk('· Fideos con salsa' in t, 'falta ordenado fideos')
    page.screenshot(path=S+f'cp_comidas_{w}.png', full_page=True)
    page.locator('.cp-rec a.tx:has-text("Pollo al horno")').click(); page.wait_for_timeout(800)
    chk('INGREDIENTES' in tx(page,'.cp-cuerpo').upper() and page.locator('.cp-pest').count()==0, 'receta sola: '+page.url+tx(page,'.cp-cuerpo')[:200])
    page.goto(U+'#/compras/comidas/nueva'); page.wait_for_timeout(700)
    page.fill('#cp-rec-nombre','Arroz con leche'); page.click('text=Crear y cargar ingredientes'); page.wait_for_timeout(900)
    chk('Arroz con leche' in page.content(), 'receta creada')
    page.goto(U+'#/compras/informe'); page.wait_for_timeout(1200)
    page.screenshot(path=S+f'cp_informe_{w}.png', full_page=True)
    chk('Gastado' in tx(page,'.cp-cuerpo'), 'informe')
    page.goto(U+'#/compras/ajustes'); page.wait_for_timeout(1000)
    page.click('text=Leche Sancor Entera 750 ml'); page.wait_for_timeout(800)
    t=tx(page,'.cp-cuerpo'); chk('Tipo' in t and '/L' in t, 'ficha sancor')
    page.screenshot(path=S+f'cp_ficha_{w}.png', full_page=True)
    page.goto(U+'#/'); page.wait_for_timeout(1200)
    page.goto(U+'#/compras/super'); page.wait_for_timeout(800)
    print('ERR',err[:8])
    chk(not [e for e in err if 'console:' not in e], 'sin errores js')
  print(ok,'ok',len(fallas),'fallas')
