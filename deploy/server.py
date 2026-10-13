#!/usr/bin/env python3
"""视界之旅 · 黑洞教学仿真平台 —— 静态站点服务（仅用 Python 标准库）

- 监听 0.0.0.0:$PORT（默认 3210）
- GET /health → {"ok":true}
- 其余请求从同目录下的 public/ 提供静态文件（禁止目录列表）
- 日志输出到 stdout，供 journalctl -u <id> 查看
"""
import json
import os
import signal
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
PORT = int(os.environ.get("PORT", "3210"))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript; charset=utf-8",
                      ".css": "text/css; charset=utf-8",
                      ".html": "text/html; charset=utf-8",
                      ".json": "application/json; charset=utf-8"}

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/health":
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        # 页面更新后浏览器能及时拿到新版本
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def list_directory(self, path):  # 不暴露目录列表
        self.send_error(404, "Not Found")
        return None

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))
        sys.stdout.flush()


def main():
    if not os.path.isfile(os.path.join(ROOT, "index.html")):
        print(f"找不到 {ROOT}/index.html，请先上传网站文件", flush=True)
        sys.exit(1)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), partial(Handler, directory=ROOT))
    server.daemon_threads = True
    # systemctl stop 发送 SIGTERM：直接抛出 SystemExit 让 serve_forever 退出
    # （不能在信号处理函数里调用 server.shutdown()，那会在主线程里自我死锁）
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    print(f"黑洞教学仿真平台已启动：http://0.0.0.0:{PORT}/  （健康检查 /health）", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("已停止", flush=True)


if __name__ == "__main__":
    main()
