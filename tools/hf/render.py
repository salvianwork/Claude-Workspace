"""Check and render a HyperFrames composition with the pinned hf-kit CLI (telemetry off).

    python -m tools.hf.render <composition_dir> <out.mp4> [--workers N]
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


def video_seconds(composition_dir: Path) -> float:
    """Length of the composition from the root element's data-duration (0 if unknown)."""
    try:
        text = (Path(composition_dir) / "index.html").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return 0.0
    m = _ROOT_DURATION.search(text)
    return float(m.group(1) or m.group(2)) if m else 0.0


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


def render(composition_dir: Path, out_mp4: Path, *, workers: int | None = None) -> dict:
    """Check, then render the composition to an MP4. `seconds` is the wall time of both steps."""
    started = time.monotonic()
    composition_dir = Path(composition_dir).resolve()
    out_mp4 = Path(out_mp4).resolve()
    if not (composition_dir / "index.html").is_file():
        raise HFError(f"no index.html in {composition_dir}")
    report = check(composition_dir)
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    workers = workers or default_workers()
    r = _run([*_hyperframes(), "render", "--output", str(out_mp4), "--fps", "30",
              "--workers", str(workers)], composition_dir, "hyperframes render",
             timeout_for(composition_dir))
    if r.returncode != 0 or not out_mp4.is_file():
        raise HFError(f"hyperframes render failed (exit {r.returncode}):\n{_tail(r)}")
    return {"check": report, "seconds": time.monotonic() - started}


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
                props: list[str] | None = None) -> Path:
    """Copy hf-kit's vendor/, src/ and props/ into <composition_dir>/kit/ (HyperFrames only
    serves files inside the composition folder). The old kit/ folder is removed first so no
    stale file survives. `props` limits the copied props to those names (None = all; the
    props/README.md is always copied). Returns the kit folder."""
    kit_dir = Path(kit_dir)
    kit = Path(composition_dir) / "kit"
    if kit.exists():
        shutil.rmtree(kit)
    for part in ("vendor", "src"):
        shutil.copytree(kit_dir / part, kit / part)
    (kit / "props").mkdir(parents=True)
    shutil.copy2(kit_dir / "props" / "README.md", kit / "props" / "README.md")
    names = props if props is not None else sorted(
        d.name for d in (kit_dir / "props").iterdir() if d.is_dir())
    for name in names:
        shutil.copytree(kit_dir / "props" / name, kit / "props" / name)
    return kit


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m tools.hf.render", description=__doc__.splitlines()[0])
    p.add_argument("composition_dir", type=Path)
    p.add_argument("out_mp4", type=Path)
    p.add_argument("--workers", type=int, default=None,
                   help="parallel render workers (default: half the CPUs, at least 1)")
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
