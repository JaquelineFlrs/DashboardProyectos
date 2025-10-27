//cvs.js
// Lectura CSV y mapeos (Ignora fila de encabezados y limpia valores)
window.csvmap = (function(){
  function clean(v){
    const s = (v || '').trim();
    return (s === '-' ? '' : s);
  }
  function parse(file){
    return new Promise((resolve, reject)=>{
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res)=> {
          const data = res.data.filter(row => Object.values(row||{}).some(v => (v && String(v).trim() !== '')));
          resolve(data);
        },
        error: reject
      });
    });
  }
  function mapHistorias(rows){
    return rows.map(r => ({
      id_externo: clean(r['ID de Tarea']),
      nombre_tarea: clean(r['Nombre de Tarea']),
      proyecto: clean(r['Nombre de la lista de tareas']),
      propietario: clean(r['Propietario']),
      estado_pers: clean(r['Estado personalizado']),
      duracion_txt: clean(r['Duración'] || r['Duracion']),
      descripcion: pickDesc(row) 
    }));
  }

  function pickDesc(row){
  // normaliza claves del CSV (quita espacios extras y respeta acentos)
  const keys = Object.keys(row);

  // busca coincidencias comunes de "descripcion"
  const candidates = [
    'descripcion',
    'Descripción',
    'description',
    'Description',
    'Task Description',
    'Notas',
    'Descripción del Tarea',     // ⬅️ tu encabezado
    'Descripción de la Tarea',   // variante frecuente
    'Descripcion del Tarea',     // sin acento
    'Descripcion de la Tarea'    // sin acento
  ];

  for (const key of keys) {
    if (candidates.includes(key)) {
      const v = (row[key] ?? '').toString().trim();
      return v === '' || v === '-' ? null : v;
    }
  }
  return null;
}


function mapHistoriaRow(row){
  return {
    id_externo: row['ID de Tarea'] || row['ID de Tarea'] || row['id_externo'],
    nombre_tarea: row['Nombre de Tarea'] || row['Nombre'] || row['Task Name'],
    nombre_lista_tareas: row['Nombre de la lista de tareas'] || row['Proyecto'] || row['List Name'],
    estado_pers: row['Estado personalizado'] || row['Estado'] || row['Status'],
    duracion_txt: row['Duración'] || row['Duracion'] || row['Duration'],
    descripcion: pickDesc(row) 
  };
}

  function mapSubtareas(rows){
    return rows.map(r => ({
      id_historia_externo: clean(r['ID de Tarea principal']),
      id_externo: clean(r['ID de Tarea'] || r['ID']),
      propietario: clean(r['Propietario']),
      nombre_tarea: clean(r['Nombre de Tarea']),
      estado_pers: clean(r['Estado personalizado']),
      duracion_txt: clean(r['Duración'] || r['Duracion']),
      fecha_terminacion_txt: clean(r['Fecha de terminación'] || r['Fecha de terminacion'])
    }));
  }
  return { parse, mapHistorias, mapSubtareas };
})();
