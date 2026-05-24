$ErrorActionPreference = 'Stop'

# CI 发版前由 scripts/update-chocolatey-package.mjs 更新下列三行
$version = '0.1.0'
$url64 = 'https://github.com/tagecode/chm-assistant/releases/download/v0.1.0/CHM-Assistant-v0.1.0-win-x64.exe'
$checksum64 = '9D751EFD0420FE049D2FAD21B67A74EE6EACBC7C7E09AB25C6F4B065A67AAC99'

$packageArgs = @{
  packageName   = $env:ChocolateyPackageName
  fileType      = 'exe'
  url64bit      = $url64
  checksum64    = $checksum64
  checksumType64 = 'sha256'
  silentArgs    = '/S'
  validExitCodes = @(0)
  softwareName  = 'CHM Assistant*'
}

Install-ChocolateyPackage @packageArgs
