-- Pedidos de cocina desde el cliente móvil
CREATE TABLE pedidos (
    id              SERIAL PRIMARY KEY,
    mesa_id         INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    nombre_cliente  VARCHAR(80) NOT NULL,
    num_personas    INTEGER CHECK (num_personas > 0 AND num_personas <= 20),
    nota_cocina     TEXT,
    telefono        VARCHAR(20),
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pedido_items (
    id          SERIAL PRIMARY KEY,
    pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    plato_id    INTEGER NOT NULL REFERENCES platos(id) ON DELETE RESTRICT,
    plato_nombre VARCHAR(150) NOT NULL,
    cantidad    INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0 AND cantidad <= 20),
    nota        VARCHAR(200)
);

CREATE INDEX idx_pedidos_mesa ON pedidos(mesa_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_pedidos_creado ON pedidos(creado_en DESC);

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;

-- Solo el backend (Edge Functions) inserta pedidos
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
