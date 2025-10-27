// cvs.js
// Lectura CSV y mapeos (Ignora fila de encabezados y limpia valores)
window.csvmap = (function(){
  // --- Helpers ---
  function clean(v){
    const s = (v || '').toString().trim();
    return (s === '-' ? '' : s);
  }

  // Parser CSV → array de objetos
  function parse(file){
    return new Promise((resolve, reject)=>{
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res)=> {
          // elimina filas vacías
          const data = res.data.filter(row =>
            Object.values(row || {}).some(v => (v && String(v).trim() !== ''))
          );
          resolve(data);
        },
        error: reject
      });
    });
  }

  // Extrae descripción con nombres de columna flexibles
  function pickDesc(row){
    const keys = Object.keys(row);
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

    for (const key of keys) {
      if (candidates.includes(key)) {
        const v = (row[key] ?? '').toString().trim();
        return v === '' || v === '-' ? null : v;
      }
    }
    return null;
  }

  // --- Mapeo de historias ---
  function mapHistorias(rows){
    return rows.map(r => ({
      id_externo: clean(r['ID de Tarea'] || r['id_externo']),
      nombre_tarea: clean(r['Nombre de Tarea'] || r['Nombre'] || r['Task Name']),
      nombre_lista_tareas: clean(r['Nombre de la lista de tareas'] || r['Proyecto'] || r['List Name']),
      propietario: clean(r['Propietario']),
      estado_pers: clean(r['Estado personalizado'] || r['Estado'] || r['Status']),
      duracion_txt: clean(r['Duración'] || r['Duracion'] || r['Duration']),
      descripcion: pickDesc(r)
    }));
  }

  // --- Mapeo de subtareas ---
  function mapSubtareas(rows){
    return rows.map(r => ({
      id_historia_externo: clean(r['ID de Tarea principal'] || r['id_historia_externo']),
      id_externo: clean(r['ID de Tarea'] || r['ID'] || r['id_externo']),
      propietario: clean(r['Propietario']),
      nombre_tarea: clean(r['Nombre de Tarea'] || r['Nombre'] || r['Task Name']),
      estado_pers: clean(r['Estado personalizado'] || r['Estado'] || r['Status']),
      duracion_txt: clean(r['Duración'] || r['Duracion'] || r['Duration']),
      fecha_terminacion_txt: clean(r['Fecha de terminación'] || r['Fecha de terminacion'])
    }));
  }

  // --- Export ---
  return { parse, mapHistorias, mapSubtareas };
})();
