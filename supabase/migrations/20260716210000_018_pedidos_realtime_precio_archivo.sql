-- Pedidos en vivo + precio histórico + archivo de historial
ALTER TABLE pedido_items
  ADD COLUMN IF NOT EXISTS precio_unitario numeric(10,2) NOT NULL DEFAULT 0;

UPDATE pedido_items pi
SET precio_unitario = COALESCE(p.precio, 0)
FROM platos p
WHERE pi.plato_id = p.id
  AND (pi.precio_unitario IS NULL OR pi.precio_unitario = 0);

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS archivado_en timestamptz;

CREATE INDEX IF NOT EXISTS idx_pedidos_archivado_en ON pedidos (archivado_en);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_creado ON pedidos (estado, creado_en DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedidos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pedido_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pedido_items;
  END IF;
END $$;
