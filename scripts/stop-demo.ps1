$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $projectDir '.data/demo-processes.json'
if (!(Test-Path -LiteralPath $stateFile)) { Write-Output 'No tracked demo processes.'; exit 0 }
foreach ($entry in (Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json)) {
  $process = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
  if ($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) { Stop-Process -Id $entry.id }
}
Remove-Item -LiteralPath $stateFile
Write-Output 'Stopped tracked demo processes.'
