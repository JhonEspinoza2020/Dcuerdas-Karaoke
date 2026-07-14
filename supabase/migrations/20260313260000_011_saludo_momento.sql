-- Momento del saludo: al inicio o al final de la canción
ALTER TABLE cola_reproduccion
  ADD COLUMN IF NOT EXISTS saludo_momento TEXT NOT NULL DEFAULT 'inicio';

ALTER TABLE cola_reproduccion
  DROP CONSTRAINT IF EXISTS cola_reproduccion_saludo_momento_check;

ALTER TABLE cola_reproduccion
  ADD CONSTRAINT cola_reproduccion_saludo_momento_check
  CHECK (saludo_momento IN ('inicio', 'final'));

DROP VIEW IF EXISTS cola_publica;
CREATE VIEW cola_publica AS
SELECT
    c.id,
    c.mesa_id,
    m.numero_mesa,
    m.etiqueta,
    m.tipo,
    c.youtube_video_id,
    c.titulo_cancion,
    c.nombre_cliente,
    c.saludo,
    c.saludo_momento,
    c.estado,
    c.creado_en
FROM cola_reproduccion c
JOIN mesas m ON m.id = c.mesa_id
WHERE c.estado IN ('pendiente', 'reproduciendo')
ORDER BY c.creado_en ASC;

GRANT SELECT ON cola_publica TO anon, authenticated;
