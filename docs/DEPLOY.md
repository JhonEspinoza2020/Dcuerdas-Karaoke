# Despliegue D'cuerdas — Vercel + API externa

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ cliente.vercel  │     │ pantalla.vercel │     │ admin.vercel    │
│  (comensales)   │     │  (TV WiFi)      │     │  (staff)        │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │ HTTPS / WSS
                    ┌────────────▼────────────┐
                    │  API FastAPI          │
                    │  Railway / Render     │
                    │  + PostgreSQL         │
                    │  (Supabase / Neon)    │
                    └───────────────────────┘
```

## 1. Base de datos (PostgreSQL)

Opciones recomendadas:
- **Supabase** (ya tienes MCP configurado) — PostgreSQL managed
- **Neon** — serverless Postgres

Ejecutar migraciones:
```bash
psql $DATABASE_URL -f database/migrations/001_initial_schema.sql
psql $DATABASE_URL -f database/migrations/002_carta_platos.sql
python -m scripts.generar_tokens_mesas   # tokens seguros en producción
```

## 2. API Backend (Railway recomendado)

```bash
# Variables en Railway
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=...
ADMIN_API_KEY=...
CORS_ORIGINS=https://dcuerdas.vercel.app,https://dcuerdas-pantalla.vercel.app,https://dcuerdas-admin.vercel.app
FRONTEND_BASE_URL=https://dcuerdas.vercel.app
KARAOKE_IGNORAR_HORARIO=false
YOUTUBE_API_KEY=...   # cuando esté lista
```

Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

## 3. Frontends en Vercel (3 proyectos)

Crear 3 proyectos en Vercel apuntando a:
- `frontend/apps/cliente`
- `frontend/apps/pantalla`
- `frontend/apps/admin`

Cada uno con `vercel.json` incluido. Variables:
```
VITE_API_URL=https://tu-api.railway.app
VITE_WS_URL=wss://tu-api.railway.app
```

## 4. QRs para las 12 mesas

```bash
GET /api/v1/mesas/qrs
Header: X-Admin-Key: <ADMIN_API_KEY>
```

Respuesta: URL por mesa → `https://dcuerdas.vercel.app/mesa/3?t=TOKEN`

El dueño imprime un QR por mesa con esa URL.

## 5. TV en el local (WiFi)

1. PC conectada al WiFi del restobar
2. HDMI al televisor
3. Abrir Chrome → `https://dcuerdas-pantalla.vercel.app`
4. F11 fullscreen
5. La pantalla mantiene WebSocket abierto con la cola

## Horario producción

- Karaoke: **17:30 – 02:00** (America/Lima)
- `KARAOKE_IGNORAR_HORARIO=false` en producción
- `true` solo en desarrollo local
