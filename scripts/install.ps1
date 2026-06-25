# mdgarden installer for Windows (PowerShell) — standalone binary, no Node needed.
#
#   irm https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.ps1 | iex
#
# Env overrides:
#   $env:MDGARDEN_VERSION   tag to install (default: latest)
#   $env:MDGARDEN_BIN_DIR   install dir (default: %LOCALAPPDATA%\Programs\mdgarden)
$ErrorActionPreference = 'Stop'

$repo = 'THANSHEER/mdsite'
$version = if ($env:MDGARDEN_VERSION) { $env:MDGARDEN_VERSION } else { 'latest' }

$arch = 'x64'
$asset = "mdgarden-win-$arch.zip"
$url = if ($version -eq 'latest') {
  "https://github.com/$repo/releases/latest/download/$asset"
} else {
  "https://github.com/$repo/releases/download/$version/$asset"
}

$binDir = if ($env:MDGARDEN_BIN_DIR) { $env:MDGARDEN_BIN_DIR } else { "$env:LOCALAPPDATA\Programs\mdgarden" }
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$tmp = Join-Path $env:TEMP "mdgarden-$(Get-Random).zip"
Write-Host "mdgarden: downloading $asset ($version)..."
Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
Expand-Archive -Path $tmp -DestinationPath $binDir -Force
Remove-Item $tmp -Force

# Add to the user PATH if not already present.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$binDir*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$binDir", 'User')
  Write-Host "mdgarden: added $binDir to your PATH (restart your terminal)"
}

Write-Host "mdgarden: installed to $binDir\mdgarden.exe"
& "$binDir\mdgarden.exe" --version
