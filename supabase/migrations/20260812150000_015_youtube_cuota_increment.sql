-- Incremento atómico del contador diario (evita upsert JS silencioso).
CREATE OR REPLACE FUNCTION public.increment_youtube_cuota_dia(
  p_dia date,
  p_clave text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  INSERT INTO youtube_cuota_dia (dia, busquedas_api, por_clave, actualizado_en)
  VALUES (
    p_dia,
    1,
    CASE
      WHEN p_clave IS NOT NULL AND length(trim(p_clave)) > 0
      THEN jsonb_build_object(p_clave, 1)
      ELSE '{}'::jsonb
    END,
    now()
  )
  ON CONFLICT (dia) DO UPDATE SET
    busquedas_api = youtube_cuota_dia.busquedas_api + 1,
    por_clave = CASE
      WHEN p_clave IS NOT NULL AND length(trim(p_clave)) > 0 THEN
        jsonb_set(
          COALESCE(youtube_cuota_dia.por_clave, '{}'::jsonb),
          ARRAY[p_clave],
          to_jsonb(COALESCE((youtube_cuota_dia.por_clave ->> p_clave)::integer, 0) + 1),
          true
        )
      ELSE youtube_cuota_dia.por_clave
    END,
    actualizado_en = now()
  RETURNING busquedas_api INTO v_total;

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_youtube_cuota_dia(date, text) TO service_role;

-- Reparar contador de hoy: 2 search.list reales (agua marina, hermanos yaipen).
INSERT INTO youtube_cuota_dia (dia, busquedas_api, por_clave, actualizado_en)
VALUES (
  (timezone('America/Lima', now()))::date,
  2,
  '{"k2e6e0bb": 2}'::jsonb,
  now()
)
ON CONFLICT (dia) DO UPDATE SET
  busquedas_api = GREATEST(youtube_cuota_dia.busquedas_api, EXCLUDED.busquedas_api),
  por_clave = CASE
    WHEN youtube_cuota_dia.busquedas_api < EXCLUDED.busquedas_api THEN EXCLUDED.por_clave
    ELSE youtube_cuota_dia.por_clave
  END,
  actualizado_en = now();
