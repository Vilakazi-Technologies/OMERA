# Merge local Xavani service key into Omera .env.local (run after setup-xavani-windows.ps1)
$ErrorActionPreference = "Stop"
$omeraRoot = Join-Path $PSScriptRoot ".."
$xavaniEnv = Join-Path $env:USERPROFILE ".xavani-omera\.env"
$localEnv = Join-Path $omeraRoot ".env.local"

if (-not (Test-Path $xavaniEnv)) {
  throw "Run scripts\setup-xavani-windows.ps1 first."
}

$key = (Get-Content $xavaniEnv | Where-Object { $_ -match "^API_SERVER_KEY=" }) -replace "^API_SERVER_KEY=", ""
if (-not $key) { throw "API_SERVER_KEY not found in $xavaniEnv" }

$lines = @()
if (Test-Path $localEnv) { $lines = Get-Content $localEnv }

function Set-EnvLine([string]$name, [string]$value) {
  $global:lines = $lines | Where-Object { $_ -notmatch "^$name=" }
  $global:lines += "$name=$value"
}

Set-EnvLine "APP_ORIGIN" "http://127.0.0.1:3000"
Set-EnvLine "OMERA_DEMO_MODE" "false"
Set-EnvLine "XAVANI_BASE_URL" "http://127.0.0.1:8642/"
Set-EnvLine "XAVANI_API_KEY" $key
Set-EnvLine "XAVANI_MODEL" "omera"

$lines | Set-Content -Encoding utf8 $localEnv
Write-Host "Updated $localEnv with local Xavani settings."
Write-Host "Ensure SUPABASE_* and NEXT_PUBLIC_SUPABASE_* are set (Vercel pull or Supabase dashboard)."
