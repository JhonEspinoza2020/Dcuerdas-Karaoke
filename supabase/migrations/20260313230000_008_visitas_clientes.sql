-- Registro de visitas de clientes (llegadas y recurrencia)
CREATE TABLE visitas_clientes (
    id              SERIAL PRIMARY KEY,
    nombre_cliente  VARCHAR(80) NOT NULL,
    nombre_norm     VARCHAR(80) NOT NULL,
    mesa_id         INTEGER NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitas_nombre_norm ON visitas_clientes (nombre_norm);
CREATE INDEX idx_visitas_mesa ON visitas_clientes (mesa_id);
CREATE INDEX idx_visitas_creado ON visitas_clientes (creado_en DESC);
CREATE INDEX idx_visitas_hoy ON visitas_clientes (creado_en)
    WHERE creado_en >= CURRENT_DATE;

ALTER TABLE visitas_clientes ENABLE ROW LEVEL SECURITY;
-- Solo Edge Functions con service role

ALTER PUBLICATION supabase_realtime ADD TABLE visitas_clientes;
