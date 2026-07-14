# D'cuerdas Karaoke

Sistema de karaoke por QR — **D'cuerdas Resto-Bar**

## Arquitectura (actual)

```
Vercel (React)  →  Supabase Edge Functions  →  Supabase Postgres + Realtime
```

**No necesitamos Render ni Railway.** Todo el backend está en Supabase (plan free).

## Estado

| Pieza | Estado |
|-------|--------|
| Postgres (12 mesas, cola, carta) | ✅ Creado |
| RLS seguridad | ✅ Activo |
| Realtime cola | ✅ Activo |
| Edge Functions (8) | ✅ Desplegadas |
| Frontend React | ⏳ Siguiente paso |

## Configuración del negocio

| Parámetro | Valor |
|-----------|-------|
| Mesas | 12 (QR único) |
| Límite canciones | 5 por mesa |
| Horario | 17:30 → 02:00 (America/Lima) |
| Idioma | Español |
| Filtro saludos | Automático |

## Docs

- `docs/ARQUITECTURA_SUPABASE.md` — arquitectura y secrets
- `docs/SUPABASE.md` — conexión BD
- `frontend/README.md` — apps React

## Siguiente paso

Armar el frontend React (cliente móvil) para Vercel.
