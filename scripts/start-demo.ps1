$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectDir
New-Item -ItemType Directory -Force .data | Out-Null
if (Test-Path .data/demo-processes.json) { throw 'Run scripts/stop-demo.ps1 before starting another demo.' }
$pythonExe = Join-Path $projectDir '.venv/Scripts/python.exe'
$nodeExe = (Get-Command node).Source
if (!(Test-Path $pythonExe)) { throw 'Create .venv and install services/api[dev] first. See README.' }
if (!(Test-Path 'apps/web/.next/BUILD_ID')) { throw 'Run pnpm build first.' }
$env:APP_ENV = 'development'
$env:DEMO_MODE = 'true'
$env:DATABASE_URL = 'sqlite:///./.data/regguard.db'
$env:APP_ORIGIN = 'http://localhost:3000'
& $pythonExe -m alembic -c services/api/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
$specifications = @(
  @{name='api';exe=$pythonExe;arguments=@('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000')},
  @{name='worker';exe=$pythonExe;arguments=@('-m','app.worker')},
  @{name='web';exe=$nodeExe;arguments=@('apps/web/node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1')}
)
$started = @()
try {
  foreach ($specification in $specifications) {
    $process = Start-Process -FilePath $specification.exe -ArgumentList $specification.arguments -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput ".data/$($specification.name).log" -RedirectStandardError ".data/$($specification.name).error.log"
    $started += @{name=$specification.name;id=$process.Id;started=$process.StartTime.ToUniversalTime().ToString('o')}
  }
} finally { $started | ConvertTo-Json | Set-Content -Encoding utf8 .data/demo-processes.json }
Write-Output 'Demo starting: http://localhost:3000/login (Launch demo workspace). API: http://localhost:8000/docs'
Write-Output 'Logs: .data/*.log. Stop: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/stop-demo.ps1'
