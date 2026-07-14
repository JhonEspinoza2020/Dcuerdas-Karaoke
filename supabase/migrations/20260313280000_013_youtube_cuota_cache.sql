-- Aciertos: las búsquedas populares viven más tiempo en caché.
ALTER TABLE youtube_cache
  ADD COLUMN IF NOT EXISTS aciertos INTEGER NOT NULL DEFAULT 0;

-- Contador diario de búsquedas que SÍ gastan cuota YouTube (search.list).
CREATE TABLE IF NOT EXISTS youtube_cuota_dia (
  dia            DATE PRIMARY KEY DEFAULT (timezone('America/Lima', now())::date),
  busquedas_api  INTEGER NOT NULL DEFAULT 0,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rate limit por mesa: evita spam de teclado → muchas search.list.
CREATE TABLE IF NOT EXISTS youtube_rate_mesa (
  mesa_id        INTEGER PRIMARY KEY,
  ultima_api_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE youtube_cuota_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE youtube_rate_mesa ENABLE ROW LEVEL SECURITY;
-- Sin políticas públicas: solo service role (Edge Functions)
