(function(){
'use strict';
const CM = window._commons;

var diasFaltantes = 0;

// --- Header (sprint activo o vigente por fechas) ---
async function loadSprintHeader(){
  let { data, error } = await window.db
    .from(CM.TABLES.SPRINTS)
    .select('nombre, fecha_inicio, fecha_fin')
    .or('activo.eq.true,activo.eq.1')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const today = new Date().toISOString().slice(0,10);
    const q = await window.db
      .from(CM.TABLES.SPRINTS)
      .select('nombre, fecha_inicio, fecha_fin')
      .lte('fecha_inicio', today)
      .gte('fecha_fin', today)
      .order('fecha_inicio', { ascending:false })
      .limit(1)
      .maybeSingle();
    data = q.data; error = q.error;
  }

  if (error || !data) return;

  const titleEl = document.getElementById('sprintTitle');
  const datesEl = document.getElementById('sprintDates');
  const chipEl  = document.getElementById('chipDias');
  const daysEl  = document.getElementById('daysLeft');

  titleEl.textContent = data.nombre || 'Sprint activo';
  datesEl.textContent = `${CM.fmtDate(data.fecha_inicio)} → ${CM.fmtDate(data.fecha_fin)}`;

  const today = new Date(); today.setHours(0,0,0,0);
  const end = new Date((data.fecha_fin || '') + 'T00:00:00');
  const hoyISO = today.toISOString().slice(0,10);
  const finISO = String(data.fecha_fin || '').slice(0,10);
  const diff = businessDaysCountISO(hoyISO, finISO, {includeStart:true, includeEnd:true});
  if (chipEl) chipEl.innerHTML = `Días restantes: <b>${diff}</b>`;
  if (daysEl) daysEl.textContent = String(diff);

  diasFaltantes = diff;
  // Guarda días restantes para el resumen de pendientes
  window._diasRestantesSprint = diff;
}

// --- KPIs ---
async function loadKpis(){
  const KPI_SOURCES = {
    pctSprint:       { view: 'vw_totales_sprint', column: 'pct_avance' },
    horasSubtarea:   { view: 'vw_totales_sprint', column: 'total_x_sub' },
    totalPendientes: { view: 'vw_totales_sprint', column: 'total_pendientes' },
    horasTerminadas: { view: 'vw_totales_sprint', column: 'total_terminadas' }
  };
  const { data, error } = await window.db
    .from(KPI_SOURCES.pctSprint.view)
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error || !data) return;

  const pct   = Number(data[KPI_SOURCES.pctSprint.column] ?? 0);
  const hrsS  = Number(data[KPI_SOURCES.horasSubtarea.column] ?? 0);
  const pend  = Number(data[KPI_SOURCES.totalPendientes.column] ?? 0);
  const hrsT  = Number(data[KPI_SOURCES.horasTerminadas.column] ?? 0);

  const pctEl  = document.getElementById('kpiPctSprint');
  const hrsSEl = document.getElementById('kpiHorasSubtarea');
  const pendEl = document.getElementById('kpiTotalPendientes');
  const hrsTEl = document.getElementById('kpiHorasTerminadas');

  if (pctEl)  pctEl.textContent  = (isFinite(pct) ? pct.toFixed(1) : '0') + '%';
  if (hrsSEl) hrsSEl.textContent = isFinite(hrsS) ? hrsS.toLocaleString('es-MX') : '—';
  if (pendEl) pendEl.textContent = isFinite(pend) ? pend.toLocaleString('es-MX') : '—';
  if (hrsTEl) hrsTEl.textContent = isFinite(hrsT) ? hrsT.toLocaleString('es-MX') : '—';
}

// --- Tablas ---
async function loadTabla(view, theadId, tbodyId){
  const { data, error } = await window.db.from(view).select('*');
  if (error) { console.error(view, error); return; }
  const thead = document.getElementById(theadId);
  const tbody = document.getElementById(tbodyId);
  window.renderTable ? window.renderTable(thead, tbody, data) : (function(){
    thead.innerHTML = '';
    tbody.innerHTML = '';
    if (!data || !data.length){ thead.innerHTML = '<tr><th>Sin datos</th></tr>'; return; }
    const cols = Object.keys(data[0]);
    thead.innerHTML = '<tr>' + cols.map(c=>`<th>${c}</th>`).join('') + '</tr>';
    tbody.innerHTML = data.map(r=>'<tr>'+cols.map(c=>`<td>${(r[c]??'')}</td>`).join('')+'</tr>').join('');
  })();
}

// --- Resumen de pendientes ---
async function loadResumenPendientes(){
  const { data, error } = await window.db
    .from('vw_subtareas_pendientes_detalle')
    .select('Propietario, nombre_lista, hu, subtarea, duracion');
  if (error) { console.error('Resumen pendientes', error); return; }
  if (!data || !data.length) return;

  const horasPorDia = 7;
  const resumen = {};
  data.forEach(row => {
    const propietario = row.Propietario;
    if (!resumen[propietario]) resumen[propietario] = { tareas: [], totalHoras: 0 };
     const duracion = Number(row.duracion) || 0; 
    resumen[propietario].tareas.push({
      hu: row.hu || 'Sin HU',
      lista: row.nombre_lista || 'Sin lista',
      subtarea: row.subtarea,
       duracion: duracion
    });
       resumen[propietario].totalHoras += duracion;
  });

  Object.values(resumen).forEach(r => {
    r.horasDisponibles = (diasFaltantes || 0) * horasPorDia;
  });

  const cont = document.getElementById('resumenPendientes');
  if (!cont) return;
cont.innerHTML = Object.entries(resumen).map(([propietario, data]) => {
  // Agrupar tareas por HU
  const tareasPorHU = {};
  data.tareas.forEach(t => {
    if (!tareasPorHU[t.hu]) tareasPorHU[t.hu] = [];
    tareasPorHU[t.hu].push(t);
  });

  return `
    <div class="card shadow-sm mb-3 border-0">
      <div class="card-header d-flex justify-content-between align-items-center bg-light">
        <span class="" style="color:#6f42c1;text-size:12px">${propietario}</span>
        <small class="text-muted">
          <b>Pendientes:</b> ${data.totalHoras}h |
          <b>Disponibles:</b> ${data.horasDisponibles}h
        </small>
      </div>
      <div class="card-body p-3">
        ${Object.entries(tareasPorHU).map(([hu, tareas]) => `
          <div class="mb-2">
            <span class="fw-semibold text-dark">${hu}</span>
            <span class="badge bg-secondary ms-1" >${tareas[0].lista}</span>
            <ul class="list-unstyled ms-2 mt-1 mb-0 small">
              ${tareas.map(t => `
                <li class="d-flex  align-items-center mb-1">
                  <span>${t.subtarea}</span>
                  <span class="badge bg-warning text-dark"> ${t.duracion}h</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}).join('');

}

// --- Refresh all ---
async function refreshDashboard(){
  try {
    CM.showLoading(true);
    await loadSprintHeader();
    await loadKpis();
    await loadTabla(CM.VIEWS.AVANCE_LISTA, 'theadLista', 'tbodyLista');
    await loadTabla(CM.VIEWS.TOTALES_PROP, 'theadProp', 'tbodyProp');
    await loadResumenPendientes();
  } finally {
    CM.showLoading(false);
  }
}

(()=>{ const b=document.getElementById('btnRefreshDashboard'); if(b) b.addEventListener('click', refreshDashboard); })();
window._hooks = window._hooks || {}; window._hooks['view-dashboard'] = refreshDashboard;
refreshDashboard();

})();