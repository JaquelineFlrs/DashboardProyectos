// Prioridades por propietario (historia x propietario)
window.uiPrioridades = (function(){
  let rows = [];          // dataset actual del propietario
  let owner = '';         // propietario seleccionado

  function rowTpl(r, idx){
    const prio = (r.prioridad==null? '' : r.prioridad);
    return `
      <tr class="p-row" data-hist="${r.id_historia}" draggable="true">
        <td class="td w-16">
          <input class="input p-num" style="width:64px" value="${prio}" placeholder="${idx+1}">
        </td>
        <td class="td">${r.historia}</td>
        <td class="td">${r.proyecto}</td>
        <td class="td">${Number(r.horas_pendientes||0).toFixed(0)}</td>
        <td class="td">
          <button class="btn btn-up" title="Arriba">↑</button>
          <button class="btn btn-down" title="Abajo">↓</button>
        </td>
      </tr>
    `;
  }

  function paint(){
    $('#tbody-prioridades').html(rows.map((r,i)=>rowTpl(r,i)).join(''));
  }

  function reorder(fromIdx, toIdx){
    if(toIdx<0 || toIdx>=rows.length || fromIdx===toIdx) return;
    const [item] = rows.splice(fromIdx,1);
    rows.splice(toIdx,0,item);
    paint();
  }

  async function loadOwners(idSprint){
    // lista de propietarios disponibles en base
    const data = await api.prioridadesList(idSprint, null);
    const owners = Array.from(new Set(data.map(r=>r.propietario).filter(Boolean))).sort();
    $('#fp-owner').html('<option value="">Selecciona propietario</option>'+owners.map(o=>`<option>${o}</option>`).join(''));
  }

  async function loadList(){
    const id = Number(localStorage.getItem('sprint_activo')||0);
    if(!id || !owner){ $('#tbody-prioridades').html('<tr><td class="td" colspan="5">Selecciona un propietario.</td></tr>'); return; }
    rows = await api.prioridadesList(id, owner);
    paint();
  }

  function autonumerar(){
    // Si no hay prioridad, usar índice; si hay, respeta orden actual de filas
    rows.forEach((r,i)=> r.prioridad = i+1);
    paint();
  }

  async function sync(){
    const id = Number(localStorage.getItem('sprint_activo')||0);
    if(!id) return alert('Selecciona un sprint.');
    await api.prioridadesSync(id);
    await loadOwners(id);
    await loadList();
  }

  async function save(){
    const id = Number(localStorage.getItem('sprint_activo')||0);
    if(!id || !owner) return alert('Selecciona sprint y propietario.');

    // leer prioridades del DOM (permite que el usuario edite número)
    const items = [];
    $('#tbody-prioridades tr').each(function(idx){
      const id_hist = Number($(this).data('hist'));
      const prio = parseInt($(this).find('.p-num').val() || (idx+1), 10);
      items.push({ id_historia: id_hist, prioridad: prio });
    });

    await api.prioridadesSetOrder(id, owner, items);
    alert('Prioridades guardadas.');
    await loadList();
  }

  function bind(){
    // propietario
    $('#fp-owner').on('change', function(){ owner = $(this).val(); loadList(); });

    // botones globales
    $('#btn-p-sync').on('click', sync);
    $('#btn-p-auto').on('click', autonumerar);
    $('#btn-p-save').on('click', save);

    // mover ↑/↓
    $(document).on('click', '.btn-up', function(){
      const idx = $(this).closest('tr').index();
      reorder(idx, idx-1);
    });
    $(document).on('click', '.btn-down', function(){
      const idx = $(this).closest('tr').index();
      reorder(idx, idx+1);
    });

    // Drag & Drop
    let dragIdx = -1;
    $(document).on('dragstart', '.p-row', function(e){
      dragIdx = $(this).index();
      e.originalEvent.dataTransfer.effectAllowed = 'move';
      $(this).addClass('opacity-50');
    });
    $(document).on('dragend', '.p-row', function(){
      $('.p-row').removeClass('opacity-50');
      dragIdx = -1;
    });
    $(document).on('dragover', '.p-row', function(e){ e.preventDefault(); });
    $(document).on('drop', '.p-row', function(e){
      e.preventDefault();
      const toIdx = $(this).index();
      reorder(dragIdx, toIdx);
    });
  }

  async function init(){
    bind();
    const id = Number(localStorage.getItem('sprint_activo')||0);
    if(id) await loadOwners(id);
  }

  return { init, loadList };
})();
