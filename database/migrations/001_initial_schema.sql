-- D'cuerdas Resto-Bar — Migración inicial
-- 12 mesas · Karaoke por QR
-- Ejecutar: psql -U dcuerdas -d dcuerdas_karaoke -f 001_initial_schema.sql

BEGIN;

CREATE TYPE estado_cola AS ENUM ('pendiente', 'reproduciendo', 'completada');

CREATE TABLE mesas (
    id              SERIAL PRIMARY KEY,
    numero_mesa     INTEGER NOT NULL UNIQUE,
    token_seguridad VARCHAR(64) NOT NULL,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cola_reproduccion (
    id               SERIAL PRIMARY KEY,
    mesa_id          INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    youtube_video_id VARCHAR(20) NOT NULL,
    titulo_cancion   VARCHAR(255) NOT NULL,
    nombre_cliente   VARCHAR(80) NOT NULL,
    saludo           TEXT,
    estado           estado_cola NOT NULL DEFAULT 'pendiente',
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cola_estado ON cola_reproduccion(estado);
CREATE INDEX idx_cola_mesa_id ON cola_reproduccion(mesa_id);
CREATE INDEX idx_cola_creado_en ON cola_reproduccion(creado_en);
CREATE INDEX idx_cola_pendientes ON cola_reproduccion(estado, creado_en)
    WHERE estado IN ('pendiente', 'reproduciendo');

-- 12 mesas D'cuerdas — un QR único por mesa
-- IMPORTANTE: regenerar tokens en producción con scripts/generar_tokens_mesas.py
INSERT INTO mesas (numero_mesa, token_seguridad) VALUES
    (1,  'dc-mesa-01-token-cambiar-en-produccion'),
    (2,  'dc-mesa-02-token-cambiar-en-produccion'),
    (3,  'dc-mesa-03-token-cambiar-en-produccion'),
    (4,  'dc-mesa-04-token-cambiar-en-produccion'),
    (5,  'dc-mesa-05-token-cambiar-en-produccion'),
    (6,  'dc-mesa-06-token-cambiar-en-produccion'),
    (7,  'dc-mesa-07-token-cambiar-en-produccion'),
    (8,  'dc-mesa-08-token-cambiar-en-produccion'),
    (9,  'dc-mesa-09-token-cambiar-en-produccion'),
    (10, 'dc-mesa-10-token-cambiar-en-produccion'),
    (11, 'dc-mesa-11-token-cambiar-en-produccion'),
    (12, 'dc-mesa-12-token-cambiar-en-produccion');

COMMIT;
