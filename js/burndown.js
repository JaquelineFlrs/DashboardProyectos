(function(){
  'use strict';
  const CM = window._commons;

  // Estado global para evitar duplicados y carreras
  window.__bd = window.__bd || { chart: null, bound: false, inflight: false };

  // ---- Helpers ----
  const toDM = (iso) => {
    // Devuelve "DD-MM" a partir de "YYYY-MM-DD"
    const d = new Date(iso);
    if (isNaN(d)) return iso ?? '';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    return `${dd}-${mm}`;
  };
  const fmtDateTable = (iso) => {
    // Para la tabla (DD/M/YYYY local)
    const d = new Date(iso);
    return isNaN(d) ? (iso ?? '') : d.toLocaleDateString();
  };
  const fmtNum = (n) => {
    if (n === null || n === undefined) return '-';
    const x = Number(n);
    return isFinite(x) ? x.toFixed(2) : '-';
  };

  async function buildBurndown(){
    if (window.__bd.inflight) return;      // evita llamadas simultáneas
    window.__bd.inflight = true;
    CM && CM.showLoading && CM.showLoading(true);

    try{
      const { data: serie, error } = await (window.db || window.supabase)
        .from('burndown_dataset')
        .select('dia, horas_restantes_real, horas_restantes_ideal')
        .order('dia', { ascending: true });

      if (error) { console.error('burndown_dataset:', error); return; }
      if (!Array.isArray(serie)) return;

      const labels = serie.map(r => toDM(r.dia));
      const ideal  = serie.map(r => (r?.horas_restantes_ideal ?? null));
      const real   = serie.map(r => (r?.horas_restantes_real  ?? null)); // NULL → corte en fechas futuras

      // Destruir cualquier chart previo para este canvas
      const canvas = document.getElementById('burndownCanvas');
      if (!canvas) { console.warn('No existe #burndownCanvas'); return; }
      const existing = (typeof Chart.getChart === 'function')
        ? Chart.getChart(canvas)
        : (Chart.instances ? Object.values(Chart.instances).find(c => c.canvas === canvas) : null);
      if (existing) existing.destroy();
      if (window.__bd.chart) { try{ window.__bd.chart.destroy(); }catch(e){} window.__bd.chart = null; }

      // ---- Chart ----
      const ctx = canvas.getContext('2d');
      window.__bd.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Estimado',
              data: ideal,
              borderColor: 'rgba(0, 102, 255, 0.85)',
              backgroundColor: 'rgba(0, 102, 255, 0.08)',
              fill: 'origin',
              tension: 0          // sin curvatura
            },
            {
              label: 'Real',
              data: real,
              borderColor: 'rgba(220, 0, 0, 0.9)',
              backgroundColor: 'rgba(220, 0, 0, 0.08)',
              fill: 'origin',
              spanGaps: false,    // deja hueco donde es NULL (futuro)
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Horas (Suma)' }
            },
            x: {
              title: { display: true, text: 'Día (DD-MM)' }
            }
          },
          plugins: {
            legend: { display: true },
            tooltip: {
              callbacks:{
                // Usa el label ya formateado DD-MM como título
                title: (items) => items?.[0]?.label ?? '',
                label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue ?? ''}`
              }
            }
          }
        }
      });

      // ---- Tabla (Fecha | Estimado | Real) ----
      const head = document.getElementById('theadBD');
      const body = document.getElementById('tbodyBD');

      if (head) {
        head.innerHTML = `
          <tr>
            <th>Fecha</th>
            <th>Estimado</th>
            <th>Real</th>
          </tr>`;
      }

      if (body) {
        body.innerHTML = serie.map(r => `
          <tr>
            <td>${toDM(r.dia)}</td>
            <td style="text-align:center;">${fmtNum(r.horas_restantes_ideal)}</td>
            <td style="text-align:center;">${fmtNum(r.horas_restantes_real)}</td>
          </tr>
        `).join('');
      }

    } finally {
      window.__bd.inflight = false;
      CM && CM.showLoading && CM.showLoading(false);
    }
  }

  // Enlaza botón solo una vez
  if (!window.__bd.bound) {
    const btn = document.getElementById('btnRecalcBurndown');
    if (btn) btn.addEventListener('click', buildBurndown);
    window.__bd.bound = true;
  }

  // Hook + carga inicial
  window._hooks = window._hooks || {};
  window._hooks['view-burndown'] = buildBurndown;
  buildBurndown();

})();
