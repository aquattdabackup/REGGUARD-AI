$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$stateFile = Join-Path $projectDir '.data/setup-process.json'
New-Item -ItemType Directory -Force -Path (Join-Path $projectDir '.data') | Out-Null
if (Test-Path -LiteralPath $stateFile) {
  $entry = Get-Content -Raw -LiteralPath $stateFile | ConvertFrom-Json
  $existing = Get-Process -Id $entry.id -ErrorAction SilentlyContinue
  if ($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) {
    Write-Output 'OpenAI setup is already running: http://127.0.0.1:8765/'
    exit 0
  }
}
$pythonExe = Join-Path $projectDir '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonExe)) { throw 'Create the Python virtual environment first. See README.' }
$process = Start-Process -FilePath $pythonExe -ArgumentList @('scripts/local_setup.py') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $projectDir '.data/setup.log') -RedirectStandardError (Join-Path $projectDir '.data/setup.error.log')
@{id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $stateFile
Write-Output 'OpenAI setup: http://127.0.0.1:8765/ (only on this computer)'
