import json
import shutil
import threading
import urllib.error
import urllib.request
from http.client import HTTPConnection
from pathlib import Path

import pytest

from tools.dashboard.server import make_server

FIX = Path(__file__).resolve().parent.parent / "fixtures" / "runs"
TOKEN = "testtoken"


@pytest.fixture
def srv(tmp_path):
    (tmp_path / "team.json").write_text((Path(__file__).resolve().parents[2] / "team.json").read_text(encoding="utf-8"), encoding="utf-8")
    for name in ("gate1-waiting", "done", "gate2-waiting"):
        shutil.copytree(FIX / name, tmp_path / "videos" / name)
    server = make_server(tmp_path, port=0, token=TOKEN)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    server.root = tmp_path
    yield server
    server.shutdown()
    server.server_close()


def req(srv, method, path, headers=None, body=None, host=None):
    port = srv.server_address[1]
    c = HTTPConnection("127.0.0.1", port, timeout=5)
    h = {"Host": host or f"127.0.0.1:{port}"}
    h.update(headers or {})
    c.request(method, path, body=body, headers=h)
    r = c.getresponse()
    data = r.read()
    c.close()
    return r, data


def post_answer(srv, payload, key=TOKEN):
    h = {"Content-Type": "application/json"}
    if key is not None:
        h["X-Studio-Key"] = key
    return req(srv, "POST", "/api/answer", h, json.dumps(payload))


def test_binds_localhost_only(srv):
    assert srv.server_address[0] == "127.0.0.1"
    assert srv.token == TOKEN
    assert srv.url == f"http://127.0.0.1:{srv.server_address[1]}/?key={TOKEN}"


def test_default_token(tmp_path):
    s = make_server(tmp_path, port=0)
    try:
        assert len(s.token) >= 24
    finally:
        s.server_close()


def test_index_and_no_store(srv):
    r, data = req(srv, "GET", "/")
    assert r.status == 200 and b"<html" in data.lower()
    assert r.getheader("Cache-Control") == "no-store"
    assert r.getheader("Content-Type") == "text/html; charset=utf-8"


def test_static_traversal_refused(srv):
    r, _ = req(srv, "GET", "/static/../server.py")
    assert r.status in (403, 404)
    r, _ = req(srv, "GET", "/static/%2e%2e/server.py")
    assert r.status in (403, 404)


def test_runs_endpoint(srv):
    r, data = req(srv, "GET", "/api/runs")
    assert r.status == 200
    assert {x["run"] for x in json.loads(data)} == {"gate1-waiting", "done", "gate2-waiting"}


def test_state_endpoint(srv):
    r, data = req(srv, "GET", "/api/state?run=gate1-waiting")
    assert r.status == 200
    s = json.loads(data)
    assert s["state"] == "waiting_owner" and s["request"]["id"] == "gate-1-1"
    assert s["team"]["story"]["name"] == "Quill"


def test_state_bad_run(srv):
    for q in ("nope", "..", "a/b", "", "..%2f", "%2e%2e"):
        r, _ = req(srv, "GET", f"/api/state?run={q}")
        assert r.status == 404, q
    r, _ = req(srv, "GET", "/api/state")
    assert r.status == 404


def test_half_written_status_is_starting_not_500(srv):
    run = srv.root / "videos" / "gate1-waiting"
    (run / "status.json").write_text('{"step": "sto', encoding="utf-8")
    r, data = req(srv, "GET", "/api/state?run=gate1-waiting")
    assert r.status == 200 and json.loads(data)["state"] == "starting"
    r, _ = req(srv, "GET", "/api/runs")
    assert r.status == 200


def test_unknown_route_404(srv):
    r, data = req(srv, "GET", "/nothing")
    assert r.status == 404 and json.loads(data)["error"]


def test_answer_requires_key(srv):
    p = {"run": "gate1-waiting", "id": "gate-1-1", "decision": "approve", "text": ""}
    assert post_answer(srv, p, key=None)[0].status == 403
    assert post_answer(srv, p, key="wrong")[0].status == 403
    assert not (srv.root / "videos/gate1-waiting/board/answer-gate-1-1.json").exists()


def test_answer_once(srv):
    p = {"run": "gate1-waiting", "id": "gate-1-1", "decision": "approve", "text": ""}
    r, data = post_answer(srv, p)
    assert r.status == 200
    body = json.loads(data)
    assert body["ok"] is True and body["answer"]["decision"] == "approve" and body["answer"]["source"] == "board"
    r, data = post_answer(srv, p)
    assert r.status == 409 and json.loads(data) == {"error": "already answered"}


def test_answer_bad_input(srv):
    base = {"run": "gate1-waiting", "id": "gate-1-1", "decision": "approve", "text": ""}
    assert post_answer(srv, {**base, "decision": "bogus"})[0].status == 400
    assert post_answer(srv, {**base, "id": "gate-9-9"})[0].status == 400
    assert post_answer(srv, {**base, "text": 5})[0].status == 400
    assert post_answer(srv, {**base, "run": "../x"})[0].status == 404
    r, _ = req(srv, "POST", "/api/answer", {"X-Studio-Key": TOKEN}, "not json")
    assert r.status == 400
    r, _ = req(srv, "POST", "/api/answer", {"X-Studio-Key": TOKEN}, "[1]")
    assert r.status == 400


def test_post_bad_host_rejected_even_with_key(srv):
    r, _ = req(srv, "POST", "/api/answer", {"X-Studio-Key": TOKEN}, "{}", host="evil.example")
    assert r.status == 403


def test_bad_host_rejected(srv):
    r, _ = req(srv, "GET", "/api/runs", host="evil.example")
    assert r.status == 403
    r, _ = req(srv, "GET", "/api/runs", host="evil.example:80")
    assert r.status == 403
    r, _ = req(srv, "GET", "/api/runs", host=f"127.0.0.1:{srv.server_address[1] + 1}")
    assert r.status == 403
    r, _ = req(srv, "GET", "/api/runs", host=f"localhost:{srv.server_address[1]}")
    assert r.status == 200
    r, _ = req(srv, "GET", "/api/runs", host="localhost")
    assert r.status == 200


@pytest.mark.parametrize("path", [
    "/files/gate1-waiting/../../team.json",
    "/files/gate1-waiting/%2e%2e/%2e%2e/team.json",
    "/files/gate1-waiting/..%2f..%2fteam.json",
    "/files/gate1-waiting//etc/passwd",
    "/files/gate1-waiting/%2Fetc/passwd",
    "/files/..%2fvideos/done/status.json",
])
def test_path_traversal_refused(srv, path):
    r, data = req(srv, "GET", path)
    assert r.status in (403, 404)
    assert b"Quill" not in data


def test_files_not_symlink_escape_and_dirs(srv):
    run = srv.root / "videos" / "gate1-waiting"
    r, _ = req(srv, "GET", "/files/gate1-waiting/01-script")
    assert r.status == 404
    secret = srv.root / "secret.txt"
    secret.write_text("s", encoding="utf-8")
    try:
        (run / "link.txt").symlink_to(secret)
    except OSError:
        pytest.skip("no symlinks")
    r, _ = req(srv, "GET", "/files/gate1-waiting/link.txt")
    assert r.status in (403, 404)


def test_serves_md_json(srv):
    r, data = req(srv, "GET", "/files/gate1-waiting/01-script/script.md")
    assert r.status == 200 and r.getheader("Content-Type") == "text/markdown; charset=utf-8"
    r, _ = req(srv, "GET", "/files/gate1-waiting/status.json")
    assert r.getheader("Content-Type") == "application/json"


def test_serves_wav_with_range(srv):
    path = "/files/done/02-voice/scene-01.wav"
    wav = srv.root / "videos/done/02-voice/scene-01.wav"
    wav.write_bytes(bytes(range(256)) * 4)  # fixture is tiny; use 1024 bytes
    full = wav.read_bytes()
    r, data = req(srv, "GET", path, {"Range": "bytes=0-99"})
    assert r.status == 206 and data == full[:100]
    assert r.getheader("Content-Range") == f"bytes 0-99/{len(full)}"
    assert r.getheader("Content-Type") == "audio/wav"
    assert r.getheader("Accept-Ranges") == "bytes"
    r, data = req(srv, "GET", path, {"Range": "bytes=10-"})
    assert r.status == 206 and data == full[10:]
    r, data = req(srv, "GET", path, {"Range": "bytes=0-1,5-6"})
    assert r.status == 200 and data == full
    r, data = req(srv, "GET", path, {"Range": "garbage"})
    assert r.status == 200 and data == full
    r, data = req(srv, "GET", path)
    assert r.status == 200 and data == full
    r, _ = req(srv, "GET", path, {"Range": f"bytes={len(full) + 5}-"})
    assert r.status == 416


def test_stalled_post_times_out_and_server_stays_up(srv, monkeypatch):
    import socket
    import time
    from tools.dashboard import server as S
    monkeypatch.setattr(S.Handler, "timeout", 1)
    port = srv.server_address[1]
    s = socket.create_connection(("127.0.0.1", port), timeout=12)
    s.sendall(f"POST /api/answer HTTP/1.0\r\nHost: 127.0.0.1:{port}\r\nX-Studio-Key: {TOKEN}\r\n"
              "Content-Length: 100\r\n\r\n1234567".encode())
    assert req(srv, "GET", "/api/runs")[0].status == 200  # others still served
    t0 = time.time()
    try:
        data = s.recv(100)  # b"" (closed) or an error answer; must not hang
    except OSError:
        data = b""
    assert time.time() - t0 < 12
    s.close()


def test_exclusive_bind_when_reuse_off(srv, monkeypatch):
    from tools.dashboard import server as S
    monkeypatch.setattr(S.StudioServer, "allow_reuse_address", False)
    with pytest.raises(OSError):
        S.make_server(srv.root, port=srv.server_address[1])


def test_deeply_nested_json_is_400(srv):
    body = "[" * 100000 + "]" * 100000
    r, _ = req(srv, "POST", "/api/answer", {"X-Studio-Key": TOKEN}, body)
    assert r.status == 400


def test_stale_answer_refused(srv):
    for name in ("done", "stale-request"):
        shutil.copytree(FIX / name, srv.root / "videos" / name, dirs_exist_ok=True)
    rid = json.loads((FIX / "stale-request/board/request.json").read_text(encoding="utf-8"))["id"]
    for name in ("done", "stale-request"):
        p = {"run": name, "id": rid, "decision": "approve", "text": ""}
        r, data = post_answer(srv, p)
        assert r.status == 409 and json.loads(data) == {"error": "stale"}, name


def test_head_options_and_errors_are_json(srv):
    r, data = req(srv, "HEAD", "/api/runs")
    assert r.status == 200 and data == b""
    r, _ = req(srv, "HEAD", "/api/runs", host="evil.example")
    assert r.status == 403
    r, data = req(srv, "OPTIONS", "/api/runs", host="evil.example")
    assert r.status == 403
    r, data = req(srv, "PUT", "/api/runs")
    assert r.status == 501 and json.loads(data)["error"] and r.getheader("Cache-Control") == "no-store"
