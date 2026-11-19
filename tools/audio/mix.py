"""Mix voice, music and SFX with ducking: python -m tools.audio.mix <run_dir>."""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

from tools.audio import library as lib

SR = 48000
THRESHOLD_DBFS = -45.0
WINDOW_S = 0.05
MUSIC_BELOW_VOICE_DB = 6.0   # base music level vs voice RMS (over speech), before ducking
DUCK_DB = 12.0               # extra attenuation while speech is on
ATTACK_S = 0.15
RELEASE_S = 0.4
FADE_IN_S = 1.5
FADE_OUT_S = 3.0
LOOP_XFADE_S = 2.0
TAIL_S = 1.0
TARGET_LUFS = -14.0
PEAK_LIMIT_DBFS = -1.0
MIN_GAP_DB = 12.0
SFX_PEAK = 0.5
ENV_RATE = 1000  # Hz, rate of the ducking envelope computation


class MixCheckError(Exception):
    pass


def _resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out or len(x) == 0:
        return np.asarray(x, dtype=np.float64)
    n_out = int(round(len(x) * sr_out / sr_in))
    pos = np.arange(n_out) * (sr_in / sr_out)
    return np.interp(pos, np.arange(len(x)), x)


def _load_mono(path: Path, sr_out: int = SR) -> np.ndarray:
    data, sr = sf.read(str(path), always_2d=True)
    return _resample(data.mean(axis=1), sr, sr_out)


def speech_mask(voice: np.ndarray, sr: int, threshold_dbfs: float = THRESHOLD_DBFS) -> np.ndarray:
    win = max(1, int(round(WINDOW_S * sr)))
    mask = np.zeros(len(voice), dtype=bool)
    thr = 10 ** (threshold_dbfs / 20)
    for s in range(0, len(voice), win):
        seg = voice[s:s + win]
        if np.sqrt(np.mean(seg ** 2)) > thr:
            mask[s:s + win] = True
    return mask


def _rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0


def voice_music_gap_db(voice: np.ndarray, music: np.ndarray, sr: int) -> float:
    n = min(len(voice), len(music))
    voice, music = voice[:n], music[:n]
    mask = speech_mask(voice, sr)
    if not mask.any():
        raise MixCheckError("no speech found")
    v, m = _rms(voice[mask]), _rms(music[mask])
    if m == 0:
        return float("inf")
    return float(20 * np.log10(v / m))


def _loop(music: np.ndarray, length: int) -> np.ndarray:
    if len(music) >= length:
        return music[:length]
    xf = min(int(LOOP_XFADE_S * SR), len(music) // 2)
    fade = np.linspace(0, 1, xf)
    out = music.copy()
    while len(out) < length:
        out = np.concatenate([out[:-xf], out[-xf:] * (1 - fade) + music[:xf] * fade, music[xf:]])
    return out[:length]


def _duck_gain(mask: np.ndarray, sr: int) -> np.ndarray:
    """Smoothed gain curve: 1.0 without speech, -DUCK_DB with speech."""
    step = sr // ENV_RATE
    n_env = len(mask) // step + 1
    padded = np.zeros(n_env * step, dtype=bool)
    padded[:len(mask)] = mask
    target = np.where(padded.reshape(n_env, step).any(axis=1), 10 ** (-DUCK_DB / 20), 1.0)
    a_att = 1 - np.exp(-1 / (ATTACK_S * ENV_RATE))
    a_rel = 1 - np.exp(-1 / (RELEASE_S * ENV_RATE))
    env = np.empty(n_env)
    g = 1.0
    for i, t in enumerate(target):
        g += (a_att if t < g else a_rel) * (t - g)
        env[i] = g
    return np.interp(np.arange(len(mask)) / step, np.arange(n_env), env)


def _write(path: Path, x: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), x, SR, subtype="PCM_24")


@dataclass
class MixResult:
    mix: Path
    stems: dict[str, Path]
    warnings: list[str] = field(default_factory=list)


def build_mix(run_dir: Path, lib_root: Path) -> MixResult:
    run_dir, lib_root = Path(run_dir), Path(lib_root)
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    sound = json.loads((run_dir / "03-design" / "sound.json").read_text(encoding="utf-8"))

    pieces, starts, pos = [], {}, 0
    for sc in manifest["scenes"]:
        w = _load_mono(run_dir / "02-voice" / sc["file"])
        starts[sc["id"]] = pos
        pieces.append(w)
        pos += len(w)
    voice = np.concatenate(pieces) if pieces else np.zeros(0)
    mask = speech_mask(voice, SR)
    if not mask.any():
        raise MixCheckError("no speech found in the voice track")
    total_s = len(voice) / SR
    length = len(voice) + int(TAIL_S * SR)
    voice = np.concatenate([voice, np.zeros(length - len(voice))])
    mask = np.concatenate([mask, np.zeros(length - len(mask), dtype=bool)])

    warnings: list[str] = []
    used: list[dict] = []

    # music
    track, w = lib.pick_music(lib_root, sound.get("music_mood", ""), total_s + TAIL_S)
    warnings += w
    used.append(track)
    music = _loop(_load_mono(lib_root / track["path"]), length)
    base_rms = _rms(music)
    if base_rms == 0:
        raise MixCheckError(f"music track {track['id']} is silent")
    music = music * (_rms(voice[mask]) * 10 ** (-MUSIC_BELOW_VOICE_DB / 20) / base_rms)
    fi, fo = int(FADE_IN_S * SR), int(FADE_OUT_S * SR)
    music[:fi] *= np.linspace(0, 1, fi)
    music[-fo:] *= np.linspace(1, 0, fo)
    music = music * _duck_gain(mask, SR)

    # sfx
    sfx = np.zeros(length)
    for ev in sound.get("sfx", []):
        item = lib.pick_sfx(lib_root, ev["type"])
        if item not in used:
            used.append(item)
        clip = _load_mono(lib_root / item["path"])
        peak = np.max(np.abs(clip)) if len(clip) else 0
        if peak > 0:
            clip = clip * (SFX_PEAK / peak)
        s = starts[ev["scene"]] + int(round(ev["at_s"] * SR))
        e = min(length, s + len(clip))
        if s < length:
            sfx[s:e] += clip[:e - s]

    # loudness: normalise the sum, apply the same gain to every stem
    total = voice + music + sfx
    meter = pyln.Meter(SR)
    stereo = np.stack([total, total], axis=1)
    g = 10 ** ((TARGET_LUFS - meter.integrated_loudness(stereo)) / 20)
    peak_lim = 10 ** (PEAK_LIMIT_DBFS / 20)
    peak = np.max(np.abs(total)) * g
    if peak > peak_lim:
        g *= peak_lim / peak
    stems = {"voice": voice * g, "music": music * g, "sfx": sfx * g}

    audio_dir = run_dir / "04-video" / "audio"
    paths = {}
    for name, x in stems.items():
        paths[name] = audio_dir / f"{name}.wav"
        _write(paths[name], x)
    mix_path = audio_dir / "mix.wav"
    mixed = total * g
    _write(mix_path, np.stack([mixed, mixed], axis=1))

    lib.mark_used(lib_root, [i["id"] for i in used])
    lib.write_credits(used, run_dir / "04-video" / "credits.md")
    return MixResult(mix=mix_path, stems=paths, warnings=warnings)


def check_mix(run_dir: Path) -> dict:
    run_dir = Path(run_dir)
    audio = run_dir / "04-video" / "audio"
    voice, sr = sf.read(str(audio / "voice.wav"))
    music, _ = sf.read(str(audio / "music.wav"))
    mix, msr = sf.read(str(audio / "mix.wav"), always_2d=True)
    gap = voice_music_gap_db(voice, music, sr)
    lufs = float(pyln.Meter(msr).integrated_loudness(mix))
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    sound = json.loads((run_dir / "03-design" / "sound.json").read_text(encoding="utf-8"))
    scenes, sfx_count = len(manifest["scenes"]), len(sound.get("sfx", []))
    problems = []
    if gap < MIN_GAP_DB:
        problems.append(f"music is only {gap:.1f} dB below the voice (need at least {MIN_GAP_DB:.0f} dB)")
    if not -15 <= lufs <= -13:
        problems.append(f"mix loudness is {lufs:.1f} LUFS (need -15 to -13)")
    if sfx_count > scenes:
        problems.append(f"{sfx_count} sound effects for {scenes} scenes (max one per scene on average)")
    return {"gap_db": gap, "lufs": lufs, "sfx_count": sfx_count, "scenes": scenes, "problems": problems}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="tools.audio.mix")
    ap.add_argument("run_dir", type=Path)
    ap.add_argument("--lib-root", type=Path, default=lib.DEFAULT_ROOT)
    args = ap.parse_args(argv)
    try:
        res = build_mix(args.run_dir, args.lib_root)
    except (MixCheckError, lib.LibraryError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"mix written: {res.mix}")
    for w in res.warnings:
        print(f"warning: {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
