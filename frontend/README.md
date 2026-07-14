# D'cuerdas — App única (cliente + admin)

Una sola aplicación React, **un solo puerto**, con secciones internas por ruta.

| Ruta | Usuario | Para qué |
|------|---------|----------|
| `/` | — | Página de inicio con la marca y el lema |
| `/mesa/:numero?t=TOKEN` | Comensales (móvil) | Registro → carta → karaoke |
| `/admin` | Personal / dueño (PC) | Login por clave → Reproductor, Cola, Códigos QR |

El **reproductor** vive dentro de `/admin`: el personal reproduce YouTube en la PC del local y **duplica la pantalla al televisor por HDMI** (botón "Pantalla completa").

## Stack

- Vite + React + TypeScript
- CSS propio con tokens de marca (negro, crema, naranja/dorado)
- Backend: Supabase (Edge Functions + PostgreSQL + Realtime)

## Estructura

```
frontend/
├── index.html
├── package.json          # scripts: dev, build, preview
├── vite.config.ts        # alias @dcuerdas/shared -> ./src/shared
├── .env                  # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
└── src/
    ├── main.tsx          # router: /, /mesa/:numero, /admin
    ├── index.css
    ├── Landing.tsx
    ├── shared/           # tema, i18n, tipos, cliente API, Supabase
    ├── cliente/          # flujo del comensal (móvil)
    │   ├── pages/MesaPage.tsx
    │   ├── components/{RegistroStep,CartaStep,KaraokeStep}.tsx
    │   └── types.ts
    └── admin/            # panel del personal
        ├── AdminApp.tsx      # login + navegación por pestañas
        ├── Reproductor.tsx   # se duplica a la TV (HDMI)
        ├── ColaPanel.tsx     # cola en tiempo real
        ├── QRsPanel.tsx      # QRs imprimibles de las 12 mesas
        └── useYouTubePlayer.ts
```

## Comandos

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build
npm run preview
```

## Variables de entorno (`.env`)

```env
VITE_SUPABASE_URL=https://igskpitfcybectomashf.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

No hace falta `VITE_ADMIN_KEY`: el personal escribe su **clave de acceso** al entrar a `/admin`
(debe coincidir con `ADMIN_API_KEY` en Supabase → Edge Functions → Secrets). La clave se guarda solo
en la sesión del navegador.

## Uso

- **Cliente:** escanea el QR de su mesa → `http://localhost:5173/mesa/1?t=TOKEN`
- **Admin/TV:** abre `http://localhost:5173/admin`, ingresa la clave, ve a **Reproductor** y pulsa
  **Pantalla completa** en la PC conectada por HDMI al televisor.

## Despliegue

Un único proyecto en Vercel (carpeta `frontend/`). El `vercel.json` reescribe todas las rutas a
`index.html` para que funcione el enrutado del lado del cliente.
