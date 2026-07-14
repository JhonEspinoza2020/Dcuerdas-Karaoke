-- Distingue mesas normales (música ambiental) del Box Karaoke (cantar)
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'mesa';
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS etiqueta TEXT;
ALTER TABLE mesas DROP CONSTRAINT IF EXISTS mesas_tipo_check;
ALTER TABLE mesas ADD CONSTRAINT mesas_tipo_check CHECK (tipo IN ('mesa', 'karaoke'));

-- Zona extra: Box privado de karaoke (su propio QR)
INSERT INTO mesas (numero_mesa, token_seguridad, tipo, etiqueta)
VALUES (13, 'dc-box-karaoke-token-cambiar-en-produccion', 'karaoke', 'Box Karaoke')
ON CONFLICT (numero_mesa) DO NOTHING;

-- La vista pública expone etiqueta y tipo para la TV
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
    c.estado,
    c.creado_en
FROM cola_reproduccion c
JOIN mesas m ON m.id = c.mesa_id
WHERE c.estado IN ('pendiente', 'reproduciendo')
ORDER BY c.creado_en ASC;

GRANT SELECT ON cola_publica TO anon, authenticated;
