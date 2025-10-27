// js/api.js
// Capa de acceso a datos (Supabase) — sin lógica de UI
window.api = window.api || {};
(function (ns) {
  const sb = window.sb; // creado en supabaseClient.js

  // ---------- SPRINTS ----------
  async function crearSprint(nombre, inicio, fin){
    const { data, error } = await sb.rpc('sp_crear_sprint', { p_nombre:nombre, p_inicio:inicio, p_fin:fin });
    if (error) throw error;
    return data;
  }
  async function listarSprints(){
    const { data, error } = await sb.from('sprint').select('*').order('id', { ascending:false });
    if (error) throw error;
    return data || [];
  }
  async function eliminarSprint(id){
    const { error } = await sb.rpc('sp_eliminar_sprint', { p_id_sprint:id });
    if (error) throw error;
    return true;
  }

 // js/api.js (reemplaza activarSprint)
async function activarSprint(idSprint){
  // desactiva todos
  let { error } = await sb.from('sprint').update({ activo: false }).neq('id', idSprint);
  if (error && error.code !== 'PGRST116') throw error;

  // activa el elegido
  ({ error } = await sb.from('sprint').update({ activo: true }).eq('id', idSprint));
  if (error) throw error;

  try { localStorage.setItem('sprint_activo', String(idSprint)); } catch(_) {}
  return true;
}



  // ---------- CARGAS / UPSERT ----------
  async function upsertHistorias(idSprint, rows){
    const { error } = await sb.rpc('sp_upsert_historias', { p_id_sprint:idSprint, p_rows: rows });
    if (error) throw error;
    return true;
  }
  async function upsertSubtareas(idSprint, rows){
    const { error } = await sb.rpc('sp_upsert_subtareas', { p_id_sprint:idSprint, p_rows: rows });
    if (error) throw error;
    return true;
  }

  // ---------- ADMIN SUBTAREAS ----------
  async function adminSubtareas(idSprint){
    const { data, error } = await sb
      .from('v_admin_subtareas')
      .select('*')
      .eq('id_sprint', idSprint);
    if (error) throw error;
    return data || [];
  }
  async function setFlags(idSubtarea, terminado, mostrar){
    const { error } = await sb.rpc('sp_set_subtarea_flags', {
      p_id_subtarea:idSubtarea, p_terminado:terminado, p_mostrar:mostrar
    });
    if (error) throw error;
    return true;
  }

  // ---------- DASHBOARD ----------
  async function kpis(idSprint){
    const { data, error } = await sb
      .from('v_dashboard_kpis')
      .select('*')
      .eq('id_sprint', idSprint)
      .maybeSingle();
    if (error) throw error;
    return data || {};
  }
  async function burndown(idSprint){
    const { data, error } = await sb
      .from('dashboard_burndown')
      .select('*')
      .eq('id_sprint', idSprint)
      .order('dia', { ascending:true });
    if (error) throw error;
    return data || [];
  }
  async function setBurndownReal(idSprint, dia, valor){
    const { error } = await sb.rpc('sp_dashboard_set_real', {
      p_id_sprint:idSprint, p_dia: dia, p_real: valor
    });
    if (error) throw error;
    return true;
  }
  async function calcEstimado(idSprint){
    const { error } = await sb.rpc('sp_dashboard_estimado', { p_id_sprint:idSprint });
    if (error) throw error;
    return true;
  }
  async function writeRealHoy(idSprint){
  const { data, error } = await sb.rpc('sp_dashboard_real_hoy', { p_id_sprint: idSprint });
  if (error) throw error;
  // El SP devuelve boolean; si por alguna razón es null, interpretamos como false
  return Boolean(data);
}

  async function avanceProyecto(idSprint){
    const { data, error } = await sb
      .from('v_avance_proyecto')
      .select('*')
      .eq('id_sprint', idSprint)
      .order('proyecto',{ascending:true});
    if (error) throw error;
    return data || [];
  }
  async function riesgoPropietario(idSprint){
    const { data, error } = await sb
      .from('v_riesgo_propietario')
      .select('*')
      .eq('id_sprint', idSprint)
      .order('en_riesgo',{ascending:false})
      .order('propietario',{ascending:true});
    if (error) throw error;
    return data || [];
  }
  async function horasTerminadasPorDia(idSprint){
    const { data, error } = await sb
      .from('v_horas_terminadas_por_dia')
      .select('fecha, horas_terminadas')
      .eq('id_sprint', idSprint)
      .order('fecha', { ascending: true });
    if (error) {
      // Si la vista aún no existe, no rompas el dashboard
      if (error.code === 'PGRST205') return [];
      throw error;
    }
    return data || [];
  }

  // ---------- HISTORIAS ----------
  // Lee desde la vista unificada actual
  async function historias(idSprint){
    const { data, error } = await sb
      .from('v_historias_plus')
      .select('*')
      .eq('id_sprint', idSprint)
      .order('nombre_lista_tareas', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  // Lista de propietarios (derivada de subtareas; evita depender de v_historias_personas)
  async function historiasPersonas(idSprint){
    const { data: his, error: e1 } = await sb
      .from('historia').select('id').eq('id_sprint', idSprint);
    if (e1) throw e1;

    const ids = (his||[]).map(h=>h.id);
    if (!ids.length) return [];

    const { data: subs, error: e2 } = await sb
      .from('subtarea')
      .select('propietario')
      .in('id_historia', ids)
      .not('propietario', 'is', null);
    if (e2) throw e2;

    return Array.from(new Set((subs||[]).map(s=>s.propietario))).sort();
  }

  async function subtareasPorHistoria(idHistoria){
    const { data, error } = await sb
      .from('v_subtareas_por_historia')
      .select('*')
      .eq('id_historia', idHistoria)
      .order('propietario',{ascending:true});
    if (error) throw error;
    return data || [];
  }
  // ---------- REVIEW / OBS HISTORIAS ----------
async function setHistoriaReview(id, status){
  const { error } = await sb.rpc('sp_set_historia_review', {
    p_id: id,
    p_status: status
  });
  if (error) throw error;
  return true;
}

async function setHistoriaObs(id, obs){
  const { error } = await sb.rpc('sp_set_historia_obs', {
    p_id: id,
    p_obs: obs
  });
  if (error) throw error;
  return true;
}



  // ---------- PRIORIDADES / MATRIZ (reusan la misma lista de owners) ----------
  // ---------- PRIORIDADES / MATRIZ (RPCs opcionales + vista opcional) ----------

  // Opcional: sincroniza prioridades en BD (si no existe el RPC, no truena)
  async function prioridadesSync(idSprint){
    const { error } = await sb.rpc('sp_prioridades_sync', { p_id_sprint: idSprint });
    if (error) {
      if (error.code === 'PGRST205') return true; // RPC no creada aún -> no-op
      throw error;
    }
    return true;
  }

  // Opcional: guarda el orden de prioridades (si tu UI lo usa)
  // items: [{ id_historia, orden }, ...]
  async function prioridadesSave(idSprint, owner, items){
    const { error } = await sb.rpc('sp_prioridades_save', {
      p_id_sprint: idSprint, p_propietario: owner, p_items: items
    });
    if (error) {
      if (error.code === 'PGRST205') return true; // RPC no creada aún -> no-op
      throw error;
    }
    return true;
  }

  async function getSprintActivo(){
  const { data, error } = await sb
    .from('sprint')
    .select('id,nombre,fecha_inicio,fecha_fin')
    .eq('activo', true)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error; // 116 = no rows
  return data || null;
}


  // Requerida por ui.matriz.js: intenta vista v_matriz_prioridades; si no existe, devuelve []
 // Reemplaza TODA esta función en js/api.js
async function matrizList(idSprint, owner = null){
  // 1) Intento: vista v_matriz_prioridades (si existe)
  try {
    let q = sb.from('v_matriz_prioridades')
      .select('id_historia,nombre_tarea,proyecto,propietario,horas_pendientes,cuadrante')
      .eq('id_sprint', idSprint);

    if (owner) q = q.eq('propietario', owner);

    const { data, error } = await q
      .order('cuadrante', { ascending: true })
      .order('horas_pendientes', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (e) {
    // 2) Fallback: derivamos desde v_historias_plus y ponemos cuadrante 'q4' por defecto
    if (e && (e.code === 'PGRST205' || e.message?.includes('Could not find the table'))) {
      let q2 = sb.from('v_historias_plus')
        .select('id_historia,nombre_tarea,proyecto,dev_pend_horas,qa_pend_horas,_owners')
        .eq('id_sprint', idSprint);

      if (owner) q2 = q2.contains('_owners', [owner]); // si _owners es arreglo
      const { data: fallback, error: e2 } = await q2;
      if (e2) throw e2;

      return (fallback || []).map(r => ({
        id_historia: r.id_historia,
        nombre_tarea: r.nombre_tarea,
        proyecto: r.proyecto,
        propietario: Array.isArray(r._owners) && r._owners.length ? r._owners[0] : null,
        horas_pendientes: Number(r.dev_pend_horas||0) + Number(r.qa_pend_horas||0),
        cuadrante: 'q4' // por defecto
      }));
    }
    throw e;
  }
}



  // Opcional: setear cuadrante (si tienes RPC en BD; si no, no truena)
  async function matrizSetQuadrant(idHistoria, cuadrante){
    const { error } = await sb.rpc('sp_matriz_set_quadrant', {
      p_id_historia: idHistoria, p_cuadrante: cuadrante
    });
    if (error) {
      if (error.code === 'PGRST205') return true; // RPC no creada aún -> no-op
      throw error;
    }
    return true;
  }


  // --- ALIASES QUE FALTAN ---
async function matrizOwners(idSprint){
  // reutiliza la lógica ya probada
  return await historiasPersonas(idSprint);
}

async function prioridadesList(idSprint){
  // por compatibilidad con otras UIs
  return await historiasPersonas(idSprint);
}

// js/api.js (al final del bloque de SPRINTS, junto a getSprintActivo)
async function getActiveSprintId(){
  // 1) Siempre consultar BD
  const activo = await getSprintActivo();
  if (activo?.id) {
    try { localStorage.setItem('sprint_activo', String(activo.id)); } catch(_) {}
    return Number(activo.id);
  }
  // 2) Fallback (caché): si BD no tiene activo, último localStorage
  const id = Number(localStorage.getItem('sprint_activo') || 0);
  return id || 0;
}

// prueba rápida:
api.getActiveSprintId && api.getActiveSprintId().then(console.log)  // debería imprimir un ID
api.getSprintActivo && api.getSprintActivo().then(console.log)      // debería traer nombre/fechas


  // ---------- EXPORT ----------
  Object.assign(ns, {
    // sprints
    crearSprint, listarSprints, eliminarSprint,
    // cargas
    upsertHistorias, upsertSubtareas,
    // admin
    adminSubtareas, setFlags,
    // dashboard
    kpis, burndown, setBurndownReal, calcEstimado, writeRealHoy,
    avanceProyecto, riesgoPropietario, horasTerminadasPorDia,
    // historias
    historias, historiasPersonas, subtareasPorHistoria,
    setHistoriaReview, setHistoriaObs,
    // prioridades / matriz
    prioridadesSync, prioridadesSave,
    matrizList, matrizSetQuadrant,
    matrizOwners, prioridadesList,activarSprint,getSprintActivo,getActiveSprintId
     
  });
})(window.api);

// Alias global para scripts que hacen "api.*"
var api = window.api;
