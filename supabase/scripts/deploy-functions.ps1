# Despliega Edge Functions a Supabase
# Requiere: supabase CLI + supabase login
# Uso: .\scripts\deploy-functions.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "Desplegando Edge Functions D'cuerdas..." -ForegroundColor Cyan

$functions = @(
  "karaoke-estado",
  "validar-mesa",
  "buscar-youtube",
  "encolar-cancion",
  "cola-activa",
  "actualizar-estado-cola",
  "mesas-qrs",
  "admin-carta"
)

foreach ($fn in $functions) {
  Write-Host "  -> $fn" -ForegroundColor Yellow
  supabase functions deploy $fn --no-verify-jwt --project-ref igskpitfcybectomashf
}

Write-Host "`nListo. Configura secrets en Supabase Dashboard:" -ForegroundColor Green
Write-Host "  ADMIN_API_KEY, YOUTUBE_API_KEY, FRONTEND_BASE_URL, KARAOKE_IGNORAR_HORARIO"
