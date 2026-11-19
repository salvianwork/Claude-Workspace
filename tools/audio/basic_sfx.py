"""Synthesised backup sound effects: python -m tools.audio.basic_sfx."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from tools.audio import library as lib

SR = 48000
SOURCE = "generated:tools/audio/basic_sfx.py"
PEAK = 10 ** (-1.5 / 20)


def _t(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def _lowpass(x: np.ndarray, k: int) -> np.ndarray:
    return np.convolve(x, np.ones(k) / k, mode="same")


def _sweep(rising: bool, seconds: float, rng) -> np.ndarray:
    t = _t(seconds)
    noise = rng.standard_normal(len(t))
    sm = _lowpass(noise, 8) - _lowpass(noise, 80)  # band-ish noise
    env = np.sin(np.pi * t / seconds) ** 2
    ramp = t / seconds if rising else 1 - t / seconds
    return sm * env * (0.3 + 0.7 * ramp)


def _make(kind: str) -> np.ndarray:
    rng = np.random.default_rng(7)
    if kind == "whoosh":
        return _sweep(False, 0.8, rng)
    if kind == "swoosh-in":
        return _sweep(True, 0.6, rng)
    if kind == "pop":
        t = _t(0.12)
        return np.sin(2 * np.pi * (700 - 3500 * t) * t) * np.exp(-t * 40)
    if kind == "ding":
        t = _t(1.0)
        return sum(a * np.sin(2 * np.pi * f * t) for f, a in ((1320, 1), (2640, .4), (3960, .15))) * np.exp(-t * 5)
    if kind == "click":
        t = _t(0.03)
        x = rng.standard_normal(len(t)) * np.exp(-t / 0.0015)
        x[int(0.005 * SR):] *= 0.05
        return x
    if kind == "reveal":
        t = _t(1.0)
        env = np.minimum(t / 0.3, 1) * np.exp(-np.maximum(t - 0.4, 0) * 4)
        return sum(np.sin(2 * np.pi * f * t) for f in (440, 554.4, 659.3, 880)) * env
    raise ValueError(kind)


def _normalise(x: np.ndarray) -> np.ndarray:
    n = max(int(0.005 * SR), 1)
    x = x.copy()
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x / np.abs(x).max() * PEAK


def generate_basic_sfx(lib_root: Path) -> list[dict]:
    lib_root = Path(lib_root)
    existing = {i["id"] for i in lib.load_items(lib_root)}
    added = []
    with tempfile.TemporaryDirectory() as tmp:
        for kind in lib.SFX_TYPES:
            name = f"basic-{kind}"
            dest = lib_root / "sfx" / f"{name}.wav"
            if f"sfx-{name}" in existing:
                if not dest.exists():  # entry present, file lost: rewrite it
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    sf.write(str(dest), _normalise(_make(kind)), SR, subtype="PCM_16")
                continue
            f = Path(tmp) / f"{name}.wav"
            sf.write(str(f), _normalise(_make(kind)), SR, subtype="PCM_16")
            added.append(lib.add_item(lib_root, f, "sfx", [kind], "CC0-1.0", SOURCE))
    return added


def main() -> int:
    items = generate_basic_sfx(lib.DEFAULT_ROOT)
    print(f"generated {len(items)} sound effects")
    return 0


if __name__ == "__main__":
    sys.exit(main())
