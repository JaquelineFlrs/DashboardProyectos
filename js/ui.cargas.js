// js/ui.cargas.js
// Reimportar CSVs preservando flags (upsert diario)
window.uiCargas = (function(){
  let archivos = { h:null, s:null };

  // --- Helpers en ámbito de módulo ---
  function parseCSV(file){
    return new Promise((resolve, reject)=>{
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: h => (h || '').trim(),
        complete: res => resolve(res.data || []),
        error: err => reject(err)
      });
    });
  }

  // Detecta "Descripción" en múltiples variantes
  function pickDesc(row){
    const candidates = [
      'descripcion',
      'Descripción',
      'description',
      'Description',
      'Task Description',
      'Notas',
      'Descripción del Tarea',
      'Descripción de la Tarea',
      'Descripcion del Tarea',
      'Descripcion de la Tarea'
    ];
    for (const k of candidates){
      if (Object.prototype.hasOwnProperty.call(row, k)) {
        const v = (row[k] ?? '').toString().trim();
        return (v === '' || v === '-') ? null : v;
      }
    }
    return null;
  }

  // Mapeo de Historias (diario)
  function mapHistoriaRowDaily(row){
    return {
      id_externo: row['ID de Tarea'] || row['id_externo'] || row['ID'] || null,
      nombre_tarea: row['Nombre de Tarea'] || row['Nombre'] || row['Task Name'] || null,
      nombre_lista_tareas: row['Nombre de la lista de tareas'] || row['Proyecto'] || row['List Name'] || null,
      estado_pers: row['Estado personalizado'] || row['Estado'] || row['Status'] || null,
      duracion_txt: row['Duración'] || row['Duracion'] || row['Duration'] || null,
      descripcion: pickDesc(row)
    };
  }

  // Mapeo de Subtareas (diario)
  function mapSubtareaRowDaily(row){
    return {
      id_externo: row['ID de Tarea'] || row['ID'] || row['id_externo'] || null,
      id_historia_externo: row['ID de Tarea principal'] || row['ID Padre'] || row['id_historia_externo'] || null,
      nombre_tarea: row['Nombre de Tarea'] || row['Subtarea'] || row['Task Name'] || null,
      propietario: row['Propietario'] || row['Owner'] || null,
      estado_pers: row['Estado personalizado'] || row['Estado'] || row['Status'] || null,
      duracion_txt: row['Duración'] || row['Duracion'] || row['Duration'] || null,
      fecha_terminacion_txt: (row['Fecha de terminación'] || row['Fecha de terminacion'] || row['Completion Date'] || '').toString().trim() || null
    };
  }

  async function procesar(){
    const idSprint = await api.getActiveSprintId();
    if(!idSprint){ alert('Selecciona un sprint activo antes de cargar.'); return; }

    try{
      // Historias
      if(archivos.h){
        const rowsH = await parseCSV(archivos.h);
        const mappedH = rowsH.map(mapHistoriaRowDaily).filter(r => r.id_externo);
        if(mappedH.length){
          await api.upsertHistorias(idSprint, mappedH);
          console.log(`Historias upsert: ${mappedH.length}`);
        } else {
          console.warn('CSV Historias sin filas válidas (id_externo faltante).');
        }
      }

      // Subtareas
      if(archivos.s){
        const rowsS = await parseCSV(archivos.s);
        const mappedS = rowsS.map(mapSubtareaRowDaily).filter(r => r.id_externo && r.id_historia_externo);
        if(mappedS.length){
          await api.upsertSubtareas(idSprint, mappedS);
          console.log(`Subtareas upsert: ${mappedS.length}`);
        } else {
          console.warn('CSV Subtareas sin filas válidas (id_externo / id_historia_externo faltante).');
        }
      }

      alert('Cargas diarias procesadas.');
    }catch(err){
      console.error(err);
      alert('Error al procesar cargas: ' + (err.message || err));
    }
  }

  function bind(){
    // Archivos
    $(document).off('change', '#csv-historias-diario')
      .on('change', '#csv-historias-diario', e=> archivos.h = e.target.files?.[0] || null);
    $(document).off('change', '#csv-subtareas-diario')
      .on('change', '#csv-subtareas-diario', e=> archivos.s = e.target.files?.[0] || null);

    // Botón procesar (un solo handler)
    $(document).off('click', '#btn-cargar-diario')
      .on('click', '#btn-cargar-diario', procesar);
  }

  function init(){ bind(); }
  return { init };
})();
