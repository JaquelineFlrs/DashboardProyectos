// ui.registro.js
// Crear sprint y manejar cargas iniciales (con anti-doble submit y re-bind seguro)
window.uiRegistro = (function(){
  let archivos = { historias:null, subtareas:null };
  let creating = false;      // 🔐 anti-doble submit
  let bound = false;         // 🔐 evita re-bind múltiple

  function bind(){
    if (bound) return;       // evita volver a registrar eventos
    bound = true;

    // -------- Form submit (crear sprint) ----------
    $('#form-sprint').off('submit.uiRegistro');
    $('#form-sprint').on('submit.uiRegistro', async (e)=>{
      e.preventDefault();
      if (creating) return;  // si ya está creando, ignora
      creating = true;

      const $btn = $('#form-sprint [type=submit]').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
      const f = Object.fromEntries(new FormData(e.currentTarget).entries());
      try{
        const id = await api.crearSprint(f.nombre, f.inicio, f.fin);
        if (api.activarSprint) await api.activarSprint(id); // garantiza único activo

        // Refresca badge leyendo de BD
        if (api.getSprintActivo) {
          try {
            const activo = await api.getSprintActivo();
            $('#badge-sprint').text(
              activo?.id ? `${activo.nombre} (${activo.fecha_inicio} → ${activo.fecha_fin})` : 'Sin seleccionar'
            );
          } catch {
            $('#badge-sprint').text('Sin seleccionar');
          }
        }

        await renderSprints();
        if (window.uiDashboard?.render) await uiDashboard.render();
        alert('Sprint creado y activado.');
      }catch(err){
        console.error('[Crear sprint] Error:', err);
        alert(err?.message || String(err));
      }finally{
        creating = false;
        $btn.prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
      }
    });

    // -------- Inputs de archivos ----------
    $('#csv-historias').off('change.uiRegistro').on('change.uiRegistro', e => {
      archivos.historias = e.target.files[0] || null;
    });
    $('#csv-subtareas').off('change.uiRegistro').on('change.uiRegistro', e => {
      archivos.subtareas = e.target.files[0] || null;
    });

    // -------- Carga inicial CSV → BD ----------
    $('#btn-cargar-inicial').off('click.uiRegistro').on('click.uiRegistro', async ()=>{
      try{
        if (!api.getActiveSprintId) return alert('Primero crea/selecciona un sprint.');
        if (!window.csvmap) return alert('csvmap.js no está cargado.');
        const id = await api.getActiveSprintId();
        if(!id) return alert('Primero crea/selecciona un sprint.');
        if(!archivos.historias || !archivos.subtareas) return alert('Selecciona ambos CSV.');

        const histRowsRaw = await csvmap.parse(archivos.historias);
        const subtRowsRaw = await csvmap.parse(archivos.subtareas);

        const histRows = csvmap.mapHistorias(histRowsRaw);
        const subtRows = csvmap.mapSubtareas(subtRowsRaw);

        // Opcional: filtra registros sin id_externo para evitar basura
        const histRowsClean = histRows.filter(h => (h.id_externo || '').trim() !== '');
        const subtRowsClean = subtRows.filter(s => (s.id_externo || '').trim() !== '');

        await api.upsertHistorias(id, histRowsClean);
        await api.upsertSubtareas(id, subtRowsClean);

        if (window.uiDashboard?.render) await uiDashboard.render();
        alert('Carga inicial completa.');
      }catch(err){
        console.error('[Carga inicial] Error:', err);
        alert(err?.message || String(err));
      }
    });
  }

  // -------- Renderizar lista de sprints y permitir activar/eliminar ----------
  async function renderSprints(){
    // ID activo desde BD
    const activoId = (api.getActiveSprintId ? await api.getActiveSprintId() : 0) || 0;

    // Refresca badge con detalle del activo
    if (api.getSprintActivo) {
      try {
        const s = await api.getSprintActivo();
        $('#badge-sprint').text(
          s?.id ? `${s.nombre} (${s.fecha_inicio} → ${s.fecha_fin})` : 'Sin seleccionar'
        );
      } catch {
        $('#badge-sprint').text('Sin seleccionar');
      }
    }

    const list = await api.listarSprints();
    const $el = $('#lista-sprints').empty();

    list.forEach(sp => {
      const active = sp.id === activoId ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50';
      const $item = $(`
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
      $item.find('.btn-activar').on('click', async ()=>{
        try{
          await api.activarSprint(sp.id);
          await renderSprints();
          if (window.uiDashboard?.render) await uiDashboard.render();
        }catch(err){ alert(err.message||err); }
      });

      // Eliminar sprint
      $item.find('.btn-eliminar').on('click', async ()=>{
        try{
          if(confirm('¿Eliminar el sprint y todo su contenido?')){
            await api.eliminarSprint(sp.id);
            await renderSprints();
            if (window.uiDashboard?.render) await uiDashboard.render();
          }
        }catch(err){ alert(err.message||err); }
      });

      $el.append($item);
    });
  }

  async function init(){ bind(); await renderSprints(); }
  return { init, renderSprints };
})();
