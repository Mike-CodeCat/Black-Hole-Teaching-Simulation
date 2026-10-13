# Windows PowerShell 版（Windows 10/11 自带 OpenSSH），使用已配置好的 SSH 密钥。
# 用法：在项目根目录执行  powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1
#       或指定地址        powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1 -HostAddr 192.168.3.36
param([string]$HostAddr = "100.113.81.29")
$ErrorActionPreference = "Stop"
$Target = "codecat@$HostAddr"
$App = "/home/codecat/apps/blackhole"
Set-Location (Join-Path $PSScriptRoot "..")

function Run($exe, $argList) {
  & $exe @argList
  if ($LASTEXITCODE -ne 0) { throw "$exe 执行失败（退出码 $LASTEXITCODE）" }
}

Write-Host "== 1/3 准备目录 ${Target}:$App"
Run ssh @($Target, "mkdir -p $App && rm -rf $App/public && mkdir -p $App/public")

Write-Host "== 2/3 上传网站文件与服务程序"
Run scp @("-q", "-r", "index.html", "css", "js", "${Target}:$App/public/")
Run scp @("-q", "deploy/server.py", "deploy/remote-setup.sh", "${Target}:$App/")

Write-Host "== 3/3 在服务器上登记并启动"
Run ssh @($Target, "sed -i 's/\r$//' $App/remote-setup.sh && bash $App/remote-setup.sh")
