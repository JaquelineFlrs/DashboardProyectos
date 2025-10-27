// js/ui.dashboard.js
// Dashboard: KPIs + Burndown (tabla + chart) + Proyectos + Riesgo + Horas terminadas/día
window.uiDashboard = (function () {
  let chartBurndown = null;
  let chartHorasDia = null;

  // ---------- Helpers ----------
  function fmt(dstr) {
    if (!dstr) return '';
    const d = new Date(dstr);
    if (isNaN(d)) return dstr;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  function daysLeft(toDateStr) {
    if (!toDateStr) return null;
    const end = new Date(toDateStr);
    if (isNaN(end)) return null;
    const now = new Date();
    const diff = Math.ceil((end.setHours(23,59,59,999) - now) / 86400000);
    return Math.max(0, diff);
  }
  function renderSprintCard(s) {
    const $name = $('#sc-name');
    const $dates = $('#sc-dates');
    const $left = $('#sc-left');
    const $id = $('#sc-id');

    if (!s || !s.id) {
      $name.text('—');
      $dates.text('—');
      $left.addClass('hidden').text('—');
      $id.text('—');
      return;
    }
    const nombre = s.nombre || `#${s.id}`;
    const inicio = s.fecha_inicio || s.inicio;
    const fin    = s.fecha_fin    || s.fin;
    const left   = daysLeft(fin);

    $name.text(nombre);
    $dates.text(`${fmt(inicio)} → ${fmt(fin)}`);
    $id.text(`#${s.id}`);
    if (left === null) $left.addClass('hidden');
    else $left.removeClass('hidden').text(`${left} día${left===1?'':'s'} restantes`);
  }

  // ---------- KPIs ----------
  function renderKPI(d) {
    $('#k-horas-tot').text((d?.horas_totales || 0).toFixed(0));
    $('#k-horas-done').text((d?.horas_terminadas || 0).toFixed(0));
    $('#k-horas-pend').text((d?.horas_pendientes || 0).toFixed(0));
    $('#k-avance').text(((d?.avance_pct || 0)).toFixed(0) + '%');
  }

  // ---------- BURNDOWN: tabla (editable) ----------
  function renderBurndownTable(rows, sprintId) {
    const trs = (rows || []).map(r => {
      const valEst  = (r.estimado == null ? '' : Number(r.estimado).toFixed(2));
      const valReal = (r.real     == null ? '' : Number(r.real)    .toFixed(2));
      return `
        <tr>
          <td class="td">#${sprintId}</td>
          <td class="td">${r.dia}</td>
          <td class="td">${r.fecha ?? ''}</td>
          <td class="td">${valEst}</td>
          <td class="td">
            <input
              type="number"
              step="0.25"
              min="0"
              class="input bd-real"
              data-dia="${r.dia}"
              value="${valReal}"
              data-prev="${valReal}"
              style="width:9rem;"
            />
          </td>
        </tr>
      `;
    }).join('');
    $('#tbody-burndown').html(trs || '<tr><td class="td" colspan="5">Sin datos.</td></tr>');
  }

  // ---------- BURNDOWN: gráfica ----------
  function renderBurndownChart(rows) {
    const dataRows = Array.isArray(rows) ? rows : [];
    const labels = dataRows.map(r => Number(r.dia ?? 0));
    const est = dataRows.map(r => {
      const v = Number(r.estimado);
      return (Number.isFinite(v) && v !== 0) ? v : null;
    });
    const real = dataRows.map(r => {
      const v = Number(r.real);
      return (Number.isFinite(v) && v !== 0) ? v : null;
    });

    const el = document.getElementById('burndownChart');
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    if (chartBurndown) { try { chartBurndown.destroy(); } catch(_){} }

    chartBurndown = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Estimado', data: est, tension: 0.25 },
          { label: 'Real',     data: real, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        spanGaps: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: { callbacks: { title: (items) => `Día ${items?.[0]?.label ?? ''}` } }
        },
        scales: {
          x: { title: { display: true, text: 'Día (0..N)' } },
          y: { title: { display: true, text: 'Horas restantes' }, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  // ---------- Horas terminadas por día ----------
  async function renderHorasTerminadasPorDia() {
    if (!window.api?.getActiveSprintId) return;
    const id = await api.getActiveSprintId();
    if (!id || !window.api?.horasTerminadasPorDia) return;

    const rows = await api.horasTerminadasPorDia(id);
    const labels = (rows || []).map(r => {
      const d = new Date(r.fecha);
      return isNaN(d.getTime())
        ? (r.fecha ?? '')
        : d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
    });
    const values = (rows || []).map(r => Number(r.horas_terminadas || 0));

    const el = document.getElementById('chartHorasDia');
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    if (chartHorasDia) { try { chartHorasDia.destroy(); } catch (_) {} }

    chartHorasDia = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Horas terminadas', data: values }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'Día' } },
          y: { title: { display: true, text: 'Horas' }, beginAtZero: true, ticks: { precision: 0 } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => `Día ${items?.[0]?.label ?? ''}`,
              label: (item) => `${item.raw ?? 0} h`
            }
          }
        }
      }
    });
  }

  // ---------- Avance por proyecto ----------
  function renderProyecto(rows) {
    const trs = (rows || []).map(r => {
      const tot = Number(r.horas_totales || 0);
      const done = Number(r.horas_terminadas || 0);
      const pend = Number(r.horas_pendientes || 0);
      const pct = (r.avance_pct != null) ? Number(r.avance_pct) : (tot ? (100 * done / tot) : 0);
      return `
        <tr>
          <td class="td">${r.proyecto}</td>
          <td class="td">${tot.toFixed(0)}</td>
          <td class="td">${done.toFixed(0)}</td>
          <td class="td">${pend.toFixed(0)}</td>
          <td class="td">${pct.toFixed(0)}%</td>
        </tr>
      `;
    }).join('');
    $('#tbody-proyecto').html(trs || '<tr><td class="td" colspan="5">Sin datos.</td></tr>');
  }

  // ---------- Riesgo por propietario ----------
  function renderRiesgo(rows) {
    const trs = (rows || []).map(r => {
      const badge = r.en_riesgo
        ? '<span class="badge" style="background:#fee2e2;border-color:#fecaca;color:#991b1b;">Riesgo</span>'
        : '<span class="badge" style="background:#dcfce7;border-color:#bbf7d0;color:#166534;">OK</span>';
      return `
        <tr>
          <td class="td">${r.propietario || '(sin asignar)'}</td>
          <td class="td">${Number(r.horas_pendientes || 0).toFixed(0)}</td>
          <td class="td">${r.dias_restantes}</td>
          <td class="td">${Number(r.capacidad_restante || 0).toFixed(0)}</td>
          <td class="td">${badge}</td>
        </tr>
      `;
    }).join('');
    $('#tbody-riesgo').html(trs || '<tr><td class="td" colspan="5">Sin datos.</td></tr>');
  }

  // ---------- Sprint Meta (título y badge + card) ----------
  async function renderSprintMeta() {
    // Usa directamente tu API real
    const s = await api.getSprintActivo().catch(() => null);

    if (!s) {
      $('#bd-title-text').text('Burndown');
      $('#badge-sprint').html('Sin seleccionar');
      renderSprintCard(null);
      return;
    }

    const nombre = s.nombre || `#${s.id}`;
    const inicio = s.fecha_inicio || s.inicio;
    const fin    = s.fecha_fin    || s.fin;
    const left   = daysLeft(fin);
    const leftTxt = (left===null) ? '' : `${left} día${left===1?'':'s'} restantes`;

    // Título (concatena)
    $('#bd-title-text').text(`Burndown – Sprint ${nombre}`);

    // Badge compacto
    $('#badge-sprint').html(`
      <div class="flex flex-col items-start gap-1 text-sm leading-tight p-2 rounded-xl w-fit">
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold">${nombre}</span>
          ${left!==null ? `<span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs">${leftTxt}</span>` : ''}
        </div>
        <div class="text-slate-600">${fmt(inicio)} → ${fmt(fin)}</div>
      </div>
    `);

    // Card superior (si existe en el HTML)
    renderSprintCard(s);
  }

  // ---------- Cargar dashboard ----------
  async function cargarTodo() {
    if (!window.api?.getActiveSprintId) {
      renderKPI(null);
      renderBurndownTable([], 0);
      renderBurndownChart([]);
      if (chartHorasDia) { try { chartHorasDia.destroy(); } catch (_) {} }
      renderProyecto([]);
      renderRiesgo([]);
      return;
    }

    const id = await api.getActiveSprintId();
    await renderSprintMeta();

    if (!id || !window.api) {
      renderKPI(null);
      renderBurndownTable([], 0);
      renderBurndownChart([]);
      if (chartHorasDia) { try { chartHorasDia.destroy(); } catch (_) {} }
      renderProyecto([]);
      renderRiesgo([]);
      return;
    }

    const [k, bd, prj, own] = await Promise.all([
      api.kpis(id),
      api.burndown(id),
      api.avanceProyecto(id),
      api.riesgoPropietario(id),
    ]);

    renderKPI(k || {});
    renderBurndownTable(bd || [], id);
    renderBurndownChart(bd || []);
    await renderHorasTerminadasPorDia();
    renderProyecto(prj || []);
    renderRiesgo(own || []);
  }

  // ---------- Guardar Real ----------
  let _bdSaving = false;
  async function guardarRealInput(inputEl) {
    if (_bdSaving) return;
    if (!window.api?.getActiveSprintId) return;
    const id = await api.getActiveSprintId();
    if (!id || !window.api?.setBurndownReal) return;

    const $el = $(inputEl);
    const dia = Number($el.data('dia'));
    const raw = ($el.val() ?? '').toString().trim();
    const prev = $el.data('prev');
    if (raw === prev) return;

    const real = raw === '' ? null : Number(raw);
    if (real !== null && (!Number.isFinite(real) || real < 0)) {
      alert('Valor de "Real" inválido.');
      if (prev !== undefined) $el.val(prev);
      return;
    }

    try {
      _bdSaving = true;
      $el.prop('disabled', true);
      await api.setBurndownReal(id, dia, real);
      const bd = await api.burndown(id);
      renderBurndownTable(bd || [], id);
      renderBurndownChart(bd || []);
      $el.data('prev', raw);
    } catch (e) {
      console.error(e);
      alert('No se pudo guardar el valor de "Real": ' + (e.message || e));
    } finally {
      $el.prop('disabled', false);
      _bdSaving = false;
    }
  }

  // ---------- Bind ----------
  function bind() {
    $(document)
      .off('click', '#btn-estimado')
      .on('click', '#btn-estimado', async () => {
        if (!window.api?.getActiveSprintId) return alert('Selecciona un sprint activo.');
        const id = await api.getActiveSprintId();
        if (!id) return alert('Selecciona un sprint activo.');
        try {
          $('#btn-estimado').prop('disabled', true);
          await api.calcEstimado(id);
          await cargarTodo();
        } catch (e) {
          alert(e.message || e);
        } finally {
          $('#btn-estimado').prop('disabled', false);
        }
      });

    $(document)
      .off('click', '#btn-real-hoy')
      .on('click', '#btn-real-hoy', async () => {
        if (!window.api?.getActiveSprintId) return alert('Selecciona un sprint activo.');
        const id = await api.getActiveSprintId();
        if (!id) return alert('Selecciona un sprint activo.');
        try {
          $('#btn-real-hoy').prop('disabled', true);
          const updated = await api.writeRealHoy(id);
          const [k, bd] = await Promise.all([api.kpis(id), api.burndown(id)]);
          renderKPI(k || {});
          renderBurndownTable(bd || [], id);
          renderBurndownChart(bd || []);
          await renderHorasTerminadasPorDia();
          if (updated === false) alert('No se registró el real de hoy.');
        } catch (e) {
          console.error(e);
          alert('Error: ' + (e.message || e));
        } finally {
          $('#btn-real-hoy').prop('disabled', false);
        }
      });

    $(document)
      .off('change blur', 'input.bd-real')
      .on('change blur', 'input.bd-real', async function () {
        await guardarRealInput(this);
      });
  }

  // ---------- API pública ----------
  async function render() {
    bind();
    await cargarTodo();
    await renderSprintMeta(); // refuerzo
  }

  return { render };
})();
