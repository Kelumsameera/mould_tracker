# Builds the Windows installer and Android APK, then uploads them with their update feeds to the LAN server.
# Installed apps see the new version on their next update check. Bump the versions in
# native/desktop/package.json and native/android/AndroidManifest.xml (versionCode too) first.
param(
  [string]$Server = 'flexi@192.168.0.116',
  [string]$Key = "$env:USERPROFILE\.ssh\tool-tracker-deploy",
  [string]$RemoteDir = '~/apps/tool-tracker/deploy/lan-certificates/downloads',
  [switch]$SkipWindows,
  [switch]$SkipAndroid
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$out = Join-Path $repo 'outputs\native'
$upload = @()

if (-not $SkipWindows) {
  Push-Location (Join-Path $PSScriptRoot 'desktop')
  try {
    npm test; if ($LASTEXITCODE) { throw 'Desktop tests failed' }
    npm run dist:win; if ($LASTEXITCODE) { throw 'Windows build failed' }
    $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
  } finally { Pop-Location }
  $exe = Get-Item (Join-Path $out "desktop\Mould-Tracker-$version-win-x64.exe")
  $feed = [ordered]@{ version = $version; file = $exe.Name; sha256 = (Get-FileHash $exe.FullName -Algorithm SHA256).Hash.ToLower() }
  $feedFile = Join-Path $out 'windows-latest.json'
  [IO.File]::WriteAllText($feedFile, ($feed | ConvertTo-Json) + "`n")
  # Upload the installer before its feed so clients never see a feed pointing at a missing file.
  $upload += $exe.FullName, $feedFile
}

if (-not $SkipAndroid) {
  python (Join-Path $PSScriptRoot 'android\build.py'); if ($LASTEXITCODE) { throw 'Android build failed' }
  $feedFile = Join-Path $out 'android-latest.json'
  $apk = Join-Path $out ((Get-Content $feedFile -Raw | ConvertFrom-Json).file)
  $upload += $apk, $feedFile
}

foreach ($file in $upload) {
  Write-Host "Uploading $(Split-Path $file -Leaf)"
  scp -i $Key -o IdentitiesOnly=yes -o BatchMode=yes $file "${Server}:$RemoteDir/"
  if ($LASTEXITCODE) { throw "Upload failed: $file" }
}
ssh -i $Key -o IdentitiesOnly=yes -o BatchMode=yes $Server "cd $RemoteDir && sha256sum *.apk *.exe > SHA256SUMS.txt && ls -l"
Write-Host 'Published. Installed apps will offer the update on their next check.'
