from playwright.sync_api import sync_playwright
import datetime
exec(open('test_013.py').read().split("\nwith sync_playwright")[0])
hoy_=datetime.date.today()
def f(n): return (hoy_+datetime.timedelta(days=n)).isoformat()
FAKE=f"""async (fase)=>{{
 const R=await import('/js/core/registro.js'); const C=await import('/modules/tareas/calendario.js'); const M=await import('/modules/tareas/modelo.js');
 const ctx=R.contexto('tareas');
 const evTrabajo=[
   {{id:'r1',status:'confirmed',summary:'Reunión de stock',location:'Sala 2',hangoutLink:'https://meet.google.com/abc',start:{{dateTime:'{f(1)}T10:30:00-03:00'}},end:{{dateTime:'{f(1)}T11:30:00-03:00'}},organizer:{{email:'jefe@muchtek.com'}},attendees:[{{email:'yo@muchtek.com',responseStatus:'accepted'}}]}},
   {{id:'r2',status:'confirmed',summary:'Reunión rechazada',start:{{dateTime:'{f(2)}T09:00:00-03:00'}},end:{{dateTime:'{f(2)}T10:00:00-03:00'}},attendees:[{{email:'yo@muchtek.com',responseStatus:'declined'}}]}},
   ...(fase<3?[{{id:'r3',status:'confirmed',summary:'Reunión que se cancela',start:{{dateTime:'{f(3)}T09:00:00-03:00'}},end:{{dateTime:'{f(3)}T10:00:00-03:00'}}}},{{id:'r4',status:'confirmed',summary:'Reunión con notas',start:{{dateTime:'{f(4)}T09:00:00-03:00'}},end:{{dateTime:'{f(4)}T10:00:00-03:00'}}}}]:[]),
 ];
 const fer=[{{id:'f1',summary:'Feriado A',start:{{date:'{f(5)}'}}}},{{id:'f2',summary:'Feriado B',start:{{date:'{f(200)}'}}}}];
 const per=[{{id:'p1',summary:'Cumple de Juan',start:{{date:'{f(2)}'}}}}];
 ctx.calendario={{disponible:()=>true,configurado:()=>true,
   calendarios:async()=>[{{id:'yo@muchtek.com',nombre:'Trabajo',color:'#A3423A'}},{{id:C.FERIADOS_AR||'es.ar#holiday@group.v.calendar.google.com',nombre:'Feriados en Argentina',feriados:true,color:'#6B4E9B'}},{{id:'yo@gmail.com',nombre:'Personal',principal:true,color:'#2F5E8C'}},{{id:'addressbook#contacts@group.v.calendar.google.com',nombre:'Cumpleaños',porDefecto:true}}],
   eventos:async(id)=> id==='yo@muchtek.com'?evTrabajo: /holiday/.test(id)?fer: id==='yo@gmail.com'?per:[] }};
 const m=M.crearModelo(ctx);
 if(fase===1){{ await C.sincronizarCalendario(ctx,{{forzar:true}});
   const d=await m.cargar(); const tr=d.areas.find(a=>a.nombre==='Trabajo');
   const cals={{...(d.ajuste('calendarios')?.cals||{{}})}}; cals['yo@muchtek.com']={{...cals['yo@muchtek.com'],destino:'area:'+tr.id,modo:'tarea'}};
   await m.guardarHojas('calendarios',{{cals}}); }}
 await C.sincronizarCalendario(ctx,{{forzar:true}});
 const d=await m.cargar();
 return d.todas.filter(t=>t.origen?.clave?.startsWith('cal:')).map(t=>({{clave:t.origen.clave,titulo:t.titulo,fecha:t.fecha,hora:t.hora,dur:t.duracion,aviso:!!t.aviso,area:d.area(t.areaId)?.nombre,proy:d.proyecto(t.proyectoId)?.nombre||'',notas:t.notas,inicio:t.inicio,estado:t.estado}}));
}}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for w in (390,1366):
    cx=b.new_context(viewport={'width':w,'height':850}, is_mobile=w<600, has_touch=w<600); page=cx.new_page(); err=[]; page.on('pageerror',lambda e: err.append(str(e)))
    page.goto(U); page.wait_for_timeout(700); page.evaluate(SEED, None); page.evaluate(EXTRA)
    page.evaluate(open('test_tareas.py').read().split('SEED="""')[1].split('"""')[0])
    page.goto(U+'#/tareas'); page.reload(); page.wait_for_timeout(3500)
    ts=page.evaluate(TAREAS)
    proys=page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const ps=await D.coleccion('tareas','proyectos').listar();const ts=await D.coleccion('tareas','tareas').listar();return ts.filter(t=>t.origen).map(t=>ps.find(p=>p.id===t.proyectoId)?.nombre)}""")
    chk(proys and all(x=='Finanzas' for x in proys), f'Finanzas en su proyecto {proys}')
    # calendario
    r=page.evaluate(FAKE,1); print(r)
    reu=[x for x in r if x['titulo']=='Reunión de stock']
    chk(reu and reu[0]['area']=='Trabajo' and reu[0]['proy']=='' and reu[0]['hora']=='10:30' and reu[0]['dur']==60 and not reu[0]['aviso'], f'reunión en Trabajo {reu}')
    chk('meet.google.com' in reu[0]['notas'] and 'Sala 2' in reu[0]['notas'], 'notas con meet y lugar')
    chk(not any(x['titulo']=='Reunión rechazada' for x in r), 'rechazada no llega')
    fer=[x for x in r if x['titulo'].startswith('Feriado')]
    chk(len(fer)==2 and all(x['aviso'] and x['proy']=='Feriados' and x['inicio']=='' for x in fer), f'feriados todo el año {fer}')
    cum=[x for x in r if x['titulo']=='Cumple de Juan']
    chk(cum and cum[0]['aviso'] and cum[0]['proy']=='Eventos', 'personal como aviso en Eventos')
    chk(not any('contacts' in x['clave'] for x in r), 'cumpleaños por defecto no')
    # notas propias en r4, después se cancelan r3 y r4
    page.evaluate("""async()=>{const D=await import('/js/core/datos.js');const c=D.coleccion('tareas','tareas');const t=(await c.listar()).find(x=>x.titulo==='Reunión con notas');await c.actualizar(t.id,{notas:t.notas+'mis apuntes'});}""")
    r=page.evaluate(FAKE,3)
    chk(not any(x['titulo']=='Reunión que se cancela' for x in r), 'cancelada sin nada tuyo se borra')
    chk(any(x['titulo']=='Reunión con notas (cancelada)' and 'mis apuntes' in x['notas'] for x in r), 'cancelada con notas queda marcada')
    # vista Sistemas: gris, proyectos
    page.goto(U+'#/tareas'); page.wait_for_timeout(900)
    chk(page.locator('.tr-nodo-area.tr-nodo-sistema').count()==1, 'Sistemas gris en Inicio')
    nombres=page.locator('.tr-arbol .tr-nodo-area .tr-nodo-nombre').all_inner_texts(); chk(nombres[-1]=='Sistemas', f'Sistemas al final {nombres}')
    # plegar área en Inicio
    n0=page.locator('.tr-nodo-proyecto.tr-nodo-sistema').count()
    page.locator('.tr-nodo-area.tr-nodo-sistema .tr-plegar').click(); page.wait_for_timeout(600)
    chk(n0==3 and page.locator('.tr-nodo-proyecto.tr-nodo-sistema').count()==0, f'plegar área en Inicio {n0}')
    page.reload(); page.wait_for_timeout(1200)
    chk(page.locator('.tr-nodo-proyecto.tr-nodo-sistema').count()==0, 'queda plegada')
    page.locator('.tr-nodo-area.tr-nodo-sistema .tr-plegar').click(); page.wait_for_timeout(600)
    # ocultar Finanzas
    page.locator('.tr-nodo-area.tr-nodo-sistema').click(); page.wait_for_timeout(900)
    chk(page.locator('.tr-vista-sistema').count()==1, 'vista en gris')
    fin=page.locator('.tr-proyectos > li:has(.tr-proyecto-nombre:has-text("Finanzas"))')
    fin.locator('button[aria-label="Opciones de Finanzas"]').click(); page.wait_for_timeout(300)
    page.click('.tr-menu-item:has-text("Ocultar de Hoy e Inicio")'); page.wait_for_timeout(300)
    chk(page.locator('dialog[open] .tr-opcion.activa').inner_text().startswith('1 día'), 'por defecto 1 día')
    page.screenshot(path=S+f't014_ocultar_{w}.png')
    page.click('dialog[open] button:has-text("Ocultar")'); page.wait_for_timeout(900)
    chk(page.locator('.tr-chip-oculto').count()==1 and 'mañana' in page.locator('.tr-chip-oculto').inner_text(), 'chip oculto hasta mañana')
    page.screenshot(path=S+f't014_sis_{w}.png', full_page=True)
    page.goto(U+'#/tareas/hoy'); page.wait_for_timeout(900)
    chk(page.locator('.tr-titulo:has-text("Pagar Alquiler")').count()==0, 'oculto de Hoy')
    page.goto(U+'#/tareas'); page.wait_for_timeout(900)
    chk(page.locator('.tr-nodo.oculto:has-text("Finanzas")').count()==1, 'tachado en Inicio')
    page.screenshot(path=S+f't014_inicio_{w}.png', full_page=True)
    page.locator('.tr-nodo-area.tr-nodo-sistema').click(); page.wait_for_timeout(900)
    page.click('.tr-chip-oculto button'); page.wait_for_timeout(800)
    chk(page.locator('.tr-chip-oculto').count()==0, 'mostrar ahora')
    # plegar proyecto y reordenar
    page.locator('.tr-proyectos > li:has-text("Feriados") .tr-proyecto-cab .tr-plegar').click(); page.wait_for_timeout(700)
    chk(page.locator('.tr-proyectos > li.plegado:has-text("Feriados")').count()==1, 'proyecto plegado')
    orden0=page.locator('.tr-proyectos > li .tr-proyecto-nombre > span:not(.tr-grupo-n):not(.icono)').all_inner_texts()
    page.locator('.tr-proyectos > li').first.locator('.tr-proyecto-cab .tr-asa').focus(); page.keyboard.press('ArrowDown'); page.wait_for_timeout(900)
    orden1=page.locator('.tr-proyectos > li .tr-proyecto-nombre > span:not(.tr-grupo-n):not(.icono)').all_inner_texts(); print(orden0, orden1)
    chk(orden0[0] and orden1[0]==orden0[1] and orden1[1]==orden0[0], 'reordenar proyectos')
    # config calendarios
    page.goto(U+'#/tareas'); page.wait_for_timeout(700)
    page.click('button[aria-label="Configurar Tareas"]'); page.wait_for_timeout(600)
    chk(page.locator('dialog[open] h3:has-text("Google Calendar")').count()==1, 'sección Google Calendar')
    page.screenshot(path=S+f't014_cfg_{w}.png', full_page=True)
    chk(not err, f'err {err}')
    cx.close()
print(ok,'ok',len(fallas),'fallas')
