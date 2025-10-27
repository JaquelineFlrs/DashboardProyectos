// ui.admin.js
// Tabla de administración con filtros, paginado y ordenamiento (DataTable-like)
window.uiAdmin = (function(){

  let cache = [];           // dataset completo desde la vista
  let filtered = [];        // dataset filtrado
  let page = 1;             // página actual
  let size = 10;            // tamaño de página
  let sort = { key: null, dir: 'asc' }; // estado de ordenamiento

  function rowTpl(r){
    const fecha = r.fecha_terminacion ? new Date(r.fecha_terminacion).toLocaleString() : '';
    return `<tr data-id="${r.id_subtarea}">
      <td class="td">${r.historia||''}</td>
      <td class="td">${r.subtarea||''}</td>
      <td class="td">${r.propietario||''}</td>
      <td class="td">${r.duracion_horas??''}</td>
      <td class="td">${r.estado||''}</td>
      <td class="td">${fecha}</td>
      <td class="td text-center"><input type="checkbox" class="chk-terminado" ${r.terminado?'checked':''}></td>
      <td class="td text-center"><input type="checkbox" class="chk-mostrar" ${r.mostrar?'checked':''}></td>
    </tr>`;
  }

  function renderHeader(){
    const headers = [
      {key:'historia', label:'Historia'},
      {key:'subtarea', label:'Subtarea'},
      {key:'propietario', label:'Propietario'},
      {key:'duracion_horas', label:'Duración'},
      {key:'estado', label:'Estado'},
      {key:'fecha_terminacion', label:'Fecha terminación'},
      {key:'terminado', label:'Terminado'},
      {key:'mostrar', label:'Mostrar'}
    ];
    const $row = $('#tbody-admin').closest('table').find('thead tr').empty();
    headers.forEach(h=>{
      const sortable = (h.key!=='terminado' && h.key!=='mostrar');
      const cls = sortable? 'sortable' : '';
      const th = $(`<th class="th ${cls}" data-key="${h.key}">${h.label}</th>`);
      if(sort.key===h.key) th.addClass(sort.dir==='asc'?'sorted-asc':'sorted-desc');
      $row.append(th);
    });
  }

  function applyFilters(){
    const q = $('#f-q').val()?.toLowerCase()||'';
    const prop = $('#f-prop').val();
    const term = $('#f-term').val();
    const mos = $('#f-mostrar').val();
    filtered = cache.slice();
    if(prop) filtered = filtered.filter(r=> r.propietario===prop);
    if(term!=='') filtered = filtered.filter(r=> String(r.terminado)===term);
    if(mos!=='') filtered = filtered.filter(r=> String(r.mostrar)===mos);
    if(q) filtered = filtered.filter(r => (`${r.historia} ${r.subtarea} ${r.propietario}`).toLowerCase().includes(q));
    sortAndRender();
  }

  function sortAndRender(){
    // ordenar
    if(sort.key){
      filtered.sort((a,b)=> {
        let va = a[sort.key], vb = b[sort.key];
        if(sort.key==='fecha_terminacion'){
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        }
        if(va==null && vb!=null) return -1;
        if(va!=null && vb==null) return 1;
        if(va==null && vb==null) return 0;
        if(va>vb) return sort.dir==='asc'?1:-1;
        if(va<vb) return sort.dir==='asc'? -1:1;
        return 0;
      });
    }
    // paginar
    size = parseInt($('#dt-size').val()||size,10);
    const total = filtered.length;
    const maxPage = Math.max(1, Math.ceil(total/size));
    if(page>maxPage) page = maxPage;
    const start = (page-1)*size;
    const slice = filtered.slice(start, start+size);

    $('#tbody-admin').html(slice.map(rowTpl).join(''));
    $('#dt-info').text(`Mostrando ${total?start+1:0} a ${start+slice.length} de ${total} subtareas`);
    renderHeader();
    renderPagination(maxPage);
  }

  function renderPagination(maxPage){
    const $pag = $('#dt-pag').empty();
    const btn = (txt, dis, id) => `<button class="dt-btn" ${dis?'disabled':''} data-act="${id}">${txt}</button>`;
    $pag.append(btn('«', page<=1, 'first'));
    $pag.append(btn('‹', page<=1, 'prev'));

    const pages = [];
    const spread = 2;
    const from = Math.max(1, page-spread);
    const to = Math.min(maxPage, page+spread);
    for(let i=from;i<=to;i++) pages.push(i);
    pages.forEach(p => {
      $pag.append(`<button class="dt-page ${p===page?'active':''}" data-page="${p}">${p}</button>`);
    });

    $pag.append(btn('›', page>=maxPage, 'next'));
    $pag.append(btn('»', page>=maxPage, 'last'));
  }

  async function cargar(){
    if (!api.getActiveSprintId) {
      $('#tbody-admin').html('');
      $('#dt-info').text('');
      $('#dt-pag').html('');
      return;
    }
    const id = await api.getActiveSprintId();

    // Badge opcional
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

    if(!id){
      $('#tbody-admin').html('');
      $('#dt-info').text('');
      $('#dt-pag').html('');
      return;
    }

    cache = await api.adminSubtareas(id);
    const props = Array.from(new Set(cache.map(r=>r.propietario).filter(Boolean))).sort();
    $('#f-prop').html('<option value="">Todos (propietario)</option>' + props.map(p=>`<option>${p}</option>`).join(''));
    page = 1; applyFilters();
  }

  function bind(){
    // filtros
    $('#btn-recargar-admin,#f-prop,#f-term,#f-mostrar').on('click change', applyFilters);
    $('#f-q').on('input', function(){ page=1; applyFilters(); });

    // page size
    $(document).on('change', '#dt-size', function(){ page=1; size=parseInt($(this).val(),10); sortAndRender(); });

    // paginación
    $(document).on('click', '.dt-page', function(){ page = parseInt($(this).data('page'),10); sortAndRender(); });
    $(document).on('click', '.dt-btn', function(){
      const act = $(this).data('act'); const total = filtered.length; const maxPage = Math.max(1, Math.ceil(total/size));
      if(act==='first') page=1;
      if(act==='prev' && page>1) page--;
      if(act==='next' && page<maxPage) page++;
      if(act==='last') page=maxPage;
      sortAndRender();
    });

    // sort click en thead
    $(document).on('click', 'thead th.sortable', function(){
      const key = $(this).data('key');
      if(sort.key===key) sort.dir = (sort.dir==='asc'?'desc':'asc'); else { sort.key = key; sort.dir = 'asc'; }
      sortAndRender();
    });

    // toggles terminado/mostrar
    $(document).on('change', '.chk-terminado, .chk-mostrar', async function(){
      const $row = $(this).closest('tr');
      const id = Number($row.data('id'));
      const terminado = $row.find('.chk-terminado').prop('checked');
      const mostrar   = $row.find('.chk-mostrar').prop('checked');
      try{
        await api.setFlags(id, terminado, mostrar);

        // Actualiza cache local
        const idx = cache.findIndex(r => Number(r.id_subtarea) === id);
        if (idx >= 0) {
          cache[idx].terminado = terminado;
          cache[idx].mostrar   = mostrar;
        }

        // Puede impactar KPIs/burndown
        if (window.uiDashboard?.render) {
          await uiDashboard.render();
        }
      }catch(err){
        alert(err.message||err);
      }
    });
  }

  async function init(){ bind(); await cargar(); }
  return { init, cargar };
})();
