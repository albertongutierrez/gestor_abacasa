$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
php -S 127.0.0.1:8013 -t public scripts/serve.php
