-- Synced with Supabase migration: 003_enable_rls_policies
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cola_reproduccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_carta ENABLE ROW LEVEL SECURITY;
ALTER TABLE platos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_lectura_publica"
    ON categorias_carta FOR SELECT
    TO anon, authenticated
    USING (activa = true);

CREATE POLICY "platos_lectura_publica"
    ON platos FOR SELECT
    TO anon, authenticated
    USING (disponible = true);
