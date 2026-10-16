# One-time: add OpenRouter key to Vercel production and redeploy Omera.
# Usage (from vilatech-ai folder):
#   .\scripts\finish-production.ps1
# Or: .\scripts\finish-production.ps1 -OpenRouterKey "sk-or-v1-..."

param(
  [Parameter(Mandatory = $false)]
  [string]$OpenRouterKey
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not $OpenRouterKey) {
  $OpenRouterKey = Read-Host "Paste your OpenRouter API key (input hidden)"
  if (-not $OpenRouterKey) { throw "OpenRouter key is required." }
}

$model = "nvidia/nemotron-3.5-super-vl:free"

npx vercel env rm OPENROUTER_API_KEY production --yes 2>$null | Out-Null
$OpenRouterKey | npx vercel env add OPENROUTER_API_KEY production

npx vercel env rm OPENROUTER_MODEL production --yes 2>$null | Out-Null
$model | npx vercel env add OPENROUTER_MODEL production

Write-Host "Redeploying production..."
npx vercel deploy --prod --yes

Write-Host ""
Write-Host "Check: https://vilatech-ai.vercel.app/api/health"
Write-Host "Expect chat.provider = openrouter and status = ok"
