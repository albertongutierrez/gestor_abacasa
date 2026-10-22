$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not (Get-Command herd -ErrorAction SilentlyContinue)) {
    throw 'Instala Laravel Herd y PHP 8.5 antes de iniciar. Consulta README.md.'
}
herd link gestor-abacasa --isolate=8.5
if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el sitio en Herd.' }
herd open gestor-abacasa
