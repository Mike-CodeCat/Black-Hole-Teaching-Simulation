#!/usr/bin/env bash
# 在服务器上执行（由 deploy.sh / deploy.ps1 自动上传并调用）。
# 遵守 codecat 面板部署规则：只写 /home/codecat/apps/<id>/，端口 3000–3999，
# 进程用户 codecat，无 sudo，只通过 panel-register 登记。
set -euo pipefail

ID=blackhole
NAME="黑洞教学仿真平台"
APP=/home/codecat/apps/$ID
REGISTER=/home/codecat/panel/bin/panel-register
RESERVED=" 22 53 80 8056 8787 7890 9090 11011 16062 "

cd "$APP"
[ -f public/index.html ] || { echo "✗ $APP/public/index.html 不存在，上传失败？"; exit 1; }

port_in_use() { ss -tlnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]$1\$"; }
pick_free() {  # 从 $1 开始找 3000–3999 中第一个空闲端口，跳过 $2
  local p
  for p in $(seq "$1" 3999) $(seq 3000 $(( $1 - 1 ))); do
    [[ "$RESERVED" == *" $p "* ]] && continue
    [ "$p" = "${2:-}" ] && continue
    port_in_use "$p" || { echo "$p"; return 0; }
  done
  return 1
}
health() { python3 - "$1" <<'PY'
import json, sys, urllib.request
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))  # 不走 http_proxy（如 mihomo）
try:
    with opener.open(f"http://127.0.0.1:{sys.argv[1]}/health", timeout=3) as r:
        sys.exit(0 if json.load(r).get("ok") is True else 1)
except Exception:
    sys.exit(1)
PY
}

# 1. 端口：已部署过就沿用，否则选一个空闲端口
if [ -f .port ] && systemctl is-active --quiet "$ID"; then
  PORT=$(cat .port)
elif [ -f .port ] && ! port_in_use "$(cat .port)"; then
  PORT=$(cat .port)
else
  PORT=$(pick_free 3210) || { echo "✗ 3000–3999 没有空闲端口"; exit 1; }
fi
echo "$PORT" > .port
echo "→ 使用端口 $PORT"

# 2. systemd 单元（放在应用目录）
cat > "$ID.service" <<UNIT
[Unit]
Description=$NAME
After=network.target

[Service]
Type=simple
User=codecat
Group=codecat
WorkingDirectory=$APP
ExecStart=/usr/bin/python3 $APP/server.py
Restart=on-failure
RestartSec=5
MemoryMax=256M
NoNewPrivileges=yes
Environment=PORT=$PORT
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
UNIT

# 3. 先在临时端口上手动试跑，确认 /health 正常
TEST_PORT=$(pick_free 3900 "$PORT")
PORT=$TEST_PORT python3 server.py > /dev/null 2>&1 &
TEST_PID=$!
ok=0
for _ in $(seq 1 20); do sleep 0.3; if health "$TEST_PORT"; then ok=1; break; fi; done
kill "$TEST_PID" 2>/dev/null || true; wait "$TEST_PID" 2>/dev/null || true
[ "$ok" = 1 ] || { echo "✗ 试运行失败，/health 没有返回 {\"ok\":true}"; exit 1; }
echo "→ 试运行通过（临时端口 $TEST_PORT）"

# 4. 登记 + 安装单元 + 启动 + 开机自启（第一次 add，之后 --update）
args=(add --id "$ID" --name "$NAME" --port "$PORT" --health /health --workdir "$APP" --start)
if [ -f .registered ]; then
  "$REGISTER" "${args[@]}" --update
else
  "$REGISTER" "${args[@]}" || "$REGISTER" "${args[@]}" --update
fi
touch .registered

# 5. 验收
for _ in $(seq 1 20); do sleep 0.5; health "$PORT" && break; done
state=$(systemctl is-active "$ID" || true)
if [ "$state" = active ] && health "$PORT"; then
  echo "✓ 部署成功：systemctl is-active $ID = active，/health = {\"ok\":true}"
  echo "  局域网：   http://192.168.3.36:$PORT/"
  echo "  Tailscale：http://100.113.81.29:$PORT/"
  echo "  面板：     http://192.168.3.36:8787/ （服务列表中应出现「$NAME」）"
else
  echo "✗ 服务状态 $state，最近日志："
  journalctl -u "$ID" -n 30 --no-pager || true
  exit 1
fi
