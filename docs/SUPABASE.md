# Supabase — D'cuerdas Karaoke

## Proyecto conectado

| Campo | Valor |
|-------|-------|
| **URL** | `https://igskpitfcybectomashf.supabase.co` |
| **Ref** | `igskpitfcybectomashf` |
| **Estado** | ✅ Migraciones aplicadas |

## Tablas creadas

| Tabla | Filas iniciales | Acceso anon |
|-------|-----------------|-------------|
| `mesas` | 12 | ❌ Bloqueado (RLS) |
| `cola_reproduccion` | 0 | ❌ Bloqueado (RLS) |
| `categorias_carta` | 4 | ✅ Solo lectura (activas) |
| `platos` | 0 | ✅ Solo lectura (disponibles) |

## Seguridad (RLS)

- **mesas** y **cola**: sin políticas para `anon` → nadie puede leer tokens ni inyectar canciones directo desde el navegador.
- **carta**: lectura pública de categorías activas y platos disponibles.
- **FastAPI** se conecta con la contraseña de `postgres` (bypass RLS) → toda la lógica pasa por el backend.

## Configurar backend local

1. Ve a **Supabase → Settings → Database → Connection string**
2. Copia la URI **Session mode** (puerto 5432) o **Transaction pooler** (puerto 6543)
3. Convierte a formato asyncpg en `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres.[REF]:[TU_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

4. Completa el resto en `backend/.env` (ver `.env.example`)

## Configurar frontends (Vercel)

```env
VITE_SUPABASE_URL=https://igskpitfcybectomashf.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_API_URL=https://tu-api.railway.app
```

> La anon key es pública por diseño. Los datos sensibles están protegidos por RLS.

## Regenerar tokens de mesa (producción)

Antes de imprimir QRs definitivos:

```bash
cd backend
python -m scripts.generar_tokens_mesas
python -m scripts.generar_qrs
```

## ⚠️ Importante

- **No subas** la contraseña de postgres ni la `service_role` key a Git.
- Si compartiste claves en chat, considera rotarlas en Supabase → Settings → API.
