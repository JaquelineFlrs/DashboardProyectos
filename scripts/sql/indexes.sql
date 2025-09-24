-- Suggested indexes to speed up dashboard queries
CREATE INDEX IF NOT EXISTS idx_subtareas_mostrar           ON public."SUBTAREAS"("Mostrar");
CREATE INDEX IF NOT EXISTS idx_subtareas_fecha_terminacion ON public."SUBTAREAS"("Fecha de terminación");
CREATE INDEX IF NOT EXISTS idx_subtareas_estado            ON public."SUBTAREAS"("Estado personalizado");
CREATE INDEX IF NOT EXISTS idx_subtareas_id_tarea_princ    ON public."SUBTAREAS"("ID de Tarea principal");
CREATE INDEX IF NOT EXISTS idx_historias_lista             ON public."HISTORIAS"("Nombre de la lista de tareas");
CREATE INDEX IF NOT EXISTS idx_hist_id_tarea               ON public."HISTORIAS"("ID de Tarea");