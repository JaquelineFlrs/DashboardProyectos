-- Consolidated views for Sprint Dashboard
-- Use: psql -f create_views_clean.sql (or run in Supabase SQL editor)
-- All views use CREATE OR REPLACE for idempotent deploys

CREATE OR REPLACE VIEW public.vw_subtareas_visibles AS
SELECT
  "Nombre de Tarea",
  "Hora de creación",
  "Tipo de tarea",
  "Propietario",
  "Estado personalizado",
  "Duración",
  "Fecha de terminación",
  "ID de Tarea principal",
  "ID de Tarea",
  es_nuevo,
  duracion_modificada_run,
  "Mostrar"
FROM public."SUBTAREAS"
WHERE "Mostrar" = 0;

CREATE OR REPLACE VIEW public.v_subtareas AS
SELECT
  s."Nombre de Tarea",
  s."Hora de creación",
  s."Tipo de tarea",
  s."Propietario",
  s."Estado personalizado",
  s."Duración",
  s."Fecha de terminación",
  s."ID de Tarea principal",
  s."ID de Tarea",
  s.es_nuevo,
  s.duracion_modificada_run,
  s."Mostrar",
  s.fecha_cierre_marcada,
  s.id,
  s.terminada_fecha,
  COALESCE(s.terminada_fecha, s."Fecha de terminación") AS fecha_final,
  COALESCE(s.terminada_fecha, s."Fecha de terminación") IS NOT NULL AS terminada
FROM public."SUBTAREAS" s;

CREATE OR REPLACE VIEW public.vw_total_hrs_por_subtarea AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
)
SELECT
  st."ID de Tarea" AS id_subtarea,
  st."Propietario" AS propietario,
  st."Estado personalizado" AS estado,
  to_num_safe(st."Duración") AS horas_subtarea
FROM public.vw_subtareas_visibles st
CROSS JOIN s
WHERE st."Fecha de terminación" IS NULL
   OR st."Fecha de terminación" >= s.fecha_inicio;

CREATE OR REPLACE VIEW public.vw_total_hrs_por_hu AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
)
SELECT
  h."ID de Tarea" AS id_hu,
  COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total_horas_hu
FROM s
CROSS JOIN public."HISTORIAS" h
JOIN public.vw_subtareas_visibles st
  ON st."ID de Tarea principal" = h."ID de Tarea"
WHERE st."Fecha de terminación" IS NULL
   OR st."Fecha de terminación" >= s.fecha_inicio
GROUP BY h."ID de Tarea"
ORDER BY total_horas_hu DESC NULLS LAST;

CREATE OR REPLACE VIEW public.vw_pct_avance_sprint AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
)
SELECT
  CASE WHEN total = 0::numeric THEN 0::numeric
       ELSE ROUND(100.0 * cerradas / total, 2)
  END AS pct_avance
FROM (
  SELECT
    COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total,
    COALESCE(SUM(to_num_safe(st."Duración"))
      FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
        'DEV - Completado: Desarrollo finalizado'::text,
        'QA - Completado: Pruebas finalizadas'::text
      ])), 0::numeric) AS cerradas
  FROM public.vw_subtareas_visibles st
  CROSS JOIN s
  WHERE st."Fecha de terminación" IS NULL
     OR st."Fecha de terminación" >= s.fecha_inicio
) x;

CREATE OR REPLACE VIEW public.vw_totales_sprint AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
),
base AS (
  SELECT COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total_x_sub
  FROM public.vw_subtareas_visibles st
  CROSS JOIN s
  WHERE st."Fecha de terminación" IS NULL
     OR st."Fecha de terminación" >= s.fecha_inicio
),
pend AS (
  SELECT COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total_pendientes
  FROM public.vw_subtareas_visibles st
  CROSS JOIN s
  WHERE (st."Fecha de terminación" IS NULL OR st."Fecha de terminación" >= s.fecha_inicio)
    AND st."Estado personalizado" = ANY (ARRAY[
      'DEV - En progreso: Desarrollo en curso'::text,
      'DEV - Pendiente: Tarea asignada pero aún no iniciada'::text,
      'QA - En pruebas: Testeo en curso'::text,
      'QA - Pendiente: Listo para pruebas pero no iniciado'::text
    ])
),
term AS (
  SELECT COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total_terminadas
  FROM public.vw_subtareas_visibles st
  CROSS JOIN s
  WHERE (st."Fecha de terminación" IS NULL OR st."Fecha de terminación" >= s.fecha_inicio)
    AND st."Estado personalizado" = ANY (ARRAY[
      'DEV - Completado: Desarrollo finalizado'::text,
      'QA - Completado: Pruebas finalizadas'::text
    ])
)
SELECT
  s.fecha_inicio,
  b.total_x_sub,
  t.total_terminadas,
  p.total_pendientes,
  CASE WHEN b.total_x_sub = 0::numeric THEN 0::numeric
       ELSE ROUND(100.0 * t.total_terminadas / b.total_x_sub, 2)
  END AS pct_avance
FROM s, base b, pend p, term t;

CREATE OR REPLACE VIEW public.vw_avance_por_lista AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
)
SELECT
  h."Nombre de la lista de tareas" AS lista,
  COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total,
  COALESCE(SUM(to_num_safe(st."Duración"))
           FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
             'DEV - Completado: Desarrollo finalizado'::text,
             'QA - Completado: Pruebas finalizadas'::text
           ])), 0::numeric) AS terminadas,
  CASE
    WHEN COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) = 0::numeric THEN 0::numeric
    ELSE ROUND(
      100.0 * COALESCE(SUM(to_num_safe(st."Duración"))
        FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
          'DEV - Completado: Desarrollo finalizado'::text,
          'QA - Completado: Pruebas finalizadas'::text
        ])), 0::numeric)
      / COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric),
      2
    )
  END AS pct_avance
FROM public."HISTORIAS" h
JOIN public.vw_subtareas_visibles st
  ON st."ID de Tarea principal" = h."ID de Tarea"
CROSS JOIN s
WHERE st."Fecha de terminación" IS NULL
   OR st."Fecha de terminación" >= s.fecha_inicio
GROUP BY h."Nombre de la lista de tareas"
ORDER BY pct_avance DESC NULLS LAST, total DESC NULLS LAST;

CREATE OR REPLACE VIEW public.vw_totales_por_propietario AS
WITH s AS (
  SELECT fecha_inicio
  FROM public.sprints
  WHERE activo = TRUE
  LIMIT 1
)
SELECT
  st."Propietario" AS propietario,
  COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) AS total,
  COALESCE(SUM(to_num_safe(st."Duración"))
    FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
      'DEV - Completado: Desarrollo finalizado'::text,
      'QA - Completado: Pruebas finalizadas'::text
    ])), 0::numeric) AS terminadas,
  COALESCE(SUM(to_num_safe(st."Duración"))
    FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
      'DEV - En progreso: Desarrollo en curso'::text,
      'DEV - Pendiente: Tarea asignada pero aún no iniciada'::text,
      'QA - En pruebas: Testeo en curso'::text,
      'QA - Pendiente: Listo para pruebas pero no iniciado'::text
    ])), 0::numeric) AS pendientes,
  CASE
    WHEN COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric) = 0::numeric THEN 0::numeric
    ELSE ROUND(
      100.0 * COALESCE(SUM(to_num_safe(st."Duración"))
        FILTER (WHERE st."Estado personalizado" = ANY (ARRAY[
          'DEV - Completado: Desarrollo finalizado'::text,
          'QA - Completado: Pruebas finalizadas'::text
        ])), 0::numeric)
      / COALESCE(SUM(to_num_safe(st."Duración")), 0::numeric),
      2
    )
  END AS pct_avance
FROM public.vw_subtareas_visibles st
CROSS JOIN s
WHERE st."Fecha de terminación" IS NULL
   OR st."Fecha de terminación" >= s.fecha_inicio
GROUP BY st."Propietario"
ORDER BY pct_avance DESC NULLS LAST, total DESC NULLS LAST;

CREATE OR REPLACE VIEW public.vw_panel_subtareas AS
SELECT
  a."ID de Tarea",
  a."Nombre de Tarea",
  a."Estado personalizado",
  a."Propietario",
  to_num_safe(a."Duración") AS "Duración",
  COALESCE(a."Mostrar"::integer, 0) AS "Mostrar"
FROM public."SUBTAREAS" a;