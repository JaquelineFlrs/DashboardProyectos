-- DROP script for objects with 0 references in the dashboard code
-- Review carefully before executing in production.
BEGIN;
DROP VIEW IF EXISTS public.v_subtareas CASCADE;
DROP VIEW IF EXISTS public.vw_historial CASCADE;
DROP VIEW IF EXISTS public.vw_historias CASCADE;
DROP VIEW IF EXISTS public.vw_panel_subtareas CASCADE;
DROP VIEW IF EXISTS public.vw_pct_avance_sprint CASCADE;
DROP VIEW IF EXISTS public.vw_subtareas CASCADE;
DROP VIEW IF EXISTS public.vw_subtareas_all CASCADE;
DROP VIEW IF EXISTS public.vw_subtareas_visibles CASCADE;
DROP VIEW IF EXISTS public.vw_total_hrs_por_hu CASCADE;
DROP VIEW IF EXISTS public.vw_total_hrs_por_subtarea CASCADE;
DROP TABLE IF EXISTS public.feriados_mx CASCADE;
DROP TABLE IF EXISTS public.resumen_global_cache CASCADE;
COMMIT;