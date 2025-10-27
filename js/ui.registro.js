// ui.registro.js
// Crear sprint y manejar cargas iniciales
window.uiRegistro = (function(){
  let archivos = { historias:null, subtareas:null };

  function bind(){
    // Crear sprint
    $('#form-sprint').on('submit', async (e)=>{
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget).entries());
      try{
        const id = await api.crearSprint(f.nombre, f.inicio, f.fin);
        // Activa de inmediato en BD (garantiza único activo)
        if (api.activarSprint) await api.activarSprint(id);

        // Refresca badge leyendo de BD
        if (api.getSprintActivo) {
          const activo = await api.getSprintActivo();
          if (activo?.id) {
            $('#badge-sprint').text(`${activo.nombre} (${activo.fecha_inicio} → ${activo.fecha_fin})`);
          } else {
            $('#badge-sprint').text('Sin seleccionar');
          }
        }

        await renderSprints();
        if (window.uiDashboard?.render) await uiDashboard.render();
        alert('Sprint creado y activado.');
      }catch(err){ alert(err.message||err); }
    });

    // Selección de archivos
    $('#csv-historias').on('change', e => archivos.historias = e.target.files[0] || null);
    $('#csv-subtareas').on('change', e => archivos.subtareas = e.target.files[0] || null);

    // Carga inicial CSV → BD
    $('#btn-cargar-inicial').on('click', async ()=>{
      try{
        if (!api.getActiveSprintId) return alert('Primero crea/selecciona un sprint.');
        const id = await api.getActiveSprintId();
        if(!id) return alert('Primero crea/selecciona un sprint.');
        if(!archivos.historias || !archivos.subtareas) return alert('Selecciona ambos CSV.');

        const histRows = csvmap.mapHistorias(await csvmap.parse(archivos.historias));
        const subtRows = csvmap.mapSubtareas(await csvmap.parse(archivos.subtareas));
        await api.upsertHistorias(id, histRows);
        await api.upsertSubtareas(id, subtRows);

        if (window.uiDashboard?.render) await uiDashboard.render();
        alert('Carga inicial completa.');
      }catch(err){ alert(err.message||err); }
    });
  }

  // Renderizar lista de sprints y permitir activar/eliminar
  async function renderSprints(){
    // ID activo desde BD
    const activoId = (api.getActiveSprintId ? await api.getActiveSprintId() : 0) || 0;

    // Refresca badge con detalle del activo
    if (api.getSprintActivo) {
      try {
        const s = await api.getSprintActivo();
        if (s?.id) {
          $('#badge-sprint').text(`${s.nombre} (${s.fecha_inicio} → ${s.fecha_fin})`);
        } else {
          $('#badge-sprint').text('Sin seleccionar');
        }
      } catch {
        $('#badge-sprint').text('Sin seleccionar');
      }
    }

    const list = await api.listarSprints();
    const $el = $('#lista-sprints').empty();

    list.forEach(sp => {
      const active = sp.id === activoId ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50';
      const item = $(`
        <div class="flex items-center gap-3 p-3 rounded-lg border ${active}">
          <div class="flex-1">
            <div class="font-medium">${sp.nombre}</div>
            <div class="text-xs text-slate-500">${sp.fecha_inicio} → ${sp.fecha_fin}</div>
          </div>
          <button class="btn btn-primary btn-activar"><i class="fa-solid fa-check mr-1"></i>Activar</button>
          <button class="btn btn-eliminar text-red-600" style="border:1px solid #fecaca; background:#fff5f5; border-radius:999px; padding:10px 16px;"><i class="fa-solid fa-trash mr-1"></i>Eliminar</button>
        </div>
      `);

      // Activar sprint en BD (único activo)
      item.find('.btn-activar').on('click', async ()=>{
        try{
          await api.activarSprint(sp.id);
          await renderSprints();
          if (window.uiDashboard?.render) await uiDashboard.render();
        }catch(err){ alert(err.message||err); }
      });

      // Eliminar sprint
      item.find('.btn-eliminar').on('click', async ()=>{
        try{
          if(confirm('¿Eliminar el sprint y todo su contenido?')){
            await api.eliminarSprint(sp.id);
            await renderSprints();
            if (window.uiDashboard?.render) await uiDashboard.render();
          }
        }catch(err){ alert(err.message||err); }
      });

      $el.append(item);
    });
  }

  async function init(){ bind(); await renderSprints(); }
  return { init, renderSprints };
})();
