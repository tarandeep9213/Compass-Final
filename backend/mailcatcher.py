"""
mailcatcher.py - local SMTP debug server for testing emails without real SMTP.

Usage:
    cd backend
    python mailcatcher.py

Listens on:
  - SMTP : localhost:1025  (matches .env SMTP settings)
  - HTTP : localhost:1080  (query captured emails via REST)

HTTP API:
  GET /emails                  — list all captured emails (newest first)
  GET /emails/latest?to=<addr> — get latest email for a recipient
  DELETE /emails               — clear the inbox

Every email also prints to this terminal. Nothing is sent externally.
Press Ctrl+C to stop.
"""
import asyncio
import base64
import json
import re
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

from aiosmtpd.controller import Controller

# In-memory store — list of dicts, newest appended last
_inbox: list[dict] = []
_inbox_lock = threading.Lock()


# ── SMTP handler ──────────────────────────────────────────────────────────────

class PrintingHandler:
    async def handle_DATA(self, server, session, envelope):
        raw = envelope.content.decode("utf-8", errors="replace")

        # Parse headers
        headers = {}
        for line in raw.splitlines():
            if not line.strip():
                break
            if ":" in line and not line.startswith(" "):
                k, _, v = line.partition(":")
                headers[k.strip().lower()] = v.strip()

        subject   = headers.get("subject", "(no subject)")
        to_addr   = ", ".join(envelope.rcpt_tos)
        from_addr = envelope.mail_from

        # Decode body — handle MIME multipart + base64
        parts = re.split(r"--[=\w]+", raw)
        text_parts = []
        for part in parts:
            ct = re.search(r"Content-Type:\s*(text/\w+)", part, re.IGNORECASE)
            te = re.search(r"Content-Transfer-Encoding:\s*base64", part, re.IGNORECASE)
            if ct:
                pm = re.search(r"\r?\n\r?\n(.+)", part, re.DOTALL)
                if pm:
                    payload = pm.group(1).strip()
                    if te:
                        try:
                            payload = base64.b64decode(payload).decode("utf-8", errors="replace")
                        except Exception:
                            pass
                    # Strip HTML tags and clean up whitespace
                    payload = re.sub(r"<[^>]+>", "", payload)
                    payload = re.sub(r"&nbsp;", " ", payload)
                    payload = re.sub(r"&amp;", "&", payload)
                    payload = re.sub(r"\s+", " ", payload).strip()
                    if len(payload) > 20:
                        text_parts.append(payload)

        body = text_parts[0] if text_parts else "(could not decode body)"

        entry = {
            "ts":      datetime.now().isoformat(),
            "to":      to_addr,
            "from":    from_addr,
            "subject": subject,
            "body":    body,
        }

        with _inbox_lock:
            _inbox.append(entry)

        # Print to terminal
        sep = "-" * 62
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n{sep}")
        print(f"  EMAIL RECEIVED at {ts}")
        print(sep)
        print(f"  To      : {to_addr}")
        print(f"  From    : {from_addr}")
        print(f"  Subject : {subject}")
        print(sep)
        words = body.split()
        line, lines = "", []
        for w in words:
            if len(line) + len(w) + 1 > 60:
                lines.append(line)
                line = w
            else:
                line = (line + " " + w).strip()
        if line:
            lines.append(line)
        for l in lines:
            print(f"  {l}")
        print(sep)
        sys.stdout.flush()
        return "250 OK"


# ── HTTP API handler ──────────────────────────────────────────────────────────

class ApiHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default HTTP request logs

    def _json(self, code: int, data):
        body = json.dumps(data, indent=2).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/emails":
            with _inbox_lock:
                self._json(200, list(reversed(_inbox)))

        elif parsed.path == "/emails/latest":
            to_filter = params.get("to", [None])[0]
            with _inbox_lock:
                candidates = list(reversed(_inbox))
            if to_filter:
                candidates = [e for e in candidates if to_filter.lower() in e["to"].lower()]
            if candidates:
                self._json(200, candidates[0])
            else:
                self._json(404, {"detail": "No email found"})

        else:
            self._json(404, {"detail": "Not found"})

    def do_DELETE(self):
        if urlparse(self.path).path == "/emails":
            with _inbox_lock:
                _inbox.clear()
            self._json(200, {"cleared": True})
        else:
            self._json(404, {"detail": "Not found"})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    smtp_host, smtp_port = "0.0.0.0", 1025
    http_host, http_port = "0.0.0.0", 1080

    # Start SMTP server
    ctrl = Controller(PrintingHandler(), hostname=smtp_host, port=smtp_port)
    ctrl.start()

    # Start HTTP API server in background thread
    http_server = HTTPServer((http_host, http_port), ApiHandler)
    t = threading.Thread(target=http_server.serve_forever, daemon=True)
    t.start()

    print(f"[OK] SMTP catcher  : {smtp_host}:{smtp_port}")
    print(f"[OK] HTTP API      : http://{http_host}:{http_port}/emails")
    print("     Emails print here + queryable via HTTP. Ctrl+C to stop.\n")

    try:
        loop = asyncio.new_event_loop()
        loop.run_forever()
    except KeyboardInterrupt:
        print("\n[stopped]")
        ctrl.stop()
        http_server.shutdown()
