# Arquitectura actual — SOLO Supabase + Vercel (sin Render/Railway)

```
React (Vercel)
   ↓
Supabase Edge Functions  ← backend
   ↓
Supabase Postgres + Realtime
```

## Edge Functions desplegadas

| Función | Uso |
|---------|-----|
| `karaoke-estado` | ¿Abierto? horario 17:30–02:00 |
| `validar-mesa` | Valida QR token de mesa |
| `buscar-youtube` | Busca karaoke (oculta API key) |
| `encolar-cancion` | Encola + filtro + límite 5 |
| `cola-activa` | Cola para TV/admin |
| `actualizar-estado-cola` | pendiente → reproduciendo → completada |
| `mesas-qrs` | URLs de los 12 QRs |
| `carta-admin` / `admin-carta` | CRUD carta |

Base URL:
`https://igskpitfcybectomashf.supabase.co/functions/v1/`

## Secrets a configurar en Supabase

Dashboard → Edge Functions → Secrets:

```
ADMIN_API_KEY=tu-clave-secreta-admin
YOUTUBE_API_KEY=     # cuando la tengas
FRONTEND_BASE_URL=https://dcuerdas.vercel.app
KARAOKE_IGNORAR_HORARIO=true   # false en producción
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta Supabase automáticamente.

## Frontend React → Vercel

3 apps:
- `frontend/apps/cliente` — móvil QR
- `frontend/apps/pantalla` — TV
- `frontend/apps/admin` — carta + cola + QRs

Variables en Vercel:

```
VITE_SUPABASE_URL=https://igskpitfcybectomashf.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_ADMIN_KEY=tu-clave-admin   # solo pantalla y admin
```

## Python FastAPI

La carpeta `backend/` ya **no se usa en producción**.
Queda solo como referencia histórica. Se puede borrar cuando confirmemos.
