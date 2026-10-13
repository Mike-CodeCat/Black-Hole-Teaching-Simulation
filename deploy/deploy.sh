#!/usr/bin/env bash
# 在你自己的电脑上运行（macOS / Linux / Windows 的 Git Bash 或 WSL），使用已配置好的 SSH 密钥。
# 用法：bash deploy/deploy.sh            （默认 codecat@100.113.81.29）
#       bash deploy/deploy.sh 192.168.3.36
set -euo pipefail
HOST=${1:-100.113.81.29}
TARGET=codecat@$HOST
APP=/home/codecat/apps/blackhole
cd "$(dirname "$0")/.."

echo "== 1/3 准备目录 $TARGET:$APP"
ssh "$TARGET" "mkdir -p $APP && rm -rf $APP/public && mkdir -p $APP/public"

echo "== 2/3 上传网站文件与服务程序"
scp -q -r index.html css js "$TARGET:$APP/public/"
scp -q deploy/server.py deploy/remote-setup.sh "$TARGET:$APP/"

echo "== 3/3 在服务器上登记并启动"
ssh "$TARGET" "bash $APP/remote-setup.sh"
