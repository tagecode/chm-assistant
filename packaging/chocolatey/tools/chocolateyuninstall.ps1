$ErrorActionPreference = 'Stop'

$uninstallKeys = @(
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

$entry = Get-ItemProperty $uninstallKeys -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -like 'CHM Assistant*' } |
  Select-Object -First 1

if (-not $entry) {
  Write-Warning 'CHM Assistant uninstall registry entry not found; skipping.'
  exit 0
}

$quiet = $entry.QuietUninstallString
if (-not $quiet) {
  $quiet = $entry.UninstallString
}

if (-not $quiet) {
  throw 'UninstallString not found for CHM Assistant.'
}

if ($quiet -match '^(?<exe>"(?:[^"]|"")+"|[^"\s]+)\s*(?<args>.*)$') {
  $exe = $Matches.exe.Trim('"')
  $args = $Matches.args
  if ($args -notmatch '/S') {
    $args = "$args /S".Trim()
  }
  $proc = Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    throw "Uninstaller exited with code $($proc.ExitCode)"
  }
} else {
  throw "Unable to parse uninstall command: $quiet"
}
