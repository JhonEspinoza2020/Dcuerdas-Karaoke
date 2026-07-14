-- Caché compartido de búsquedas YouTube (reduce cuota API)
CREATE TABLE youtube_cache (
    termino     TEXT PRIMARY KEY,
    resultados  JSONB NOT NULL,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en   TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_youtube_cache_expira ON youtube_cache (expira_en);

ALTER TABLE youtube_cache ENABLE ROW LEVEL SECURITY;
-- Sin políticas públicas: solo Edge Functions con service role
