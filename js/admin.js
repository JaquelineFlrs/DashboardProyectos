// js/admin.js
// ===========================================================
// Admin: Crear sprint, cargas CSV, sincronización
// Requiere:
//  - window.db (creado en js/config.js con supabase.createClient(...))
//  - Papa (papaparse) ya cargado
//  - Elementos en HTML (ids):
//    #frmSprint, #spNombre, #spInicio, #spFin, #spTotalHrs, #btnGuardarSprint
//    #csvSubtareas, #csvHistorias
//    #btnCargarSubtareas, #btnCargarHistorias, #btnCargarTodo, #btnSincronizar
//    #uploadMsg, #alert, #loading
// ===========================================================
(function () {
  'use strict';

  // -------------------------
  // Cliente y utilidades
  // -------------------------
  const sb = window.db;                            // <- cliente Supabase
  const $  = (s, r = document) => r.querySelector(s);

  function msg(txt, ok = true) {
    const el = $('#uploadMsg') || $('#alert');
    if (el) {
      el.style.display = 'block';
      el.style.color = ok ? '#065f46' : '#b91c1c';
      el.style.borderColor = ok ? '#6ee7b7' : '#fca5a5';
      el.style.background = ok ? '#ecfdf5' : '#fff1f2';
      el.textContent = txt;
    } else {
      if (!ok) console.error(txt); else console.log(txt);
      alert(txt);
    }
  }

  function setLoading(on) {
    const el = $('#loading');
    if (el) el.style.visibility = on ? 'visible' : 'hidden';
  }

  // -------------------------
  // Helpers CSV / batch
  // -------------------------
  function parseCsv(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve({ data: [], meta: {} });
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res),
        error: reject
      });
    });
  }

  function compactRows(rows) {
    return rows.filter(r =>
      Object.values(r).some(v => (v ?? '').toString().trim() !== '')
    );
  }

  function dedupByKey(rows, key) {
    const m = new Map();
    for (const r of rows) {
      const k = (r[key] ?? '').toString().trim();
      if (!k) continue;
      m.set(k, r); // conserva la última ocurrencia
    }
    return Array.from(m.values());
  }

  async function batchInsert(table, rows, chunkSize = 500) {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error } = await sb.from(table).insert(slice);
      if (error) throw error;
      total += slice.length;
    }
    return total;
  }

  async function batchUpsert(table, rows, conflictCol, chunkSize = 500) {
    let total = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      // Intento sin comillas
      let { error } = await sb.from(table).upsert(slice, { onConflict: conflictCol });
      if (error && /column .* does not exist/i.test(error.message)) {
        ({ error } = await sb.from(table).upsert(slice, { onConflict: `"${conflictCol}"` }));
      }
      if (error) throw error;
      total += slice.length;
    }
    return total;
  }

  // ===========================================================
  // 1) Crear Sprint (borra todo + inserta)
  // ===========================================================
  (function bindSprintForm() {
    const frm = $('#frmSprint');
    if (!frm) return;

    frm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!frm.reportValidity()) return;

      const nombre = (frm.querySelector('#spNombre')?.value || '').trim();
      const inicio = (frm.querySelector('#spInicio')?.value || '').trim();
      const fin    = (frm.querySelector('#spFin')?.value || '').trim();
      const horasStr = (frm.querySelector('#spTotalHrs')?.value ?? '').trim();
      const totalHrs = horasStr === '' ? null : Number(horasStr);

      if (!nombre || !inicio || !fin) {
        msg('Faltan datos: nombre/fecha inicio/fecha fin.', false);
        return;
      }

      const ok = confirm(
`Vas a BORRAR TODO el contenido de las tablas (excepto 'sprints' y festivos) y crear este sprint:
• Nombre: ${nombre}
• Inicio: ${inicio}
• Fin:    ${fin}
• Horas:  ${totalHrs ?? '—'}
¿Confirmas?`
      );
      if (!ok) return;

      const btn = $('#btnGuardarSprint');
      const prev = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

      try {
        const { data, error } = await sb.rpc('create_sprint_and_reset', {
          p_nombre: nombre,
          p_fecha_inicio: inicio,
          p_fecha_fin: fin,
          p_activo: true,
          p_total_hrs: totalHrs
        });

        if (error) { msg(`Error al crear sprint: ${error.message}`, false); return; }

        const idSprint = Array.isArray(data) ? data[0] : data;
        msg(`Sprint creado (id: ${idSprint}). Se limpiaron las tablas.`, true);
        frm.reset();
      } catch (e) {
        msg(`Error inesperado: ${e.message}`, false);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = prev || 'Guardar sprint'; }
      }
    });
  })();

  // ===========================================================
  // 2) Cargar Subtareas → SUBTAREASACTUAL y sincronizar
  // ===========================================================
  async function cargarSubtareasActualYSync() {
    const file = $('#csvSubtareas')?.files?.[0];
    if (!file) { msg('Selecciona un CSV de subtareas.', false); return; }

    try {
      setLoading(true);
      const res = await parseCsv(file);
      let rows = compactRows(res.data || []);

      if (!rows.length) { msg('El CSV no tiene filas.', false); return; }
      if (!res.meta?.fields?.includes('ID de Tarea')) {
        msg('El CSV de Subtareas debe tener columna "ID de Tarea".', false);
        return;
      }

      rows = dedupByKey(rows, 'ID de Tarea');
      const inserted = await batchUpsert('SUBTAREASACTUAL', rows, 'ID de Tarea', 500);
      msg(`SUBTAREASACTUAL: ${inserted} filas cargadas.`, true);

      // Ejecutar sincronización RPC
      const { data, error: errSync } = await sb.rpc('sync_subtareas_from_actual');
      if (errSync) { msg(`Error en sincronización: ${errSync.message}`, false); return; }

      const r = Array.isArray(data) ? data[0] : data;
      msg(`SUBTAREAS → inserted=${r?.inserted_count ?? 0}, updated=${r?.updated_count ?? 0}, staging_deleted=${r?.deleted_staging ?? 0}`, true);

    } catch (e) {
      msg(`Error cargando/sincronizando subtareas: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 3) Cargar Historias → directo a HISTORIAS
  // ===========================================================
  async function cargarHistoriasDirecto() {
    const file = $('#csvHistorias')?.files?.[0];
    if (!file) { msg('Selecciona un CSV de historias.', false); return; }

    try {
      setLoading(true);
      const res = await parseCsv(file);
      let rows = compactRows(res.data || []);

      if (!rows.length) { msg('El CSV no tiene filas.', false); return; }
      if (!res.meta?.fields?.includes('ID de Tarea')) {
        msg('El CSV de Historias debe tener columna "ID de Tarea".', false);
        return;
      }

      rows = dedupByKey(rows, 'ID de Tarea');
      const inserted = await batchUpsert('HISTORIAS', rows, 'ID de Tarea', 500);
      msg(`HISTORIAS: ${inserted} filas cargadas directamente.`, true);

    } catch (e) {
      msg(`Error cargando HISTORIAS: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 4) Sincronizar manual (solo Subtareas)
  // ===========================================================
  async function sincronizarSolo() {
    try {
      setLoading(true);
      const { data, error } = await sb.rpc('sync_subtareas_from_actual');
      if (error) { msg(`Error en sincronización: ${error.message}`, false); return; }
      const r = Array.isArray(data) ? data[0] : data;
      msg(`SUBTAREAS → inserted=${r?.inserted_count ?? 0}, updated=${r?.updated_count ?? 0}, staging_deleted=${r?.deleted_staging ?? 0}`, true);
    } catch (e) {
      msg(`Error en sincronización: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  // ===========================================================
  // 5) Cargar ambos y sincronizar
  // ===========================================================
  async function cargarTodoYSincronizar() {
    const ok = confirm('Se cargarán los CSV seleccionados y luego se sincronizará. ¿Continuar?');
    if (!ok) return;

    try {
      setLoading(true);
      if ($('#csvSubtareas')?.files?.length) await cargarSubtareasActualYSync();
      if ($('#csvHistorias')?.files?.length) await cargarHistoriasDirecto();
    } catch (e) {
      msg(`Error en carga+sync: ${e.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  async function cargarYMigrarHistorias() {
  const file = document.querySelector('#csvHistorias')?.files?.[0];
  if (!file) { msg('Selecciona un CSV de historias.', false); return; }

  try {
    setLoading(true);
    // 1. Parsear y limpiar CSV
    const res = await parseCsv(file);
    let rows = compactRows(res.data || []);
    if (!rows.length) { msg('El CSV no tiene filas.', false); return; }
    if (!res.meta?.fields?.includes('ID de Tarea')) {
      msg('El CSV de Historias debe tener columna "ID de Tarea".', false);
      return;
    }
    rows = dedupByKey(rows, 'ID de Tarea');

    // 2. Subir a HISTORIASACTUAL
    const inserted = await batchUpsert('HISTORIASACTUAL', rows, 'ID de Tarea', 500);
    msg(`HISTORIASACTUAL: ${inserted} filas cargadas.`, true);

    // 3. Ejecutar migración y limpieza
    const { data, error } = await sb.rpc('migrar_historias_nuevas');
    if (error) {
      msg(`Error al migrar historias: ${error.message}`, false);
      return;
    }
    msg(`Historias migradas: ${data}`, true);

  } catch (e) {
    msg(`Error cargando/migrando historias: ${e.message}`, false);
  } finally {
    setLoading(false);
  }
}
  // ===========================================================
  // Eventos UI
  // ===========================================================
  document.addEventListener('DOMContentLoaded', () => {
    $('#btnCargarSubtareas')?.addEventListener('click', cargarSubtareasActualYSync);
  $('#btnCargarHistorias')?.addEventListener('click', cargarYMigrarHistorias);
    $('#btnSincronizar')?.addEventListener('click', sincronizarSolo);
    $('#btnCargarTodo')?.addEventListener('click', cargarTodoYSincronizar);
  });

})();
