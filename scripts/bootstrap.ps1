#Requires -Version 5.1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example — update secrets before non-local use."
}

pnpm install
pnpm infra:up
Write-Host "Bootstrap complete. Run: pnpm dev"
