$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$config = (Get-Content -LiteralPath (Join-Path $projectDir 'app.json') -Raw | ConvertFrom-Json).expo
$builtApk = Join-Path $projectDir 'android\app\build\outputs\apk\release\app-release.apk'
$deliverApk = Join-Path $projectDir 'Securia.apk'
$previousApk = Join-Path $projectDir 'output\apk\Securia-2.3.1.apk'
$versionedApk = Join-Path $projectDir ('output\apk\Securia-' + $config.version + '.apk')
$sdkDir = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$toolDir = Join-Path $sdkDir 'build-tools\36.0.0'
if (!$env:JAVA_HOME) {
  $javaHomeLine = Get-Content -LiteralPath (Join-Path $projectDir 'android\gradle.properties') | Where-Object { $_ -match '^org.gradle.java.home=' } | Select-Object -First 1
  if ($javaHomeLine) { $env:JAVA_HOME = $javaHomeLine.Substring('org.gradle.java.home='.Length) }
}
$certificate = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
if (!(Test-Path -LiteralPath $builtApk)) { throw 'No se generó la APK.' }
$javaExe = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin\java.exe' } else { 'java.exe' }
if (!(Test-Path -LiteralPath $previousApk)) { throw 'Falta la APK 2.3.1 de referencia para verificar la actualización.' }
$previousSignature = & $javaExe -jar (Join-Path $toolDir 'lib\apksigner.jar') verify --print-certs $previousApk 2>&1
if ($LASTEXITCODE -ne 0) { throw 'No se pudo verificar la APK de referencia.' }
if (($previousSignature -join "`n") -notmatch [regex]::Escape($certificate)) { throw 'La firma de referencia no coincide con la firma de distribución.' }
$previousBadging = & (Join-Path $toolDir 'aapt.exe') dump badging $previousApk
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el manifiesto de referencia.' }
$previousPackage = ($previousBadging | Select-String '^package:').Line
if ($previousPackage -notmatch "versionCode='([0-9]+)'") { throw 'Falta el código de versión anterior.' }
$previousVersionCode = [int]$Matches[1]
if ([int]$config.android.versionCode -le $previousVersionCode) { throw 'La actualización debe tener un versionCode mayor que la APK instalada.' }
if (!$previousPackage.Contains("name='$($config.android.package)'")) { throw 'El paquete no coincide con la aplicación instalada.' }
$signature = & $javaExe -jar (Join-Path $toolDir 'lib\apksigner.jar') verify --verbose --print-certs $builtApk 2>&1
if ($LASTEXITCODE -ne 0) { throw 'Firma inválida.' }
if (($signature -join "`n") -notmatch [regex]::Escape($certificate)) { throw 'La firma no coincide con la versión anterior.' }
& (Join-Path $toolDir 'zipalign.exe') -c -P 16 4 $builtApk
if ($LASTEXITCODE -ne 0) { throw 'La alineación de la APK no pasó la verificación.' }
$badging = & (Join-Path $toolDir 'aapt.exe') dump badging $builtApk
if ($LASTEXITCODE -ne 0) { throw 'No se pudo leer el manifiesto.' }
$package = ($badging | Select-String '^package:').Line
foreach ($valor in @("name='$($config.android.package)'", "versionCode='$($config.android.versionCode)'", "versionName='$($config.version)'")) {
  if (!$package.Contains($valor)) { throw ('Versión inesperada: ' + $package) }
}
if (($badging -join "`n") -notmatch ("application-label:'" + [regex]::Escape($config.name) + "'")) { throw 'El nombre visible de la APK no coincide con Securia.' }
New-Item -ItemType Directory -Path (Join-Path $projectDir 'output\apk') -Force | Out-Null
Copy-Item -LiteralPath $builtApk -Destination $deliverApk -Force
Copy-Item -LiteralPath $builtApk -Destination $versionedApk -Force
$hash = (Get-FileHash -LiteralPath $builtApk -Algorithm SHA256).Hash
if ((Get-FileHash -LiteralPath $deliverApk -Algorithm SHA256).Hash -ne $hash) { throw 'La copia de la APK no coincide.' }
if ((Get-FileHash -LiteralPath $versionedApk -Algorithm SHA256).Hash -ne $hash) { throw 'La copia versionada de la APK no coincide.' }
$resultado = [ordered]@{
  version = $config.version; versionCode = $config.android.versionCode; package = $config.android.package;
  bytes = (Get-Item -LiteralPath $deliverApk).Length; sha256 = $hash;
  signerSha256 = $certificate; aligned16KB = $true; verifiedAt = (Get-Date).ToString('o');
  previousVersionCode = $previousVersionCode; updateCompatibleWith = $previousApk;
  manifest = @($badging | Where-Object { $_ -match '^(package:|application-label:|sdkVersion:|targetSdkVersion:|native-code:)' });
  file = $versionedApk
}
$outputDir = Join-Path $projectDir 'output\apk'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$resultado | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputDir ('verificacion-' + $config.version + '.json')) -Encoding utf8
$resultado | ConvertTo-Json -Depth 4
