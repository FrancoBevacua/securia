# SECURIA: compilaciÃ³n incremental. Conserva el proyecto Android y su firma.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:NODE_ENV = 'development'
$env:CI = '1'
& npm.cmd install --no-audit --no-fund --legacy-peer-deps
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'FallÃ³ la revisiÃ³n de TypeScript.' }
# & npm.cmd test
# if ($LASTEXITCODE -ne 0) { throw .Fallaron las pruebas.. }
# Expo 57 borra por defecto: --no-clean conserva el proyecto nativo.
& npx.cmd expo prebuild --platform android --no-install --no-clean
if ($LASTEXITCODE -ne 0) { throw 'FallÃ³ expo prebuild.' }
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'configurar-sdk.ps1')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo configurar el SDK/JDK.' }
Push-Location (Join-Path $PSScriptRoot 'android')
try {
  & .\gradlew.bat :app:assembleRelease --no-daemon --console=plain --max-workers=2
  if ($LASTEXITCODE -ne 0) { throw 'FallÃ³ la compilaciÃ³n de Android.' }
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'verificar-apk.ps1')
