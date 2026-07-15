-- Videos que YouTube no deja embeber en el local (aprendidos en runtime).
CREATE TABLE IF NOT EXISTS youtube_bloqueados (
  video_id VARCHAR(20) PRIMARY KEY,
  motivo TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_youtube_bloqueados_creado
  ON youtube_bloqueados (creado_en DESC);

ALTER TABLE youtube_bloqueados ENABLE ROW LEVEL SECURITY;
