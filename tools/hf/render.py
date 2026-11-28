"""Check and render a HyperFrames composition with the pinned hf-kit CLI (telemetry off).

    python -m tools.hf.render <composition_dir> <out.mp4> [--workers N]

The MP4 is the composition's own size (the root element's data-width x data-height: 1080 x 1920
for a vertical video, 1920 x 1080 for landscape); a render in any other size is an error (no
silent switch of format).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

KIT_DIR = Path(__file__).resolve().parents[2] / "hf-kit"
TIMEOUT_S = 3600  # minimum; a 2-minute video can take 10-30 min on a slow PC
TIMEOUT_PER_VIDEO_S = 40  # render timeout: max(TIMEOUT_S, 40 x video seconds)
_ROOT_DURATION = re.compile(r'data-composition-id="main"[^>]*?data-duration="([0-9.]+)"'
                            r'|data-duration="([0-9.]+)"[^>]*?data-composition-id="main"')
_ROOT_SIZE = re.compile(r'data-composition-id="main"[^>]*?data-width="([0-9]+)"[^>]*?data-height="([0-9]+)"')
_TAIL = 30

# Files a browser would load as code or styles; everything else (licences, notes) is ignored.
_SCANNED = {".html", ".htm", ".js", ".mjs", ".css"}
_SKIP_DIRS = {"node_modules", ".hyperframes", ".git"}
_URL = re.compile(r"https?://[^\s\"'<>()`]+", re.I)
_COMMENT = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)
# Never fetched: the XML namespace names the kit uses, and (only in the vendored GSAP file) the
# bare site URL in GSAP's "target not found" console warning.
_NAMESPACES = {"http://www.w3.org/1999/xhtml", "http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"}
_GSAP_SITE = "https://gsap.com"


class HFError(Exception):
    pass


def _env() -> dict[str, str]:
    env = os.environ.copy()
    env["HYPERFRAMES_NO_TELEMETRY"] = "1"
    return env


def _hyperframes() -> list[str]:
    npx = shutil.which("npx")
    if npx is None:
        raise HFError("npx not found: install Node.js 22+ and run `npm ci` in hf-kit")
    # --prefix: use hf-kit's pinned install whatever folder the composition is in;
    # --no: never download a different version.
    return [npx, "--prefix", str(KIT_DIR), "--no", "--", "hyperframes"]


def default_workers() -> int:
    """Render workers when none are given: half the CPUs, at least 1."""
    return max(1, (os.cpu_count() or 2) // 2)


# A vertical render with more workers was cancelled under load on a 4-CPU machine
# ("render_cancelled_parent_exited"), so a vertical video uses at most this many workers unless
# --workers says otherwise. Any render cancelled with more than 1 worker is retried once with 1.
VERTICAL_MAX_WORKERS = 2
RETRY_MESSAGE = "Render was interrupted; retrying with 1 worker, this is slower."
_CANCELLED = re.compile(r"render_cancel|cancel+ed|worker[^\n]{0,60}(?:exit|crash|die|died|killed|lost)", re.I)


def workers_for(composition_dir: Path) -> int:
    """Default workers for this composition: default_workers(), capped for a vertical video."""
    workers = default_workers()
    w, h = composition_size(composition_dir)
    return min(workers, VERTICAL_MAX_WORKERS) if h > w else workers


def was_cancelled(r: subprocess.CompletedProcess) -> bool:
    """True when a failed `hyperframes render` says it (or one of its workers) was cancelled."""
    return bool(_CANCELLED.search((r.stderr or "") + "\n" + (r.stdout or "")))


def video_seconds(composition_dir: Path) -> float:
    """Length of the composition from the root element's data-duration (0 if unknown)."""
    try:
        text = (Path(composition_dir) / "index.html").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0.0
    m = _ROOT_DURATION.search(text)
    return float(m.group(1) or m.group(2)) if m else 0.0


def composition_size(composition_dir: Path) -> tuple[int, int]:
    """(width, height) of the composition from the root element (1920 x 1080 if it says nothing)."""
    try:
        text = (Path(composition_dir) / "index.html").read_text(encoding="utf-8", errors="replace")
    except OSError:
        text = ""
    m = _ROOT_SIZE.search(text)
    return (int(m.group(1)), int(m.group(2))) if m else (1920, 1080)


FFPROBE_MISSING = ("ffprobe was not found, so the video's size was not checked (it should be {w} x {h}). "
                   "Install FFmpeg, which includes ffprobe: winget install -e --id Gyan.FFmpeg")


def check_output_size(composition_dir: Path, out_mp4: Path) -> str | None:
    """Raise HFError when the rendered MP4 is not the composition's size. Without ffprobe the check
    cannot run: a warning is printed and returned (the video itself is fine), else None."""
    probe = shutil.which("ffprobe")
    if probe is None:
        w, h = composition_size(composition_dir)
        msg = FFPROBE_MISSING.format(w=w, h=h)
        print(f"warning: {msg}", file=sys.stderr, flush=True)
        return msg
    r = _run([probe, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
              "-of", "csv=p=0", str(out_mp4)], Path(out_mp4).parent, "ffprobe", 120)
    try:
        got = tuple(int(v) for v in (r.stdout or "").strip().split(",")[:2])
    except ValueError:
        raise HFError(f"ffprobe could not read the size of {out_mp4}:\n{_tail(r)}")
    want = composition_size(composition_dir)
    if got != want:
        raise HFError(f"the render is {got[0]} x {got[1]}, but the composition is {want[0]} x {want[1]}")
    return None


def timeout_for(composition_dir: Path) -> float:
    return max(TIMEOUT_S, TIMEOUT_PER_VIDEO_S * video_seconds(composition_dir))


def _run(cmd: list[str], cwd: Path, what: str, timeout: float = TIMEOUT_S) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, cwd=str(cwd), env=_env(), capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired as e:
        raise HFError(f"{what} timed out after {timeout:.0f} s") from e
    except OSError as e:
        raise HFError(f"{what} could not start: {e}") from e


def _tail(r: subprocess.CompletedProcess) -> str:
    return "\n".join(((r.stderr or "") + "\n" + (r.stdout or "")).strip().splitlines()[-_TAIL:])


def _sections(report: dict):
    return [(name, sec) for name, sec in report.items()
            if isinstance(sec, dict) and isinstance(sec.get("errorCount"), int)]


def check_errors(report: dict) -> list[str]:
    """One line per error finding in a `hyperframes check --json` report."""
    lines = []
    for name, sec in _sections(report):
        errs = [f for f in sec.get("findings", []) if f.get("severity") == "error"]
        for f in errs:
            where = f" ({f['selector']})" if f.get("selector") else ""
            lines.append(f"{name} {f.get('code', '?')}: {f.get('message', '')}{where}")
        for _ in range(sec["errorCount"] - len(errs)):
            lines.append(f"{name}: error (no details in report)")
    return lines


def check(composition_dir: Path) -> dict:
    """Run `hyperframes check --json`; raise HFError listing the errors if there are any."""
    composition_dir = Path(composition_dir).resolve()
    r = _run([*_hyperframes(), "check", "--json"], composition_dir, "hyperframes check",
             timeout_for(composition_dir))
    try:
        report = json.loads(r.stdout)
    except json.JSONDecodeError:
        raise HFError(f"hyperframes check gave no JSON report (exit {r.returncode}):\n{_tail(r)}")
    errors = check_errors(report)
    if errors:
        raise HFError(f"hyperframes check found {len(errors)} error(s) in {composition_dir}:\n"
                      + "\n".join(errors))
    return report


def _render_once(composition_dir: Path, out_mp4: Path, workers: int) -> subprocess.CompletedProcess:
    return _run([*_hyperframes(), "render", "--output", str(out_mp4), "--fps", "30",
                 "--workers", str(workers)], composition_dir, "hyperframes render",
                timeout_for(composition_dir))


def render(composition_dir: Path, out_mp4: Path, *, workers: int | None = None) -> dict:
    """Check, then render the composition to an MP4. `seconds` is the wall time of both steps.

    A render that fails because it (or a worker) was cancelled, with more than 1 worker, is
    retried once with 1 worker (`retried` in the result). `warnings` lists anything the owner
    should know that did not stop the render (e.g. ffprobe missing)."""
    started = time.monotonic()
    composition_dir = Path(composition_dir).resolve()
    out_mp4 = Path(out_mp4).resolve()
    if not (composition_dir / "index.html").is_file():
        raise HFError(f"no index.html in {composition_dir}")
    report = check(composition_dir)
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    workers = workers or workers_for(composition_dir)
    r = _render_once(composition_dir, out_mp4, workers)
    retried = False
    if (r.returncode != 0 or not out_mp4.is_file()) and workers > 1 and was_cancelled(r):
        print(RETRY_MESSAGE, file=sys.stderr, flush=True)
        try:
            out_mp4.unlink()
        except OSError:
            pass
        retried, workers = True, 1
        r = _render_once(composition_dir, out_mp4, workers)
    if r.returncode != 0 or not out_mp4.is_file():
        again = " (also after a retry with 1 worker)" if retried else ""
        raise HFError(f"hyperframes render failed{again} (exit {r.returncode}):\n{_tail(r)}")
    warnings = [w for w in [check_output_size(composition_dir, out_mp4)] if w]
    return {"check": report, "seconds": time.monotonic() - started, "workers": workers,
            "retried": retried, "warnings": warnings}


def assert_offline(composition_dir: Path) -> list[str]:
    """Remote http(s) URLs in the folder's HTML/JS/CSS (comments and XML namespaces ignored).

    An empty list means the composition loads nothing from the network.
    """
    root = Path(composition_dir)
    found = []
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if path.suffix.lower() not in _SCANNED or not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in rel.parts):
            continue
        text = _COMMENT.sub(" ", path.read_text(encoding="utf-8", errors="replace"))
        vendored_gsap = path.name == "gsap.min.js" and path.parent.name == "vendor"
        for url in _URL.findall(text):
            if url in _NAMESPACES or (vendored_gsap and url == _GSAP_SITE):
                continue
            found.append(f"{rel.as_posix()}: {url}")
    return found


def install_kit(composition_dir: Path, *, kit_dir: Path = KIT_DIR,
                props: list[str] | None = None, places: list[str] | None = None) -> Path:
    """Copy hf-kit's vendor/, src/, props/ and places/ into <composition_dir>/kit/ (HyperFrames
    only serves files inside the composition folder). The old kit/ folder is removed first so no
    stale file survives. `props` and `places` limit the copied library entries to those names
    (None = all; each library's README.md is always copied). Returns the kit folder."""
    kit_dir = Path(kit_dir)
    kit = Path(composition_dir) / "kit"
    if kit.exists():
        shutil.rmtree(kit)
    for part in ("vendor", "src"):
        shutil.copytree(kit_dir / part, kit / part)
    for lib, only in (("props", props), ("places", places)):
        src = kit_dir / lib
        (kit / lib).mkdir(parents=True)
        if not src.is_dir():
            continue
        if (src / "README.md").is_file():
            shutil.copy2(src / "README.md", kit / lib / "README.md")
        names = only if only is not None else sorted(d.name for d in src.iterdir() if d.is_dir())
        for name in names:
            shutil.copytree(src / name, kit / lib / name)
    return kit


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tools.hf.render", description=__doc__.splitlines()[0])
    p.add_argument("composition_dir", type=Path)
    p.add_argument("out_mp4", type=Path)
    p.add_argument("--workers", type=int, default=None,
                   help="parallel render workers (default: half the CPUs, at least 1; at most "
                        f"{VERTICAL_MAX_WORKERS} for a vertical video)")
    a = p.parse_args(argv)
    try:
        result = render(a.composition_dir, a.out_mp4, workers=a.workers)
    except HFError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(json.dumps({"out": str(a.out_mp4), "seconds": round(result["seconds"], 1),
                      "warnings": sum(s.get("warningCount", 0) for _, s in _sections(result["check"]))}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
