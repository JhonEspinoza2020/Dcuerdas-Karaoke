-- Quitar Box Karaoke (mesa 13); solo quedan las 12 mesas normales.
UPDATE cola_reproduccion SET estado = 'completada'
WHERE mesa_id IN (SELECT id FROM mesas WHERE numero_mesa = 13 OR tipo = 'karaoke');

DELETE FROM mesas WHERE numero_mesa = 13 OR tipo = 'karaoke';
