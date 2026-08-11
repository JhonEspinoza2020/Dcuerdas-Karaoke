-- Limpieza operativa mensual (rate limits, cola antigua, caché YouTube vencida).
-- No borra visitas/pedidos recientes. Invocar: SELECT * FROM limpiar_datos_operativos();

CREATE OR REPLACE FUNCTION public.limpiar_datos_operativos(
  p_dias_rate int DEFAULT 7,
  p_dias_cola int DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_mesa_rate bigint := 0;
  n_admin_rate bigint := 0;
  n_cola bigint := 0;
  n_cache bigint := 0;
BEGIN
  DELETE FROM mesa_rate_limits
  WHERE creado_en < now() - make_interval(days => GREATEST(p_dias_rate, 1));
  GET DIAGNOSTICS n_mesa_rate = ROW_COUNT;

  IF to_regclass('public.admin_rate_limits') IS NOT NULL THEN
    DELETE FROM admin_rate_limits
    WHERE creado_en < now() - make_interval(days => GREATEST(p_dias_rate, 1));
    GET DIAGNOSTICS n_admin_rate = ROW_COUNT;
  END IF;

  DELETE FROM cola_reproduccion
  WHERE estado = 'completada'
    AND creado_en < now() - make_interval(days => GREATEST(p_dias_cola, 1));
  GET DIAGNOSTICS n_cola = ROW_COUNT;

  DELETE FROM youtube_cache
  WHERE expira_en < now()
     OR creado_en < now() - interval '30 days';
  GET DIAGNOSTICS n_cache = ROW_COUNT;

  RETURN jsonb_build_object(
    'mesa_rate_limits', n_mesa_rate,
    'admin_rate_limits', n_admin_rate,
    'cola_completada', n_cola,
    'youtube_cache', n_cache,
    'ejecutado_en', now()
  );
END;
$$;

COMMENT ON FUNCTION public.limpiar_datos_operativos(int, int) IS
  'Borra rate limits viejos, cola completada antigua y youtube_cache vencida. No afecta visitas/pedidos.';

REVOKE ALL ON FUNCTION public.limpiar_datos_operativos(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.limpiar_datos_operativos(int, int) TO service_role;
