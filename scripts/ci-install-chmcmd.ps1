# CI 用：安装 chmcmd（Free Pascal），供 compilers:stage 打入 Windows 安装包。
$ErrorActionPreference = 'Stop'

function Find-Chmcmd {
  $cmd = Get-Command chmcmd.exe -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @()
  if ($env:FPCDIR) {
    $candidates += @(
      (Join-Path $env:FPCDIR 'bin\i386-win32\chmcmd.exe'),
      (Join-Path $env:FPCDIR 'bin\x86_64-win64\chmcmd.exe')
    )
  }
  foreach ($ver in @('3.2.2', '3.2.0', '3.0.4')) {
    $candidates += @(
      "C:\FPC\$ver\bin\i386-win32\chmcmd.exe",
      "C:\FPC\$ver\bin\x86_64-win64\chmcmd.exe"
    )
  }

  foreach ($p in $candidates) {
    if ($p -and (Test-Path -LiteralPath $p)) {
      return $p
    }
  }

  foreach ($root in @('C:\FPC', "$env:LOCALAPPDATA\FPC")) {
    if (-not $root -or -not (Test-Path -LiteralPath $root)) {
      continue
    }
    $found = Get-ChildItem -Path $root -Recurse -Filter chmcmd.exe -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) {
      return $found.FullName
    }
  }

  return $null
}

$existing = Find-Chmcmd
if ($existing) {
  Write-Host "[ci] chmcmd already available: $existing"
  exit 0
}

Write-Host '[ci] Installing Free Pascal (Chocolatey)...'
choco install freepascal -y --no-progress

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
  [System.Environment]::GetEnvironmentVariable('Path', 'User')

$installed = Find-Chmcmd
if (-not $installed) {
  Write-Error '[ci] chmcmd not found after Free Pascal install'
  exit 1
}

Write-Host "[ci] chmcmd: $installed"
