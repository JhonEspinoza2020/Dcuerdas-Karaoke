-- Rate limit persistente para mutaciones sensibles del panel admin.
CREATE TABLE IF NOT EXISTS admin_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  actor TEXT NOT NULL,
  accion TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_rate_limits_actor_accion_fecha
  ON admin_rate_limits (actor, accion, creado_en DESC);

ALTER TABLE admin_rate_limits ENABLE ROW LEVEL SECURITY;

-- Defensa adicional en BD: máximo tres cifras enteras en soles.
ALTER TABLE platos DROP CONSTRAINT IF EXISTS platos_precio_rango;
ALTER TABLE platos
  ADD CONSTRAINT platos_precio_rango CHECK (precio > 0 AND precio <= 999.99);
