// js/ui.historias.js
// Historias del sprint: DataTable-like + realtime + review/obs + modal
window.uiHistorias = (function(){
  let data = [];       // dataset completo
  let filtered = [];   // tras filtros
  let ownersList = []; // (ya no se usa como filtro, se mantiene por si se ocupa en otros módulos)
  let sort = { key:'nombre_lista_tareas', dir:'asc' };
  let page = 1, size = 10;
  let rtChannel;       // realtime channel

  function pctAvance(row){
    const tot  = Number(row.horas_totales||0);
    const done = Number(row.horas_terminadas||0);
    return tot ? Math.round(100*done/tot) : 0;
  }

  // Icono según reglas DEV/QA
  function statusIcon(row){
    const dev0 = Number(row.dev_pend_horas||0) === 0;
    const qa0  = Number(row.qa_pend_horas||0)  === 0;
    if(dev0 && qa0)  return '<i class="fa-solid fa-arrow-up-right-from-square text-green-600" title="DEV=0 & QA=0"></i>';
    if(dev0 && !qa0) return '<i class="fa-solid fa-arrow-trend-up" style="color:#ec4899" title="DEV=0 & QA>0"></i>';
    if(!dev0 && qa0) return '<i class="fa-solid fa-arrow-trend-up text-blue-600" title="QA=0 & DEV>0"></i>';
    return '<i class="fa-solid fa-circle-exclamation text-red-600" title="DEV>0 & QA>0"></i>';
  }

  // Tooltip con Duración / DEV / QA (las columnas se eliminaron)
  function infoTooltip(row){
    const dur = Number(row.duracion_historia||0).toFixed(0);
    const dev = Number(row.dev_pend_horas||0).toFixed(0);
    const qa  = Number(row.qa_pend_horas||0).toFixed(0);
    const txt = `Duración: ${dur} h\nDEV pendiente: ${dev} h\nQA pendiente: ${qa} h`;
    // botón minimal azul (solo ícono) para abrir subtareas
    return `
      <div class="ml-2 inline-flex items-center gap-1">
        <button class="btn btn-xs btn-toggle text-blue-600 border border-blue-200 hover:bg-blue-50" title="Ver subtareas">
          <i class="fa-solid fa-caret-down"></i>
        </button>
        <i class="fa-regular fa-circle-question text-blue-500 cursor-help" title="${txt}"></i>
      </div>
    `;
  }

  function reviewCell(row){
    const v = row.review_status || '';
    return `
      <select class="select select-review" data-id="${row.id_historia}" title="Estatus de revisión">
        <option value="" ${v===''?'selected':''}>—</option>
        <option value="ACEPTADA" ${v==='ACEPTADA'?'selected':''}>Aceptada</option>
        <option value="RECHAZADA" ${v==='RECHAZADA'?'selected':''}>Rechazada</option>
      </select>
      <span class="save-ok ml-1 hidden text-green-600"><i class="fa-solid fa-check"></i></span>
    `;
  }

  function obsCell(row){
    const v = row.review_obs || '';
    return `
      <div class="flex items-center">
        <input class="input input-obs" data-id="${row.id_historia}" placeholder="Escribe observaciones..." value="${(v||'').replace(/"/g,'&quot;')}" />
        <span class="save-ok ml-1 hidden text-green-600"><i class="fa-solid fa-check"></i></span>
      </div>
    `;
  }

  function descBtn(row){
    return `<button class="btn btn-xs btn-desc text-indigo-600 border border-indigo-200 hover:bg-indigo-50" title="Ver descripción" data-id="${row.id_historia}"><i class="fa-solid fa-circle-info"></i></button>`;
  }

   function historiaRow(h){
  const pct = pctAvance(h);
  const badge = pct>=80 ? 'bg-green-100 text-green-700'
              : (pct>=40 ? 'bg-amber-100 text-amber-700'
                         : 'bg-red-100 text-red-700');

  return `
    <tr class="row-historia" data-id="${h.id_historia}">
      <td class="td text-center">${h.id_historia ?? ''}</td>
      <td class="td">
        <span class="font-medium">${h.nombre_tarea || ''}</span>
        ${infoTooltip(h)}
      </td>
      <td class="td">${h.nombre_lista_tareas || ''}</td>
      <td class="td">${h.estado_historia || ''}</td>
      <td class="td">
        ${h.subtareas_total ?? 0}
        <span class="text-slate-400">(${h.subtareas_terminadas ?? 0} done)</span>
      </td>
      <td class="td"><span class="px-2 py-1 rounded ${badge}">${pct}%</span></td>
      <td class="td">${reviewCell(h)}</td>
      <td class="td">${obsCell(h)}</td>
      <td class="td text-center">${descBtn(h)}</td>
    </tr>
    <tr class="row-subtareas hidden" data-for="${h.id_historia}">
      <td class="td bg-slate-50" colspan="9">
        <div class="overflow-auto">
          <table class="table">
            <thead><tr>
              <th class="th">Subtarea</th>
              <th class="th">Propietario</th>
              <th class="th">Duración</th>
              <th class="th">Estado</th>
            </tr></thead>
            <tbody class="tbody-subt">
              <tr><td class="td" colspan="4">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}


  function applyFilters(){
    const q    = $('#fh-q').val()?.toLowerCase()||'';
    const proj = $('#fh-proyecto').val();
    const est  = $('#fh-estado').val();

    filtered = data.slice();

    if (proj) filtered = filtered.filter(h => (h.nombre_lista_tareas||'') === proj);
    if (est)  filtered = filtered.filter(h => (h.estado_historia||'') === est);

    // persona se eliminó del UI, así que no se filtra por persona

    if (q) filtered = filtered.filter(h =>
      (`${h.nombre_tarea||''} ${h.nombre_lista_tareas||''} ${h.descripcion||''}`).toLowerCase().includes(q)
    );

    sortAndRender();
  }

  function sortAndRender(){
    if(sort.key){
      filtered.sort((a,b)=>{
        let va=a[sort.key], vb=b[sort.key];
        if(['horas_totales','horas_terminadas','horas_pendientes','dev_pend_horas','qa_pend_horas','subtareas_total','duracion_historia'].includes(sort.key)){
          va = Number(va||0); vb = Number(vb||0);
        } else {
          va = (va??'').toString().toLowerCase();
          vb = (vb??'').toString().toLowerCase();
        }
        if(va>vb) return sort.dir==='asc'?1:-1;
        if(va<vb) return sort.dir==='asc'?-1:1;
        return 0;
      });
    }

    size = parseInt($('#h-size').val()||size,10);
    const total   = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if(page>maxPage) page = maxPage;
    const start = (page-1)*size;
    const slice = filtered.slice(start, start+size);

    $('#tbody-historias').html(slice.map(historiaRow).join('') || '<tr><td class="td" colspan="9">Sin historias.</td></tr>');
    $('#h-info').text(`Mostrando ${total?start+1:0}–${start+slice.length} de ${total}`);
    renderPagination(maxPage);
  }

  function renderPagination(maxPage){
    const $pag = $('#h-pag').empty();
    const btn = (txt, dis, id) => `<button class="dt-btn" ${dis?'disabled':''} data-act="${id}">${txt}</button>`;
    $pag.append(btn('«', page<=1, 'first'));
    $pag.append(btn('‹', page<=1, 'prev'));
    const spread=2, from=Math.max(1,page-spread), to=Math.min(maxPage,page+spread);
    for(let i=from;i<=to;i++) $pag.append(`<button class="dt-page ${i===page?'active':''}" data-page="${i}">${i}</button>`);
    $pag.append(btn('›', page>=maxPage, 'next'));
    $pag.append(btn('»', page>=maxPage, 'last'));
  }

  async function cargar(){
    if (!window.api?.getActiveSprintId) {
      $('#tbody-historias').html('<tr><td class="td" colspan="9">Selecciona un sprint.</td></tr>');
      $('#h-info').text(''); 
      $('#h-pag').html('');
      return;
    }

    const id = await api.getActiveSprintId();
    if (!id) {
      $('#tbody-historias').html('<tr><td class="td" colspan="9">Selecciona un sprint.</td></tr>');
      $('#h-info').text(''); 
      $('#h-pag').html('');
      return;
    }

    const [rows, owners] = await Promise.all([
      api.historias(id),
      api.historiasPersonas ? api.historiasPersonas(id) : Promise.resolve([])
    ]);

    data = rows || [];
    ownersList = Array.isArray(owners) ? owners : [];

    // filtros dinámicos (sin personas)
    const proyectos = Array.from(new Set(data.map(d => d.nombre_lista_tareas).filter(Boolean))).sort();
    $('#fh-proyecto').html('<option value="">Todos (proyecto)</option>' + proyectos.map(p => `<option>${p}</option>`).join(''));

    const estados = Array.from(new Set(data.map(d => d.estado_historia).filter(Boolean))).sort();
    $('#fh-estado').html('<option value="">Todos (estado)</option>' + estados.map(p => `<option>${p}</option>`).join(''));

    page = 1; 
    applyFilters();
  }

  // --- Realtime: sin botón recargar
  async function subscribeRealtime(){
    if(rtChannel) { try { sb.removeChannel(rtChannel); } catch(_){} rtChannel=null; }
    if (!window.api?.getActiveSprintId) return;
    const id = await api.getActiveSprintId();
    if(!id) return;

    rtChannel = sb.channel('rt-historias')
      .on('postgres_changes',{ event:'*', schema:'public', table:'subtarea' }, async ()=>{ await cargar(); })
      .on('postgres_changes',{ event:'*', schema:'public', table:'historia' }, async ()=>{ await cargar(); })
      .subscribe();
  }

  // --- Exportar: CSV (Papa.unparse) con columnas pedidas (+ % Avance antes de Observaciones)
  function exportar(){
    const rows = filtered.map(r => ({
      "Nombre de la tarea": r.nombre_tarea || '',
      "Nombre de la lista de tareas": r.nombre_lista_tareas || '',
      "Review": r.review_status || '',
      "% Avance": `${pctAvance(r)}%`,
      "Observaciones": r.review_obs || ''
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'historias_review.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // debounce para observaciones + feedback ✓
  const debouncers = new Map();
  function markSaved($el){
    const $ok = $el.closest('td').find('.save-ok');
    $ok.removeClass('hidden');
    setTimeout(()=> $ok.addClass('hidden'), 1200);
  }
  function debounceSave(id, val, $el){
    if(debouncers.has(id)) clearTimeout(debouncers.get(id));
    const t = setTimeout(async ()=>{
      try{
        await api.setHistoriaObs(id, val);
        if($el) markSaved($el);
      }catch(e){ console.error(e); alert(e.message||e); }
      debouncers.delete(id);
    }, 600);
    debouncers.set(id, t);
  }

  // ---- Modal: inyecta si no existe (ahora con campo Observaciones)
  function ensureModal(){
    if($('#modal-desc').length) return;
    $('body').append(`
      <div id="modal-desc" class="fixed inset-0 bg-black/40 hidden items-center justify-center z-50">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-semibold"><i class="fa-solid fa-circle-info text-indigo-600 mr-2"></i>Descripción de la historia</h3>
            <button class="btn btn-sm" id="md-close"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="text-sm text-slate-600 mb-3" id="md-historia"></div>
          <div class="border rounded-lg p-3 max-h-[50vh] overflow-auto" id="md-descripcion"></div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 items-start">
            <label class="flex items-center gap-2">
              <span class="text-sm">Review:</span>
              <select id="md-review" class="select">
                <option value="">—</option>
                <option value="ACEPTADA">Aceptada</option>
                <option value="RECHAZADA">Rechazada</option>
              </select>
            </label>
            <div class="md:col-span-2">
              <div class="text-sm text-slate-600 mb-1">Observaciones</div>
              <textarea id="md-obs" class="input w-full min-h-[80px]" placeholder="Escribe observaciones..."></textarea>
            </div>
          </div>

          <div class="flex items-center gap-3 mt-4">
            <button id="md-save" class="btn btn-primary">
              <i class="fa-solid fa-floppy-disk mr-1"></i>Guardar
            </button>
            <span id="md-save-ok" class="text-green-600 hidden"><i class="fa-solid fa-check"></i> Guardado</span>
          </div>
        </div>
      </div>
    `);
  }

  function bind(){
    // filtros / búsqueda / page size
    $(document).off('change', '#fh-proyecto,#fh-estado')
      .on('change', '#fh-proyecto,#fh-estado', function(){ page=1; applyFilters(); });
    $(document).off('input', '#fh-q').on('input', '#fh-q', function(){ page=1; applyFilters(); });
    $(document).off('change', '#h-size').on('change', '#h-size', function(){ page=1; sortAndRender(); });

    // paginación
    $(document).off('click', '.dt-page').on('click', '.dt-page', function(){ page=parseInt($(this).data('page'),10); sortAndRender(); });
    $(document).off('click', '.dt-btn').on('click', '.dt-btn', function(){
      const act=$(this).data('act'); const total=filtered.length; const maxPage=Math.max(1,Math.ceil(total/size));
      if(act==='first') page=1;
      if(act==='prev'&&page>1) page--;
      if(act==='next'&&page<maxPage) page++;
      if(act==='last') page=maxPage;
      sortAndRender();
    });

    // orden
    $(document).off('click', '#view-historias thead th.sortable')
      .on('click', '#view-historias thead th.sortable', function(){
        const key = $(this).data('key');
        if(sort.key===key) sort.dir = (sort.dir==='asc'?'desc':'asc'); else { sort.key = key; sort.dir='asc'; }
        sortAndRender();
      });

    // abrir/cerrar detalle (delegado en tbody)
    $(document).off('click', '#tbody-historias .btn-toggle')
      .on('click', '#tbody-historias .btn-toggle', async function(){
        const $row = $(this).closest('.row-historia');
        const idh = Number($row.data('id'));
        const $sub = $(`.row-subtareas[data-for="${idh}"]`);
        $sub.toggleClass('hidden');
        if(!$sub.hasClass('hidden') && !$sub.data('loaded')){
          try{
            const subs = await api.subtareasPorHistoria(idh);
            const trs = (subs||[]).map(s=>`
              <tr>
                <td class="td">${s.nombre_tarea||''}</td>
                <td class="td">${s.propietario||''}</td>
                <td class="td">${Number(s.duracion_horas||0).toFixed(0)}</td>
                <td class="td">${s.estado_pers||''}</td>
              </tr>`).join('');
            $sub.find('.tbody-subt').html(trs || '<tr><td class="td" colspan="4">Sin subtareas.</td></tr>');
            $sub.data('loaded', true);
          }catch(e){
            $sub.find('.tbody-subt').html('<tr><td class="td" colspan="4">Error al cargar subtareas.</td></tr>');
            console.error(e);
          }
        }
      });

    // review (guardado inmediato + ✓)
    $(document).off('change', '.select-review')
      .on('change', '.select-review', async function(){
        const id = Number($(this).data('id'));
        const val = $(this).val() || null;
        try{
          await api.setHistoriaReview(id, val);
          markSaved($(this));
        }catch(e){
          alert(e.message||e);
        }
      });

    // observaciones (guardado en vivo con debounce + ✓)
    $(document).off('input', '.input-obs')
      .on('input', '.input-obs', function(){
        const id = Number($(this).data('id'));
        const val = $(this).val();
        debounceSave(id, val, $(this));
      });

    // modal de descripción (inyecta si hace falta y abre)
    $(document).off('click', '#tbody-historias .btn-desc')
      .on('click', '#tbody-historias .btn-desc', function(){
        ensureModal();
        const id = Number($(this).data('id'));
        const row = data.find(x=>x.id_historia===id);
        if(!row) return;
        $('#md-historia').text(`#${id} · ${row.nombre_tarea||''}`);
        $('#md-descripcion').html((row.descripcion||'').replace(/\n/g,'<br>'));
        $('#md-review').val(row.review_status||'');
        $('#md-obs').val(row.review_obs||'');
        $('#md-save').data('id', id);
        $('#md-save-ok').addClass('hidden');
        $('#modal-desc').removeClass('hidden').addClass('flex');
      });

    // Handlers del modal
    $(document).off('click', '#md-close').on('click', '#md-close', function(){
      $('#modal-desc').addClass('hidden').removeClass('flex');
    });
    $(document).off('click', '#md-save').on('click', '#md-save', async function(){
      const id = Number($(this).data('id'));
      const status = $('#md-review').val() || null;
      const obs    = $('#md-obs').val() || null;
      try{
        // guarda ambos (usa tus APIs actuales)
        await api.setHistoriaReview(id, status);
        await api.setHistoriaObs(id, obs);
        await cargar();
        $('#md-save-ok').removeClass('hidden');
        setTimeout(()=> $('#md-save-ok').addClass('hidden'), 1200);
      }catch(e){ alert(e.message||e); }
    });

    // exportar
    $(document).off('click', '#btn-h-export').on('click', '#btn-h-export', exportar);
  }

  async function init(){
    bind();
    await cargar();
    await subscribeRealtime(); // sin botón recargar
  }

  return { init, cargar };
})();
