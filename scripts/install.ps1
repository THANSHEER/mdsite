# mdsite installer for Windows (PowerShell) — standalone binary, no Node needed.
#
#   irm https://raw.githubusercontent.com/THANSHEER/mdsite/main/scripts/install.ps1 | iex
#
# Env overrides:
#   $env:MDSITE_VERSION   tag to install (default: latest)
#   $env:MDSITE_BIN_DIR   install dir (default: %LOCALAPPDATA%\Programs\mdsite)
$ErrorActionPreference = 'Stop'

$repo = 'THANSHEER/mdsite'
$version = if ($env:MDSITE_VERSION) { $env:MDSITE_VERSION } else { 'latest' }

$arch = 'x64'
$asset = "mdsite-win-$arch.zip"
$url = if ($version -eq 'latest') {
  "https://github.com/$repo/releases/latest/download/$asset"
} else {
  "https://github.com/$repo/releases/download/$version/$asset"
}

$binDir = if ($env:MDSITE_BIN_DIR) { $env:MDSITE_BIN_DIR } else { "$env:LOCALAPPDATA\Programs\mdsite" }
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$tmp = Join-Path $env:TEMP "mdsite-$(Get-Random).zip"
Write-Host "mdsite: downloading $asset ($version)..."
Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing
Expand-Archive -Path $tmp -DestinationPath $binDir -Force
Remove-Item $tmp -Force

# Add to the user PATH if not already present.
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$binDir*") {
  [Environment]::SetEnvironmentVariable('Path', "$userPath;$binDir", 'User')
  Write-Host "mdsite: added $binDir to your PATH (restart your terminal)"
}

Write-Host "mdsite: installed to $binDir\mdsite.exe"
& "$binDir\mdsite.exe" --version
