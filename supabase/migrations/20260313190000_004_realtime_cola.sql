-- Realtime + políticas para arquitectura Supabase Backend
ALTER PUBLICATION supabase_realtime ADD TABLE cola_reproduccion;

-- La cola activa es visible para TV y clientes (sin exponer tokens de mesa)
CREATE POLICY "cola_lectura_activa"
    ON cola_reproduccion FOR SELECT
    TO anon, authenticated
    USING (estado IN ('pendiente', 'reproduciendo'));

-- Vista pública con número de mesa (sin token)
CREATE OR REPLACE VIEW cola_publica AS
SELECT
    c.id,
    c.mesa_id,
    m.numero_mesa,
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
