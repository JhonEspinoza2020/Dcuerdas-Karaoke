-- Rate limits genéricos por mesa (búsquedas, consultas, pedidos).
CREATE TABLE IF NOT EXISTS mesa_rate_limits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mesa_id bigint NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
  accion text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mesa_rate_limits_mesa_accion_fecha
  ON mesa_rate_limits (mesa_id, accion, creado_en DESC);

ALTER TABLE mesa_rate_limits ENABLE ROW LEVEL SECURITY;

-- Cooldown atómico de pedidos (evita TOCTOU con requests en paralelo).
CREATE TABLE IF NOT EXISTS mesa_pedido_cooldown (
  mesa_id bigint PRIMARY KEY REFERENCES mesas(id) ON DELETE CASCADE,
  ultimo_pedido_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mesa_pedido_cooldown ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_mesa_pedido_cooldown(p_mesa_id bigint, p_segundos int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed boolean;
BEGIN
  INSERT INTO mesa_pedido_cooldown (mesa_id, ultimo_pedido_en)
  VALUES (p_mesa_id, now())
  ON CONFLICT (mesa_id) DO UPDATE
    SET ultimo_pedido_en = EXCLUDED.ultimo_pedido_en
    WHERE mesa_pedido_cooldown.ultimo_pedido_en
      < now() - make_interval(secs => GREATEST(p_segundos, 1))
  RETURNING true INTO claimed;
  RETURN COALESCE(claimed, false);
END;
$$;

REVOKE ALL ON FUNCTION claim_mesa_pedido_cooldown(bigint, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_mesa_pedido_cooldown(bigint, int) FROM anon;
REVOKE ALL ON FUNCTION claim_mesa_pedido_cooldown(bigint, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_mesa_pedido_cooldown(bigint, int) TO service_role;
