# Prepare local Xavani for Omera on Windows (see docs/setting-up-omera.md)
param(
  [string]$XavaniRepo = (Join-Path $PSScriptRoot "..\..\xavani-agent"),
  [string]$XavaniHome = "$env:USERPROFILE\.xavani-omera"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $XavaniRepo)) {
  Write-Host "Cloning xavani-agent (feat/omera-api-mode)..."
  git clone --branch feat/omera-api-mode https://github.com/enternovate/xavani-agent.git $XavaniRepo
}

Set-Location $XavaniRepo

$py = $null
foreach ($candidate in @("py -3.11", "py -3.12", "py -3", "python")) {
  try {
    $ver = Invoke-Expression "$candidate -c `"import sys; print(sys.version_info[:2])`"" 2>$null
    if ($ver -match "3\.1[1-3]") { $py = $candidate; break }
  } catch { }
}
if (-not $py) {
  Write-Warning "Python 3.11-3.13 not found. Install Python 3.11, then re-run this script for pip install."
} else {
  if (-not (Test-Path ".\.venv\Scripts\Activate.ps1")) {
    Invoke-Expression "$py -m venv .venv"
  }
  .\.venv\Scripts\Activate.ps1
  pip install -e .
}

New-Item -ItemType Directory -Force -Path $XavaniHome | Out-Null

$serviceKey = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$envPath = Join-Path $XavaniHome ".env"
$configPath = Join-Path $XavaniHome "config.yaml"

if (-not (Test-Path $envPath)) {
  $envLines = @(
    "API_SERVER_ENABLED=true",
    "API_SERVER_HOST=127.0.0.1",
    "API_SERVER_PORT=8642",
    "API_SERVER_KEY=$serviceKey",
    "API_SERVER_MODEL_NAME=omera",
    "OPENROUTER_API_KEY="
  )
  $envLines | Set-Content -Encoding utf8 $envPath
  Write-Host "Created $envPath - add your OPENROUTER_API_KEY"
} else {
  Write-Host "Exists: $envPath"
}

if (-not (Test-Path $configPath)) {
  $configLines = @(
    "platforms:",
    "  api_server:",
    "    enabled: true",
    "    extra:",
    "      omera_mode: true"
  )
  $configLines | Set-Content -Encoding utf8 $configPath
}

Write-Host ""
Write-Host "XAVANI_HOME: $XavaniHome"
Write-Host "Omera XAVANI_API_KEY (match API_SERVER_KEY): $serviceKey"
Write-Host "Omera XAVANI_BASE_URL: http://127.0.0.1:8642/"
Write-Host ""
Write-Host "Start gateway:"
Write-Host ('  $env:XAVANI_HOME = "' + $XavaniHome + '"')
Write-Host "  cd $XavaniRepo"
Write-Host "  .\.venv\Scripts\Activate.ps1"
Write-Host "  xavani gateway"
