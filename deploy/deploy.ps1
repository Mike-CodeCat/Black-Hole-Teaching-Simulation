# Deploy to the codecat panel server from Windows (built-in OpenSSH, uses your SSH key).
# NOTE: this file is intentionally pure ASCII so Windows PowerShell 5.1 parses it correctly.
# Usage (from the project folder or the deploy folder):
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
#   powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -HostAddr 192.168.3.36
param([string]$HostAddr = "100.113.81.29")
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$Target = 'codecat@' + $HostAddr
$App = '/home/codecat/apps/blackhole'
Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not (Test-Path 'index.html')) { throw ('index.html not found in ' + (Get-Location)) }

function Run([string]$exe, [string[]]$argList) {
  & $exe @argList
  if ($LASTEXITCODE -ne 0) { throw ($exe + ' failed, exit code ' + $LASTEXITCODE) }
}

Write-Host ('== 1/3 Prepare ' + $Target + ':' + $App)
$prep = 'mkdir -p ' + $App + '; rm -rf ' + $App + '/public; mkdir -p ' + $App + '/public'
Run 'ssh' @($Target, $prep)

Write-Host '== 2/3 Upload site files and server program'
Run 'scp' @('-q', '-r', 'index.html', 'css', 'js', ($Target + ':' + $App + '/public/'))
Run 'scp' @('-q', 'deploy/server.py', 'deploy/remote-setup.sh', ($Target + ':' + $App + '/'))

Write-Host '== 3/3 Register and start on the server'
# Strip Windows line endings (CRLF) that git may have added, then run the setup script.
$setup = "sed -i 's/\r`$//' " + $App + '/remote-setup.sh ' + $App + '/server.py; bash ' + $App + '/remote-setup.sh'
Run 'ssh' @($Target, $setup)
