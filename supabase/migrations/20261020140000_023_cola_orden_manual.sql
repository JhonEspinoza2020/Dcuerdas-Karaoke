-- Orden manual de la cola (admin). Las nuevas van al final; el admin puede subir/bajar.
CREATE SEQUENCE IF NOT EXISTS cola_reproduccion_orden_seq;

ALTER TABLE cola_reproduccion
  ADD COLUMN IF NOT EXISTS orden INTEGER;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS n
  FROM cola_reproduccion
  WHERE estado IN ('pendiente', 'reproduciendo')
)
UPDATE cola_reproduccion c
SET orden = ranked.n
FROM ranked
WHERE c.id = ranked.id
  AND c.orden IS NULL;

SELECT setval(
  'cola_reproduccion_orden_seq',
  GREATEST(COALESCE((SELECT MAX(orden) FROM cola_reproduccion), 1), 1)
);

ALTER TABLE cola_reproduccion
  ALTER COLUMN orden SET DEFAULT nextval('cola_reproduccion_orden_seq');

ALTER SEQUENCE cola_reproduccion_orden_seq OWNED BY cola_reproduccion.orden;

CREATE INDEX IF NOT EXISTS idx_cola_orden_activa
  ON cola_reproduccion (orden)
  WHERE estado IN ('pendiente', 'reproduciendo');

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
    c.creado_en,
    c.orden
FROM cola_reproduccion c
JOIN mesas m ON m.id = c.mesa_id
WHERE c.estado IN ('pendiente', 'reproduciendo');

GRANT SELECT ON cola_publica TO anon, authenticated;
