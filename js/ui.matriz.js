// ui.matriz.js
// Matriz de Eisenhower por propietario (drag & drop + contadores)
window.uiMatriz = (function(){
  let historias = [];
  let owner = '';
  let prevSprintId = 0;

  // Helpers
  function toNumber(x){
    const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  function normalizeQuadrant(q){
    if (q == null) return 'q4';
    const s = String(q).trim().toLowerCase();
    if (s.startsWith('q')) {
      const d = parseInt(s.slice(1), 10);
      return ['q1','q2','q3','q4'][Math.max(0, Math.min(3, (d||4)-1))];
    }
    const d = parseInt(s, 10);
    if ([1,2,3,4].includes(d)) return `q${d}`;
    return 'q4';
  }

  async function cargar(){
    if (!api.getActiveSprintId) {
      $('.dropzone').empty();
      ['q1','q2','q3','q4'].forEach(q=>$('#'+q+'-meta').text('0 tareas · 0 h'));
      return;
    }
    const id = await api.getActiveSprintId();

    // Badge con el activo
    if (api.getSprintActivo) {
      try{
        const activo = await api.getSprintActivo();
        if (activo?.id) {
          $('#badge-sprint').text(`${activo.nombre} (${activo.fecha_inicio} → ${activo.fecha_fin})`);
        } else {
          $('#badge-sprint').text('Sin seleccionar');
        }
      }catch{}
    }

    if (!id) {
      $('.dropzone').empty();
      ['q1','q2','q3','q4'].forEach(q=>$('#'+q+'-meta').text('0 tareas · 0 h'));
      return;
    }

    // Si cambió el sprint, forzar recarga de owners
    if (prevSprintId !== id) {
      $('#mx-owner').data('loaded', false).val('');
      owner = '';
      prevSprintId = id;
    }

    // Llenar owners 1 sola vez por sprint
    if (!$('#mx-owner').data('loaded')) {
      const owners = (await (api.matrizOwners ? api.matrizOwners(id) : api.prioridadesList(id))) || [];
      $('#mx-owner')
        .html('<option value="">Todos (propietario)</option>' + owners.map(o=>`<option>${o||''}</option>`).join(''))
        .data('loaded', true);
    }

    historias = await api.matrizList(id, owner || null);
    render();
  }

  function render(){
    $('.dropzone').empty();
    const agg = { q1:{n:0,h:0}, q2:{n:0,h:0}, q3:{n:0,h:0}, q4:{n:0,h:0} };

    (historias||[]).forEach(h=>{
      const hp  = toNumber(h.horas_pendientes);
      const qId = normalizeQuadrant(h.cuadrante);

      const card = $(`
        <div class="bg-white rounded-lg shadow-sm p-2 mb-2 cursor-move"
             draggable="true"
             data-id="${h.id_historia}"
             data-prop="${h.propietario||''}">
          <div class="font-medium truncate">${h.nombre_tarea||''}</div>
          <div class="text-xs text-gray-500 truncate">${h.proyecto||''}</div>
          <div class="text-xs">${hp.toFixed(0)} h</div>
        </div>
      `);

      $(`#${qId} .dropzone`).append(card);

      agg[qId] ??= { n:0, h:0 };
      agg[qId].n += 1;
      agg[qId].h += hp;
    });

    $('#q1-meta').text(`${agg.q1.n} tareas · ${agg.q1.h.toFixed(0)} h`).attr('class','badge soft-red');
    $('#q2-meta').text(`${agg.q2.n} tareas · ${agg.q2.h.toFixed(0)} h`).attr('class','badge soft-yellow');
    $('#q3-meta').text(`${agg.q3.n} tareas · ${agg.q3.h.toFixed(0)} h`).attr('class','badge soft-blue');
    $('#q4-meta').text(`${agg.q4.n} tareas · ${agg.q4.h.toFixed(0)} h`).attr('class','badge soft-gray');
  }

  function bind(){
    // Drag & drop
    $(document).on('dragstart','.dropzone > div',function(e){
      e.originalEvent.dataTransfer.setData('id', $(this).data('id'));
      e.originalEvent.dataTransfer.setData('prop', $(this).data('prop')||'');
    });
    $(document).on('dragover','.dropzone',function(e){ e.preventDefault(); });
    $(document).on('drop','.dropzone', async function(e){
      e.preventDefault();
      const idHist  = Number(e.originalEvent.dataTransfer.getData('id'));
      const quadDom = $(this).closest('.quadrant').attr('id'); // 'q1'..'q4'
      const qStr    = normalizeQuadrant(quadDom);

      try{
        await api.matrizSetQuadrant(idHist, qStr);
        await cargar();
      }catch(err){ alert(err?.message||err); }
    });

    // Filtro por propietario
    $('#mx-owner').on('change', function(){
      owner = $(this).val() || '';
      cargar();
    });
  }

  async function init(){ bind(); await cargar(); }
  return { init, cargar };
})();
