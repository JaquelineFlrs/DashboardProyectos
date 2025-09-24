// subtareas.js (terminada = 0/1; mostrar = 0/1)
(function () {
  'use strict';
  const PK_COL = 'id';
  const COLS = {
    ID_EXT: 'ID de Tarea',
    NOMBRE: 'Nombre de Tarea',
    PROPIETARIO: 'Propietario',
    DURACION: 'Duración',
    FECHA_TERM: 'Fecha de terminación',
    MOSTRAR: 'Mostrar',         // 0 = mostrar, 1 = ocultar
    TERMINADA: 'terminada'      // 0 = no, 1 = sí
  };

  const STATE = { rows: [], loading: false, lastError: null };
  const $ = (s, r=document)=>r.querySelector(s);
  const esc = (s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getClient = ()=> window.db || window.supabase || (typeof sb!=='undefined'?sb:null);

  const isTerminada = r => Number(r?.[COLS.TERMINADA] ?? 0) === 1;
  const isMarcadaMostrar = r => Number(r?.[COLS.MOSTRAR] ?? 0) === 0;

  function renderHeader(){
    const thead = $('#theadSubSel'); if(!thead) return;
    thead.innerHTML = `
      <tr>
        <th>Terminada</th>
        <th>Mostrar</th>
        <th>ID de Tarea</th>
        <th>Nombre</th>
        <th>Propietario</th>
        <th>Duración</th>
      </tr>`;
  }

  async function fetchSubtareas(){
    STATE.loading=true; STATE.lastError=null;
    const client = getClient(); if(!client){ STATE.loading=false; return []; }
    const selectCols = [
      PK_COL,
      `"${COLS.ID_EXT}"`,
      `"${COLS.NOMBRE}"`,
      `"${COLS.PROPIETARIO}"`,
      `"${COLS.DURACION}"`,
      `"${COLS.FECHA_TERM}"`,
      `"${COLS.MOSTRAR}"`,
      `"${COLS.TERMINADA}"`
    ].join(',');
    const {data,error} = await client.from('SUBTAREAS').select(selectCols).order(PK_COL,{ascending:true});
    STATE.loading=false;
    if(error){ STATE.lastError=error.message||String(error); console.error(error); return []; }
    STATE.rows = Array.isArray(data)?data:[]; window.subtareasRaw=STATE.rows; return STATE.rows;
  }

  async function updateTerminada(idOrExt, checked){
    try{
      const val = checked?1:0;
      const client = getClient(); if(!client) return false;
      let {data,error} = await client.from('SUBTAREAS').update({ [COLS.TERMINADA]: val }).eq(PK_COL, idOrExt).select(PK_COL);
      if(!error && (!data||data.length===0)){
        ({data,error} = await client.from('SUBTAREAS').update({ [COLS.TERMINADA]: val }).eq(COLS.ID_EXT, idOrExt).select(COLS.ID_EXT));
      }
      if(error || !data || data.length===0) return false;
      const r = STATE.rows.find(x=>String(x[PK_COL])===String(idOrExt) || String(x[COLS.ID_EXT])===String(idOrExt));
      if(r) r[COLS.TERMINADA]=val;
      return true;
    }catch(e){ console.error(e); return false; }
  }

  async function updateMostrar(idOrExt, checked){
    try{
      const val = checked?0:1;
      const client = getClient(); if(!client) return false;
      let {data,error} = await client.from('SUBTAREAS').update({ [COLS.MOSTRAR]: val }).eq(PK_COL, idOrExt).select(PK_COL);
      if(!error && (!data||data.length===0)){
        ({data,error} = await client.from('SUBTAREAS').update({ [COLS.MOSTRAR]: val }).eq(COLS.ID_EXT, idOrExt).select(COLS.ID_EXT));
      }
      if(error || !data || data.length===0) return false;
      const r = STATE.rows.find(x=>String(x[PK_COL])===String(idOrExt) || String(x[COLS.ID_EXT])===String(idOrExt));
      if(r) r[COLS.MOSTRAR]=val;
      return true;
    }catch(e){ console.error(e); return false; }
  }

  async function onChangeChkTerminada(ev){
    const el = ev?.target; if(!el||el.dataset.busy==='1')return;
    const id = el.getAttribute('data-id')||el.getAttribute('data-idexterno'); const newChecked=!!el.checked;
    el.dataset.busy='1'; el.disabled=true;
    const ok = await updateTerminada(id,newChecked);
    if(!ok){ el.checked=!newChecked; alert('No se pudo guardar el cambio.'); }
    el.disabled=false; delete el.dataset.busy;
  }

  async function onChangeChkMostrar(ev){
    const el = ev?.target; if(!el||el.dataset.busy==='1')return;
    const id = el.getAttribute('data-id')||el.getAttribute('data-idexterno'); const newChecked=!!el.checked;
    el.dataset.busy='1'; el.disabled=true;
    const ok = await updateMostrar(id,newChecked);
    if(!ok){ el.checked=!newChecked; alert('No se pudo guardar el cambio.'); }
    el.disabled=false; delete el.dataset.busy;
    const onlyShown = document.querySelector('#subOnlyShown')?.checked;
    if(onlyShown) renderRows(getFilteredRows());
  }

  function getFilteredRows(){
    const q = (document.querySelector('#subSearch')?.value || '').trim().toLowerCase();
    const onlyShown = document.querySelector('#subOnlyShown')?.checked;
    let rows = STATE.rows;
    if(q){
      rows = rows.filter(r =>
        String(r[COLS.NOMBRE]??'').toLowerCase().includes(q) ||
        String(r[COLS.PROPIETARIO]??'').toLowerCase().includes(q) ||
        String(r[COLS.ID_EXT]??'').toLowerCase().includes(q)
      );
    }
    if(onlyShown) rows = rows.filter(isMarcadaMostrar); // Mostrar=0
    return rows;
  }

  function renderRows(rowsOrNull){
    const tbody = $('#tbodySubSel'); if(!tbody){ console.warn('No se encontró #tbodySubSel'); return; }
    const rows = Array.isArray(rowsOrNull)?rowsOrNull:getFilteredRows();
    if(rows.length===0){ tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:12px;">Sin registros</td></tr>`; return; }
    const html = rows.map(row=>{
      const idPk = row?.[PK_COL]??''; const idExt=row?.[COLS.ID_EXT]??'';
      const chkTerm = isTerminada(row)?'checked':''; const chkMostrar=isMarcadaMostrar(row)?'checked':'';
      return `
        <tr>
          <td style="text-align:center;">
            <input type="checkbox" data-id="${esc(idPk)}" data-idexterno="${esc(idExt)}"
              onchange="Subtareas.onChangeChkTerminada(event)" ${chkTerm}>
          </td>
          <td style="text-align:center;">
            <input type="checkbox" data-id="${esc(idPk)}" data-idexterno="${esc(idExt)}"
              onchange="Subtareas.onChangeChkMostrar(event)" ${chkMostrar}>
          </td>
          <td>${esc(idExt)}</td>
          <td>${esc(row[COLS.NOMBRE])}</td>
          <td>${esc(row[COLS.PROPIETARIO])}</td>
          <td style="text-align:right;">${esc(row[COLS.DURACION])}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html;
  }

  const API = {
    init: async function(){
      renderHeader();
      const rows = await fetchSubtareas(); renderRows(rows);
      const search = document.querySelector('#subSearch');
      const only = document.querySelector('#subOnlyShown');
      search && search.addEventListener('input', ()=>renderRows(getFilteredRows()));
      only && only.addEventListener('change', ()=>renderRows(getFilteredRows()));
    },
    reload: async function(){ const rows=await fetchSubtareas(); renderRows(rows); },
    onChangeChkTerminada,
    onChangeChkMostrar
  };
  window.Subtareas = API;

  if(document.readyState==='complete'||document.readyState==='interactive'){ setTimeout(API.init,0); }
  else { document.addEventListener('DOMContentLoaded', API.init, {once:true}); }
})();
