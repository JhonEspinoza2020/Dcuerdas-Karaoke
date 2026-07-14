-- Perfiles de usuario (Google OAuth) y lista de dueños/admins
CREATE TABLE perfiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    nombre      TEXT,
    avatar_url  TEXT,
    rol         TEXT NOT NULL DEFAULT 'cliente' CHECK (rol IN ('cliente', 'admin', 'dueño')),
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE admin_emails (
    email   TEXT PRIMARY KEY,
    rol     TEXT NOT NULL DEFAULT 'dueño' CHECK (rol IN ('dueño', 'admin'))
);

CREATE INDEX idx_perfiles_email ON perfiles (lower(email));
CREATE INDEX idx_perfiles_rol ON perfiles (rol);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

-- Usuarios leen su propio perfil
CREATE POLICY "perfil_propio_lectura"
    ON perfiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "perfil_propio_update"
    ON perfiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Vincular visitas a cuenta Google (opcional)
ALTER TABLE visitas_clientes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_visitas_user ON visitas_clientes (user_id);

-- Al registrarse con Google: crear perfil y asignar rol si está en admin_emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rol_asignado TEXT := 'cliente';
BEGIN
    IF EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email)) THEN
        SELECT a.rol INTO rol_asignado
        FROM public.admin_emails a
        WHERE lower(a.email) = lower(NEW.email);
    END IF;

    INSERT INTO public.perfiles (id, email, nombre, avatar_url, rol)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        NEW.raw_user_meta_data->>'avatar_url',
        rol_asignado
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
