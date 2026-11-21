import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from tools.hf import render as hf
from tools.hf.render import HFError, assert_offline, install_kit, render

REPO = Path(__file__).resolve().parents[2]
KIT = REPO / "hf-kit"
SAMPLE = KIT / "sample"

needs_hf = pytest.mark.skipif(
    shutil.which("npx") is None or not (KIT / "node_modules" / "hyperframes").is_dir(),
    reason="needs npx and `npm ci` in hf-kit")

OK_CHECK = {"ok": True, "lint": {"errorCount": 0, "findings": []},
            "runtime": {"errorCount": 0, "findings": []}}

BROKEN_HTML = """<!doctype html>
<html lang="en"><head><meta charset="UTF-8">
<style>html,body{margin:0;width:1920px;height:1080px;background:#0F172A}</style>
<script src="kit/vendor/missing-gsap.js"></script></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="1"
 data-width="1920" data-height="1080"></div>
<script>window.__timelines = {}; window.__timelines.main = gsap.timeline({paused: true});</script>
</body></html>
"""


def _ffprobe(path: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate", "-of", "json", str(path)],
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)["streams"][0]


class FakeRun:
    """Stands in for subprocess.run: answers `check --json` and fakes the mp4."""

    def __init__(self, check=OK_CHECK):
        self.calls = []
        self.check = check

    def __call__(self, cmd, **kw):
        self.calls.append((cmd, kw))
        if "check" in cmd:
            return subprocess.CompletedProcess(cmd, 0, json.dumps(self.check), "")
        out = Path(cmd[cmd.index("--output") + 1])
        out.write_bytes(b"mp4")
        return subprocess.CompletedProcess(cmd, 0, "done", "")


def _fake_comp(tmp_path: Path) -> Path:
    comp = tmp_path / "my comp"  # space on purpose (Windows paths)
    comp.mkdir()
    (comp / "index.html").write_text("<html></html>", encoding="utf-8")
    return comp


def test_telemetry_env_set(tmp_path, monkeypatch):
    fake = FakeRun()
    monkeypatch.setattr(hf.subprocess, "run", fake)
    monkeypatch.setattr(hf.shutil, "which", lambda name: "/fake/bin/npx" if name == "npx" else None)
    monkeypatch.setenv("SOME_USER_VAR", "kept")
    comp = _fake_comp(tmp_path)
    result = render(comp, tmp_path / "out dir" / "v.mp4", workers=2)
    assert len(fake.calls) == 2
    check_cmd, render_cmd = fake.calls[0][0], fake.calls[1][0]
    assert check_cmd[0] == "/fake/bin/npx" and "check" in check_cmd and "--json" in check_cmd
    assert render_cmd[0] == "/fake/bin/npx" and "render" in render_cmd
    assert render_cmd[render_cmd.index("--workers") + 1] == "2"
    for cmd, kw in fake.calls:
        assert isinstance(cmd, list)
        assert kw["env"]["HYPERFRAMES_NO_TELEMETRY"] == "1"
        assert kw["env"]["SOME_USER_VAR"] == "kept"  # environment passed through
        assert Path(kw["cwd"]) == comp
        assert kw["encoding"] == "utf-8" and kw["errors"] == "replace"
        assert kw.get("shell") in (None, False)
    assert result["check"] == OK_CHECK
    assert isinstance(result["seconds"], float)


def test_check_errors_from_json_raise(tmp_path, monkeypatch):
    bad = {"ok": False, "lint": {"errorCount": 0, "findings": []},
           "runtime": {"errorCount": 1, "findings": [
               {"severity": "error", "code": "http_error", "message": "404 loading x.js"}]}}
    fake = FakeRun(check=bad)
    monkeypatch.setattr(hf.subprocess, "run", fake)
    monkeypatch.setattr(hf.shutil, "which", lambda name: "/fake/bin/npx")
    with pytest.raises(HFError, match="404 loading x.js"):
        render(_fake_comp(tmp_path), tmp_path / "v.mp4")
    assert len(fake.calls) == 1  # never renders after a failed check


def test_missing_npx_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(hf.shutil, "which", lambda name: None)
    with pytest.raises(HFError, match="npx"):
        render(_fake_comp(tmp_path), tmp_path / "v.mp4")


@needs_hf
def test_check_errors_raise(tmp_path):
    comp = tmp_path / "broken comp"
    comp.mkdir()
    (comp / "index.html").write_text(BROKEN_HTML, encoding="utf-8")
    with pytest.raises(HFError) as e:
        render(comp, tmp_path / "never.mp4")
    assert "missing-gsap.js" in str(e.value)
    assert not (tmp_path / "never.mp4").exists()


def test_assert_offline_finds_remote_urls(tmp_path):
    (tmp_path / "index.html").write_text(
        '<!-- see https://example.com/docs -->\n'
        '<svg xmlns="http://www.w3.org/2000/svg"></svg>\n'
        '<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>\n'
        '<link rel="stylesheet" href="http://fonts.googleapis.com/css2?family=Inter">\n',
        encoding="utf-8")
    sub = tmp_path / "kit"
    sub.mkdir()
    (sub / "a.css").write_text('/*! licence https://x.org */ @import url("https://evil.test/a.css");',
                               encoding="utf-8")
    (sub / "b.js").write_text('/*! GSAP https://gsap.com */ fetch("https://api.test/x")', encoding="utf-8")
    (sub / "notes.txt").write_text("https://ignored.test", encoding="utf-8")
    found = assert_offline(tmp_path)
    assert any("cdn.jsdelivr.net" in f for f in found)
    assert any("fonts.googleapis.com" in f for f in found)
    assert any("evil.test" in f for f in found)
    assert any("api.test" in f for f in found)
    assert not any(s in f for f in found for s in ("w3.org", "example.com", "gsap.com", "x.org", "ignored"))


def test_install_kit_copies_vendor_src_and_props(tmp_path):
    install_kit(tmp_path)
    assert (tmp_path / "kit" / "vendor" / "gsap.min.js").is_file()
    assert (tmp_path / "kit" / "vendor" / "fonts" / "fonts.css").is_file()
    assert (tmp_path / "kit" / "vendor" / "fonts" / "inter-latin-400-normal.woff2").is_file()
    assert (tmp_path / "kit" / "vendor" / "fonts" / "poppins-latin-700-normal.woff2").is_file()
    assert (tmp_path / "kit" / "src" / "kit.js").is_file()
    assert (tmp_path / "kit" / "props" / "volcano" / "prop.js").is_file()
    install_kit(tmp_path)  # idempotent


def test_vendor_is_offline_and_licensed():
    assert assert_offline(KIT / "vendor") == []
    assert assert_offline(KIT / "src") == []
    lic = (KIT / "vendor" / "LICENSES.md").read_text(encoding="utf-8")
    for needle in ("gsap", "3.15.1", "@fontsource/inter", "@fontsource/poppins", "OFL"):
        assert needle in lic
    pkg = json.loads((KIT / "package.json").read_text(encoding="utf-8"))
    assert pkg["dependencies"]["hyperframes"] == "0.9.72"


def test_cli_reports_hferror(tmp_path, monkeypatch, capsys):
    def boom(*a, **k):
        raise HFError("check failed: 1 error(s)")
    monkeypatch.setattr(hf, "render", boom)
    assert hf.main([str(tmp_path), str(tmp_path / "o.mp4")]) == 1
    assert "check failed" in capsys.readouterr().err


@pytest.mark.slow
@needs_hf
def test_sample_renders_offline(tmp_path, monkeypatch):
    # Dead proxy + empty font cache: any network fetch at render time fails.
    for var in ("HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy"):
        monkeypatch.setenv(var, "http://127.0.0.1:9")
    monkeypatch.setenv("NO_PROXY", "")
    monkeypatch.setenv("no_proxy", "")
    monkeypatch.setenv("HYPERFRAMES_FONT_CACHE_DIR", str(tmp_path / "empty-font-cache"))
    install_kit(SAMPLE)
    out = tmp_path / "sample out.mp4"
    result = render(SAMPLE, out)
    print(f"sample render took {result['seconds']:.1f} s")
    assert out.is_file() and out.stat().st_size > 10_000
    v = _ffprobe(out)
    assert (v["width"], v["height"]) == (1920, 1080)
    assert v["r_frame_rate"] == "30/1"
    assert assert_offline(SAMPLE) == []
    assert not any((tmp_path / "empty-font-cache").rglob("*.woff2"))  # nothing fetched


def test_assert_offline_allows_only_known_namespaces_and_vendored_gsap(tmp_path):
    (tmp_path / "vendor").mkdir()
    (tmp_path / "vendor" / "gsap.min.js").write_text('console.warn("see https://gsap.com")', encoding="utf-8")
    (tmp_path / "a.js").write_text(
        'var a="http://www.w3.org/2000/svg", b="http://www.w3.org/1999/xhtml", c="http://www.w3.org/1999/xlink";\n'
        'fetch("https://www.w3.org/2000/evil.js"); fetch("https://gsap.com");', encoding="utf-8")
    found = assert_offline(tmp_path)
    assert found == ["a.js: https://www.w3.org/2000/evil.js", "a.js: https://gsap.com"]


def test_install_kit_clears_stale_files_and_can_limit_props(tmp_path):
    stale = tmp_path / "kit" / "src" / "old.js"
    stale.parent.mkdir(parents=True)
    stale.write_text("stale", encoding="utf-8")
    install_kit(tmp_path, props=[])
    assert not stale.exists()
    assert (tmp_path / "kit" / "src" / "kit.js").is_file()
    assert not (tmp_path / "kit" / "props" / "volcano").exists()
    install_kit(tmp_path, props=["volcano"])
    assert (tmp_path / "kit" / "props" / "volcano" / "prop.js").is_file()


def test_render_workers_default_to_half_the_cpus(tmp_path, monkeypatch):
    fake = FakeRun()
    monkeypatch.setattr(hf.subprocess, "run", fake)
    monkeypatch.setattr(hf.shutil, "which", lambda name: "/fake/bin/npx")
    monkeypatch.setattr(hf.os, "cpu_count", lambda: 8)
    render(_fake_comp(tmp_path), tmp_path / "v.mp4")
    cmd = fake.calls[1][0]
    assert cmd[cmd.index("--workers") + 1] == "4"
    monkeypatch.setattr(hf.os, "cpu_count", lambda: 1)
    assert hf.default_workers() == 1
    monkeypatch.setattr(hf.os, "cpu_count", lambda: None)
    assert hf.default_workers() == 1


def test_timeout_scales_with_video_length(tmp_path, monkeypatch):
    fake = FakeRun()
    monkeypatch.setattr(hf.subprocess, "run", fake)
    monkeypatch.setattr(hf.shutil, "which", lambda name: "/fake/bin/npx")
    comp = _fake_comp(tmp_path)
    render(comp, tmp_path / "short.mp4")
    assert [kw["timeout"] for _, kw in fake.calls] == [3600, 3600]  # no duration known: minimum
    (comp / "index.html").write_text(
        '<div id="root" data-composition-id="main" data-start="0" data-duration="300.5" '
        'data-width="1920"><div class="clip" data-duration="2"></div></div>', encoding="utf-8")
    fake.calls.clear()
    render(comp, tmp_path / "long.mp4")
    assert [kw["timeout"] for _, kw in fake.calls] == [40 * 300.5, 40 * 300.5]
    assert hf.timeout_for(comp) == 12020


def test_cli_workers_option(tmp_path, monkeypatch):
    seen = {}
    monkeypatch.setattr(hf, "render", lambda c, o, workers=None: seen.update(w=workers) or {"check": {}, "seconds": 1.0})
    assert hf.main([str(tmp_path), str(tmp_path / "o.mp4"), "--workers", "6"]) == 0
    assert seen == {"w": 6}
    assert hf.main([str(tmp_path), str(tmp_path / "o.mp4")]) == 0
    assert seen == {"w": None}
