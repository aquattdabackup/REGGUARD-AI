$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $projectDir '.data/setup-process.json'
if (!(Test-Path -LiteralPath $stateFile)) { Write-Output 'No tracked setup process.'; exit 0 }
$entry = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
$process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) { Stop-Process -Id $entry.id }
Remove-Item -LiteralPath $stateFile
Write-Output 'Stopped the local setup form.'
