"""Local studio dashboard server (stdlib only, bound to 127.0.0.1).

Security model:
  * Every request must carry a Host header of 127.0.0.1 / localhost (with this
    server's port, or none) -- blocks DNS-rebinding from other websites.
  * POST /api/answer needs the per-start secret in X-Studio-Key (compared with
    hmac.compare_digest). The page learns the key from its own URL (?key=...).
  * GET routes do NOT need the key: they are read-only, localhost-only and
    Host-checked; the key only guards the one route that writes.
  * Files are served only from inside videos/<run>/ (single folder name, no
    "..", resolved path must stay inside the run folder).
"""
from __future__ import annotations

import hmac
import json
import re
import secrets
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from tools.dashboard.answers import AnswerError, write_answer
from tools.dashboard.state import list_runs, load_team, run_state

STATIC = Path(__file__).resolve().parent / "static"
MAX_BODY = 64 * 1024
CHUNK = 64 * 1024
TYPES = {
    ".md": "text/markdown; charset=utf-8", ".json": "application/json", ".wav": "audio/wav",
    ".mp4": "video/mp4", ".png": "image/png", ".js": "text/javascript",
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}
_RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class _Stop(Exception):
    """Abort the request with an already-sent error response."""


def parse_range(header: str | None, size: int):
    """Return None (serve whole file), 'bad' (416) or (start, end) inclusive."""
    m = _RANGE_RE.match((header or "").strip())
    if not m or (not m.group(1) and not m.group(2)):
        return None
    if not m.group(1):  # suffix range bytes=-n
        n = int(m.group(2))
        if n == 0 or size == 0:
            return "bad"
        return max(size - n, 0), size - 1
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else size - 1
    if start >= size or end < start:
        return "bad"
    return start, min(end, size - 1)


class Handler(BaseHTTPRequestHandler):
    server_version = "Studio"
    protocol_version = "HTTP/1.0"

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    # ---- plumbing -------------------------------------------------------
    def _send(self, status: int, body: bytes, ctype: str, extra: dict | None = None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, obj) -> None:
        self._send(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json")

    def _fail(self, status: int, msg: str) -> None:
        self._json(status, {"error": msg})
        raise _Stop

    def _check_host(self) -> None:
        host = (self.headers.get("Host") or "").strip().lower()
        port = self.server.server_address[1]
        if host not in {f"{h}{p}" for h in ("127.0.0.1", "localhost") for p in ("", f":{port}")}:
            self._fail(403, "bad host")

    def _dispatch(self, routes) -> None:
        try:
            self._check_host()
            parts = urlsplit(self.path)
            self.query = parse_qs(parts.query)
            path = parts.path
            for prefix, fn in routes:
                if path == prefix or (prefix != "/" and prefix.endswith("/") and path.startswith(prefix)):
                    return fn(path)
            self._fail(404, "not found")
        except _Stop:
            pass
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception:
            traceback.print_exc(file=sys.stderr)
            try:
                self._json(500, {"error": "internal"})
            except Exception:
                pass

    def do_GET(self):
        self._dispatch([("/", self._index), ("/static/", self._static), ("/api/runs", self._runs),
                        ("/api/state", self._state), ("/files/", self._files)])

    def do_POST(self):
        self._dispatch([("/api/answer", self._answer)])

    # ---- helpers --------------------------------------------------------
    @property
    def root(self) -> Path:
        return self.server.root

    def _run_dir(self, name: str) -> Path:
        if (not name or name in (".", "..") or "/" in name or "\\" in name or "\0" in name
                or ":" in name):
            self._fail(404, "no such run")
        d = self.root / "videos" / name
        if not d.is_dir() or d.resolve().parent != (self.root / "videos").resolve():
            self._fail(404, "no such run")
        return d

    def _safe_file(self, base: Path, rel: str) -> Path:
        parts = unquote(rel).split("/")
        if any(p in ("", ".", "..") or "\\" in p or "\0" in p or ":" in p for p in parts):
            self._fail(403, "forbidden")
        target = (base / Path(*parts)).resolve()
        try:
            target.relative_to(base.resolve())
        except ValueError:
            self._fail(403, "forbidden")
        if not target.is_file():
            self._fail(404, "not found")
        return target

    # ---- routes ---------------------------------------------------------
    def _index(self, path):
        self._serve(self._safe_file(STATIC, "index.html"))

    def _static(self, path):
        self._serve(self._safe_file(STATIC, path[len("/static/"):]))

    def _runs(self, path):
        self._json(200, list_runs(self.root / "videos"))

    def _state(self, path):
        run = self._run_dir((self.query.get("run") or [""])[0])
        self._json(200, run_state(run, load_team(self.root)))

    def _files(self, path):
        rest = unquote(path[len("/files/"):])
        run_name, _, rel = rest.partition("/")
        run = self._run_dir(run_name)
        if not rel:
            self._fail(404, "not found")
        self._serve(self._safe_file(run, rel), ranged=True)

    def _serve(self, f: Path, ranged: bool = False) -> None:
        size = f.stat().st_size
        ctype = TYPES.get(f.suffix.lower(), "application/octet-stream")
        rng = parse_range(self.headers.get("Range"), size) if ranged else None
        if rng == "bad":
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        start, end = rng if rng else (0, size - 1)
        self.send_response(206 if rng else 200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(max(end - start + 1, 0)))
        self.send_header("Cache-Control", "no-store")
        if ranged:
            self.send_header("Accept-Ranges", "bytes")
        if rng:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if self.command == "HEAD" or size == 0:
            return
        with open(f, "rb") as fh:
            fh.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = fh.read(min(CHUNK, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)

    def _answer(self, path):
        key = (self.headers.get("X-Studio-Key") or "").encode("utf-8")
        if not hmac.compare_digest(key, self.server.token.encode("utf-8")):
            self._fail(403, "bad key")
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = -1
        if not 0 < length <= MAX_BODY:
            self._fail(400, "bad body")
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._fail(400, "bad json")
        if not isinstance(data, dict):
            self._fail(400, "bad json")
        run, rid, decision, text = (data.get(k) for k in ("run", "id", "decision", "text"))
        text = "" if text is None else text
        if not all(isinstance(v, str) for v in (run, rid, decision, text)):
            self._fail(400, "run, id, decision and text must be strings")
        run_dir = self._run_dir(run)
        try:
            ans = write_answer(run_dir, rid, decision, text, source="board")
        except AnswerError as e:
            if "already answered" in str(e):
                self._fail(409, "already answered")
            self._fail(400, str(e))
        except (KeyError, TypeError):
            self._fail(400, "bad request file")
        self._json(200, {"ok": True, "answer": ans})


def make_server(root: Path, port: int = 8765, token: str | None = None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.root = Path(root)
    server.token = token or secrets.token_urlsafe(24)
    server.url = f"http://127.0.0.1:{server.server_address[1]}/?key={server.token}"
    return server
