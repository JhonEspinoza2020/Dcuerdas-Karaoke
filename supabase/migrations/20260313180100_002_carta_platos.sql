-- Synced with Supabase migration: 002_carta_platos
CREATE TABLE categorias_carta (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden       INTEGER NOT NULL DEFAULT 0,
    activa      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platos (
    id             SERIAL PRIMARY KEY,
    categoria_id   INTEGER NOT NULL REFERENCES categorias_carta(id) ON DELETE RESTRICT,
    nombre         VARCHAR(150) NOT NULL,
    descripcion    TEXT,
    precio         NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    imagen_url     VARCHAR(500),
    disponible     BOOLEAN NOT NULL DEFAULT TRUE,
    destacado      BOOLEAN NOT NULL DEFAULT FALSE,
    orden          INTEGER NOT NULL DEFAULT 0,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platos_categoria ON platos(categoria_id);
CREATE INDEX idx_platos_disponible ON platos(disponible);
CREATE INDEX idx_categorias_orden ON categorias_carta(orden);

INSERT INTO categorias_carta (nombre, descripcion, orden) VALUES
    ('Entradas', 'Para compartir y abrir el apetito', 1),
    ('Platos Fuertes', 'Nuestras especialidades de la casa', 2),
    ('Bebidas', 'Refrescos, cervezas y cócteles', 3),
    ('Postres', 'El broche de oro', 4);
