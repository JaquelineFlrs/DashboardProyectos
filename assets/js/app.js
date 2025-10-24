// ====== CONFIG SUPABASE ======
const SUPABASE_URL = 'https://mcaoejgrrwxlojxkyhll.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jYW9lamdycnd4bG9qeGt5aGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNzcwODcsImV4cCI6MjA3NTg1MzA4N30.aTxvtydc58_P2mAwdg0x3N19F7VwJAIDsI1iS6cD8Dc';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== SweetAlert2 Toast (bottom-right) + heart beat ======
const Toast = Swal.mixin({
  toast: true,
  position: 'bottom-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  customClass: {
    popup: 'backdrop-blur-xl'
  }
});
function addToast({type='success', text='Hecho'}={}){
  Toast.fire({
    icon: type==='success' ? 'success' : 'error',
    title: text
  });
  const heart = document.getElementById('heart-main');
  if(heart){ heart.classList.add('beat'); setTimeout(()=>heart.classList.remove('beat'), 500); }
}

// ====== NAV ======
const tabs = document.querySelectorAll('.tab');
const panels = { dash: document.getElementById('panel-dash'), admin: document.getElementById('panel-admin'), config: document.getElementById('panel-config') };
tabs.forEach(btn=>btn.onclick=()=>{
  tabs.forEach(b=>b.classList.remove('bg-white/10'));
  btn.classList.add('bg-white/10');
  Object.values(panels).forEach(p=>p.classList.add('hidden'));
  panels[btn.dataset.tab].classList.remove('hidden');
});

// ====== CSV HELPERS ======
const parseCSV = (file) => new Promise((resolve, reject)=>{
  Papa.parse(file, { header: true, skipEmptyLines: true, complete: res => resolve(res.data), error: err => reject(err) });
});
const expectHeadersHistorias = ["ID de Tarea","Nombre de Tarea","Tipo de tarea","Propietario","Estado personalizado","Duración","Nombre de la lista de tareas"];
const expectHeadersSubtareas = ["ID de Tarea principal","Nombre de Tarea","Propietario","Estado personalizado","Duración","Hora de creación","Fecha de terminación"];
function validateHeaders(rows, expected){
  if(!rows || rows.length===0) throw new Error("El CSV está vacío.");
  const cols = Object.keys(rows[0]); expected.forEach(h=>{ if(!cols.includes(h)) throw new Error("Encabezado faltante: " + h); });
}

// ====== DASH LOADERS ======
async function loadResumen(){
  const { data: res, error } = await sb.from('vw_resumen_sprint').select('*').limit(1);
  if(error){ console.error(error); return; }
  const r = res?.[0]; if(!r) return;
  document.getElementById('sp-nombre').textContent = r.nombre || r.id_sprint || 'Sprint';
  document.getElementById('sp-fechas').textContent = `Del ${r.fecha_inicio} al ${r.fecha_fin}`;
  document.getElementById('sp-dias').textContent = r.dias_habiles_restantes;
  document.getElementById('k-avance').textContent = `${r.avance_pct ?? 0}%`;
  document.getElementById('k-hrs-plan').textContent = r.hrs_actuales ?? 0;
  document.getElementById('k-hrs-term').textContent = r.horas_terminadas ?? 0;
  document.getElementById('k-hrs-pend').textContent = r.horas_pendientes ?? 0;
  document.getElementById('k-hrs-actual').textContent = r.hrs_actuales ?? 0;
  const { data: sp } = await sb.from('sprints').select('hrs_sprint').order('fecha_creacion', {ascending:false}).limit(1);
  document.getElementById('k-hrs-inicio').textContent = sp?.[0]?.hrs_sprint ?? r.hrs_inicio ?? 0;
}

async function loadListas(){
  const { data, error } = await sb.from('vw_listas_tareas_avance').select('*');
  if(error){ console.error(error); return; }
  const tbody = document.getElementById('tbl-listas'); tbody.innerHTML='';
  (data||[]).forEach(r=>{
    const pct = r.total_h>0? Math.round((r.terminadas_h/r.total_h)*100):0;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-2 pr-4">${r.nombre_lista||'—'}</td>
                    <td class="text-right py-2 px-4">${r.total_h}</td>
                    <td class="text-right py-2 px-4">${r.terminadas_h}</td>
                    <td class="text-right py-2 px-4">${r.pendientes_h}</td>
                    <td class="text-right py-2 pl-4">${pct}%</td>`;
    tbody.appendChild(tr);
  });
}

async function loadPersonas(){
  const { data: resumen } = await sb.from('vw_resumen_sprint').select('*').limit(1);
  const { data, error } = await sb.from('vw_persona_pendientes').select('*');
  if(error){ console.error(error); return; }
  const cont = document.getElementById('cards-personas'); cont.innerHTML='';
  for(const p of (data||[])){
    const cap = (resumen?.[0]?.dias_habiles_restantes||0) * (resumen?.[0]?.hrs_por_persona||0);
    const pend = p.horas_pendientes||0;
    const ratio = cap>0? pend/cap: 0;
    const badge = ratio>1? 'bg-red-500/30 border-red-400/40' : (ratio>=0.8? 'bg-amber-500/30 border-amber-400/40':'bg-emerald-500/30 border-emerald-400/40');
    const card = document.createElement('div');
    card.className = 'card p-5 grid gap-3';
    card.innerHTML = `<div class="flex items-center justify-between">
        <div class="font-semibold">${p.propietario||'—'}</div>
        <span class="px-2 py-1 rounded-full text-xs border ${badge}">${ratio>1? 'Riesgo alto': (ratio>=0.8?'Riesgo medio':'OK')}</span>
      </div>
      <div class="text-sm text-white/70">Pendientes: <b>${pend}</b> h · Capacidad restante: <b>${cap}</b> h</div>
      <div class="overflow-auto max-h-64">
        <table class="min-w-full text-xs">
          <thead class="text-white/60"><tr><th class="text-left py-2 pr-4">HU</th><th class="text-left py-2 pr-4">Subtarea</th><th class="text-right py-2 px-4">Duración</th><th class="text-left py-2 pl-4">Lista</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>`;
    cont.appendChild(card);
    const tb = card.querySelector('tbody');
    const { data: det } = await sb.from('vw_persona_pendientes_detalle').select('*').eq('propietario', p.propietario);
    (det||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td class="py-2 pr-4">${r.nombre_hu||'—'}</td><td class="py-2 pr-4">${r.nombre_subtarea||'—'}</td><td class="text-right py-2 px-4">${r.duracion_horas||0}</td><td class="py-2 pl-4">${r.nombre_lista||'—'}</td>`; tb.appendChild(tr); });
  }
}

async function loadBurndown(){
  let data=null, error=null;
  ({data, error} = await sb.from('vw_burndown').select('*').order('fecha'));
  if(error){ ({data, error} = await sb.from('burndown').select('fecha, estimado, real, terminadas_dia').order('fecha')); }
  if(error){ console.error(error); return; }
  const labels = (data||[]).map(x=>x.fecha);
  const est = (data||[]).map(x=> x.estimado ?? null);
  const real = (data||[]).map(x=> x.real ?? null);
  const barras = (data||[]).map(x=> x.terminadas_dia ?? 0);
  const ctx = document.getElementById('chart-burn');
  if(window.chartBurn) window.chartBurn.destroy();
  window.chartBurn = new Chart(ctx, { type:'bar', data:{ labels, datasets:[
    {type:'line', label:'Estimado', data:est, borderColor:'#A78BFA', backgroundColor:'transparent'},
    {type:'line', label:'Real', data:real, borderColor:'#22D3EE', backgroundColor:'transparent'},
    {type:'bar', label:'Terminadas (h)', data:barras, backgroundColor:'#7C3AED'}
  ]}, options:{plugins:{legend:{labels:{color:'#fff'}}}, scales:{x:{ticks:{color:'#fff'}}, y:{ticks:{color:'#fff'}}}} });
}

// ====== CONFIG ACTIONS ======
function setLoading(btn, loading){ btn.disabled = loading; btn.style.opacity = loading ? .6 : 1; }

document.getElementById('btn-crear').onclick = async (ev)=>{
  const btn = ev.currentTarget; setLoading(btn, true);
  try{
    const nombre = document.getElementById('cf-nombre').value;
    const inicio = document.getElementById('cf-inicio').value;
    const fin = document.getElementById('cf-fin').value;
    const num = +document.getElementById('cf-num').value;
    const hrsper = +document.getElementById('cf-hrsper').value;
    const hrss = +document.getElementById('cf-hrssprint').value;
    const r = await sb.rpc('crear_sprint',{ p_nombre:nombre, p_fecha_inicio:inicio, p_fecha_fin:fin, p_num_personas:num, p_hrs_por_persona:hrsper, p_hrs_sprint:hrss });
    if(r.error) throw r.error;
    await loadAll();
    addToast({type:'success', text:'Sprint creado'});
  }catch(e){ addToast({type:'error', text:'Error creando sprint: ' + (e.message||String(e))}); }
  finally { setLoading(btn, false); }
};

document.getElementById('btn-burndown').onclick = async (ev)=>{
  const btn = ev.currentTarget; setLoading(btn, true);
  try{
    const { data, error } = await sb.from('sprints').select('id').order('fecha_creacion', {ascending:false}).limit(1);
    if(error) throw error;
    const id = data?.[0]?.id; if(!id) throw new Error('Crea un sprint primero');
    const r = await sb.rpc('calcular_burndown', { p_id_sprint: id });
    if(r.error) throw r.error;
    await loadBurndown();
    addToast({type:'success', text:'Burndown recalculado'});
  }catch(e){ addToast({type:'error', text:'Error burndown: ' + (e.message||String(e))}); }
  finally { setLoading(btn, false); }
};

document.getElementById('btn-run-burndown').onclick = async ()=>{ document.getElementById('btn-burndown').click(); };

// Cargar solo Historias
document.getElementById('btn-carga-historias').onclick = async (ev)=>{
  const btn = ev.currentTarget; setLoading(btn, true);
  try{
    const fh = document.getElementById('file-historias').files[0];
    if(!fh) throw new Error('Selecciona historias.csv');
    const { data: sp } = await sb.from('sprints').select('id').order('fecha_creacion', {ascending:false}).limit(1);
    const sprint = sp?.[0]; if(!sprint) throw new Error('Crea un sprint antes.');
    const rowsH = await parseCSV(fh); validateHeaders(rowsH, expectHeadersHistorias);
    let r1 = await sb.rpc('upsert_historias', { p_id_sprint: sprint.id, p_rows: rowsH });
    if(r1.error) throw r1.error;
    await loadAll();
    addToast({type:'success', text:'Historias cargadas'});
  }catch(e){ addToast({type:'error', text:'Error en historias: ' + (e.message||String(e))}); }
  finally { setLoading(btn, false); }
};

// Cargar solo Subtareas
document.getElementById('btn-carga-subtareas').onclick = async (ev)=>{
  const btn = ev.currentTarget; setLoading(btn, true);
  try{
    const fs = document.getElementById('file-subtareas').files[0];
    if(!fs) throw new Error('Selecciona subtareas.csv');
    const { data: sp } = await sb.from('sprints').select('id, fecha_inicio').order('fecha_creacion', {ascending:false}).limit(1);
    const sprint = sp?.[0]; if(!sprint) throw new Error('Crea un sprint antes.');
    const rowsS = await parseCSV(fs); validateHeaders(rowsS, expectHeadersSubtareas);
    let r = await sb.rpc('carga_diaria_subtareas', { p_id_sprint: sprint.id, p_rows: rowsS });
    if(r.error) throw r.error;
    await loadAll();
    addToast({type:'success', text:'Subtareas cargadas'});
  }catch(e){ addToast({type:'error', text:'Error en subtareas: ' + (e.message||String(e))}); }
  finally { setLoading(btn, false); }
};

// ====== ADMIN TABLE con filtros + paginación + ORDENAMIENTO ======
const adminTBody = document.getElementById('tbl-admin');
const searchInput = document.getElementById('busca');
const filterTerm = document.getElementById('filter-terminado');
const filterOcu = document.getElementById('filter-ocultar');
const pgInfo = document.getElementById('pg-info');
const pgPrev = document.getElementById('pg-prev');
const pgNext = document.getElementById('pg-next');
const pageSizeSel = document.getElementById('page-size');
const thSortables = Array.from(document.querySelectorAll('th.sortable'));

let ADMIN_DATA = [];
let PAGE = 1;
let PAGE_SIZE = +pageSizeSel.value;
let SORT_KEY = 'nombre_hu';
let SORT_DIR = 'asc';

[searchInput, filterTerm, filterOcu].forEach(el=> el.oninput = ()=>{ PAGE=1; renderAdmin(); });
pageSizeSel.onchange = ()=>{ PAGE_SIZE = +pageSizeSel.value; PAGE = 1; renderAdmin(); }
pgPrev.onclick = ()=>{ if(PAGE>1){ PAGE--; renderAdmin(); } }
pgNext.onclick = ()=>{ const max = Math.max(1, Math.ceil(filterData().length / PAGE_SIZE)); if(PAGE<max){ PAGE++; renderAdmin(); } }
thSortables.forEach(th=>{
  th.addEventListener('click', ()=>{
    const k = th.dataset.k;
    if(SORT_KEY === k){ SORT_DIR = SORT_DIR === 'asc' ? 'desc' : 'asc'; }
    else { SORT_KEY = k; SORT_DIR = 'asc'; }
    renderAdmin();
  });
});

function filterData(){
  const f = (searchInput.value||'').toLowerCase();
  const t = filterTerm.value; // '', '1', '0'
  const o = filterOcu.value;  // '', '1', '0'
  return ADMIN_DATA.filter(r=>{
    const text = (r.nombre_hu||'') + (r.propietario||'') + (r.estado||'') + (r.duracion_horas||'');
    if(!text.toLowerCase().includes(f)) return false;
    if(t!=='' && ((r.terminado_eff? '1':'0') !== t)) return false;
    if(o!=='' && ((r.ocultar_eff? '1':'0') !== o)) return false;
    return true;
  });
}

function sortData(rows){
  return rows.sort((a,b)=>{
    const va = (a[SORT_KEY] ?? '');
    const vb = (b[SORT_KEY] ?? '');
    if(typeof va === 'number' && typeof vb === 'number'){
      return SORT_DIR === 'asc' ? va - vb : vb - va;
    }
    return SORT_DIR === 'asc' ? (''+va).localeCompare(''+vb) : (''+vb).localeCompare(''+va);
  });
}

function renderAdminRows(rows){
  adminTBody.innerHTML='';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-2 pr-4">${r.nombre_hu||'—'}</td>
                    <td class="py-2 pr-4">${r.propietario||'—'}</td>
                    <td class="py-2 pr-4">${r.estado||'—'}</td>
                    <td class="text-right py-2 px-4">${r.duracion_horas||0}</td>
                    <td class="text-center py-2 px-4"><input type="checkbox" style="accent-color:#7C3AED" ${r.terminado_eff?'checked':''} data-k="t"></td>
                    <td class="text-center py-2 px-4"><input type="checkbox" style="accent-color:#7C3AED" ${r.ocultar_eff?'checked':''} data-k="o"></td>`;
    adminTBody.appendChild(tr);
    const chkT = tr.querySelector('input[data-k="t"]');
    const chkO = tr.querySelector('input[data-k="o"]');
    chkT.onchange = async ()=>{
      const res = await sb.rpc('set_override_subtarea', { p_clave: r.clave_subtarea, p_terminado_manual: chkT.checked, p_ocultar_manual: null });
      if(res.error){ addToast({type:'error', text:'Error guardando'}); chkT.checked = !chkT.checked; }
      else { addToast({type:'success', text:'Guardado'}); loadAll(); }
    };
    chkO.onchange = async ()=>{
      const res = await sb.rpc('set_override_subtarea', { p_clave: r.clave_subtarea, p_terminado_manual: null, p_ocultar_manual: chkO.checked });
      if(res.error){ addToast({type:'error', text:'Error guardando'}); chkO.checked = !chkO.checked; }
      else { addToast({type:'success', text:'Guardado'}); loadAll(); }
    };
  });
}

function renderAdmin(){
  const rows = sortData(filterData());
  const max = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  PAGE = Math.min(PAGE, max);
  const slice = rows.slice((PAGE-1)*PAGE_SIZE, PAGE*PAGE_SIZE);
  renderAdminRows(slice);
  pgInfo.textContent = `Página ${PAGE} de ${max} — ${rows.length} registros`;
}

async function loadAdmin(){
  const { data, error } = await sb.rpc('load_admin_rows');
  if(!error && data){ ADMIN_DATA = data; renderAdmin(); return; }
  const { data: subt } = await sb.from('vw_subtareas_publicas')
    .select('clave_subtarea, nombre_tarea, propietario, estado_personalizado, duracion_horas, terminado_manual, terminado, ocultar_manual, ocultar, id_sprint, id_tarea_principal');
  const { data: hist } = await sb.from('historias').select('id_sprint,id_tarea,nombre_tarea');
  const mapHU = new Map(); (hist||[]).forEach(h=> mapHU.set(`${h.id_sprint}|${h.id_tarea}`, h.nombre_tarea));
  ADMIN_DATA = (subt||[]).map(s=> ({
    clave_subtarea: s.clave_subtarea,
    nombre_hu: mapHU.get(`${s.id_sprint}|${s.id_tarea_principal}`) || '',
    propietario: s.propietario,
    estado: s.estado_personalizado,
    duracion_horas: s.duracion_horas,
    terminado_eff: (s.terminado_manual ?? s.terminado) || false,
    ocultar_eff: (s.ocultar_manual ?? s.ocultar) || false
  }));
  renderAdmin();
}

// ====== Burndown editable en Admin ======
const burnTBody = document.getElementById('tbl-burn-admin');
async function loadBurnAdmin(){
  const { data: sp } = await sb.from('sprints').select('id').order('fecha_creacion', {ascending:false}).limit(1);
  const sprintId = sp?.[0]?.id;
  if(!sprintId){ burnTBody.innerHTML = ''; return; }
  const { data, error } = await sb.from('burndown').select('dia_index, fecha, real, estimado').eq('id_sprint', sprintId).order('fecha');
  if(error){ console.error(error); return; }
  burnTBody.innerHTML = '';
  (data||[]).forEach(row=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="py-2 pr-4">${row.dia_index}</td>
                    <td class="py-2 pr-4">${row.fecha}</td>
                    <td class="text-right py-2 px-4">
                      <input type="number" step="1" class="px-2 py-1 rounded-lg bg-white/10 border border-white/15 w-28 text-right" value="${row.real ?? ''}" data-k="real">
                    </td>
                    <td class="text-right py-2 px-4">${row.estimado ?? ''}</td>
                    <td class="text-right py-2 px-4"><button class="px-3 py-1 rounded-lg bg-white/10 border border-white/15 save-real">Guardar</button></td>`;
    burnTBody.appendChild(tr);
    tr.querySelector('.save-real').onclick = async ()=>{
      const realVal = tr.querySelector('input[data-k="real"]').value;
      const res = await sb.rpc('set_burndown_real', { p_fecha: row.fecha, p_real: (realVal===''? null : +realVal) });
      if(res?.error){
        const upd = await sb.from('burndown').update({ real: (realVal===''? null : +realVal) }).eq('fecha', row.fecha).eq('id_sprint', sprintId);
        if(upd.error){ addToast({type:'error', text:'Error guardando Real'}); return; }
      }
      addToast({type:'success', text:'Real actualizado'});
      loadBurndown();
    };
  });
}

// ====== INIT ======
async function loadAll(){
  await loadResumen();
  await loadBurndown();
  await loadListas();
  await loadPersonas();
  await loadAdmin();
  await loadBurnAdmin();
}
loadAll();
