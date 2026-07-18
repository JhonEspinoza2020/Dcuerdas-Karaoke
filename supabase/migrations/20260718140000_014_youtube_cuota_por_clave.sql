-- Contador por API key (fingerprint) para rotar antes de agotar cuota Google (~100/día).
ALTER TABLE youtube_cuota_dia
  ADD COLUMN IF NOT EXISTS por_clave JSONB NOT NULL DEFAULT '{}'::jsonb;
