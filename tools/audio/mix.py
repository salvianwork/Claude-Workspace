"""Mix voice, music and SFX with ducking: python -m tools.audio.mix <run_dir>.

Loudness: the summed mix gets one gain envelope (make-up gain to -14 LUFS times a
look-ahead peak limiter with a -1 dBFS ceiling). The written stems (voice, music,
sfx) are scaled by that SAME envelope, so they add up to mix.wav and check_mix
measures the voice/music gap exactly as the listener hears it.
"""
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
MUSIC_BELOW_VOICE_DB = 10.0  # base music level vs voice RMS (over speech), before ducking
DUCK_DB = 12.0               # extra attenuation while speech is on
MASK_CLOSE_S = 0.3           # pauses shorter than this keep the music ducked (no pumping)
ATTACK_S = 0.15
RELEASE_S = 0.4
FADE_IN_S = 1.5
FADE_OUT_S = 3.0
LOOP_XFADE_S = 2.0
TAIL_S = 1.0
TARGET_LUFS = -14.0
PEAK_LIMIT_DBFS = -1.0
MIN_GAP_DB = 12.0
WARN_GAP_DB = 14.0           # build_mix warns below this (check_mix fails below MIN_GAP_DB)
SFX_BELOW_VOICE_DB = 4.0     # loudest 100 ms of each effect vs voice speech RMS
SFX_DUCK_DB = 6.0            # extra attenuation of effects while speech is on
SFX_WINDOW_S = 0.1
LIMIT_LOOKAHEAD_S = 0.005
LIMIT_RELEASE_S = 0.08       # time for the limiter to recover 6 dB
LIMIT_MARGIN_DB = 0.05       # aim a hair under the ceiling so 24-bit rounding never crosses it
ENV_RATE = 1000  # Hz, rate of the ducking envelope computation


class MixCheckError(Exception):
    pass


def _resample(x: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    if sr_in == sr_out or len(x) == 0:
        return np.asarray(x, dtype=np.float64)
    n_out = int(round(len(x) * sr_out / sr_in))
    pos = np.arange(n_out) * (sr_in / sr_out)
    return np.interp(pos, np.arange(len(x)), x)


def _upsample2(x: np.ndarray, half_taps: int = 32, beta: float = 8.0) -> np.ndarray:
    """Exact 2x upsample with a Kaiser-windowed sinc (keeps the voice's top end clean)."""
    x = np.asarray(x, dtype=np.float64)
    if len(x) == 0:
        return x
    m = np.arange(-half_taps, half_taps)
    n = 2 * m + 1  # odd output offsets
    taps = np.sinc(n / 2) * np.kaiser(2 * half_taps, beta)
    taps /= taps.sum()
    odd = np.convolve(x, taps, mode="full")[half_taps:half_taps + len(x)]
    out = np.empty(2 * len(x))
    out[0::2], out[1::2] = x, odd
    return out


def _load_mono(path: Path, sr_out: int = SR) -> np.ndarray:
    data, sr = sf.read(str(path), always_2d=True)
    mono = data.mean(axis=1)
    if sr_out == 2 * sr:
        return _upsample2(mono)
    return _resample(mono, sr, sr_out)


def speech_mask(voice: np.ndarray, sr: int, threshold_dbfs: float = THRESHOLD_DBFS) -> np.ndarray:
    win = max(1, int(round(WINDOW_S * sr)))
    mask = np.zeros(len(voice), dtype=bool)
    thr = 10 ** (threshold_dbfs / 20)
    for s in range(0, len(voice), win):
        seg = voice[s:s + win]
        if np.sqrt(np.mean(seg ** 2)) > thr:
            mask[s:s + win] = True
    return mask


def close_gaps(mask: np.ndarray, sr: int, gap_s: float = MASK_CLOSE_S) -> np.ndarray:
    """Fill pauses shorter than ``gap_s`` that sit between two stretches of speech."""
    m = np.asarray(mask, dtype=bool).copy()
    if not m.any():
        return m
    edges = np.flatnonzero(np.diff(m.astype(np.int8))) + 1
    bounds = np.concatenate([[0], edges, [len(m)]])
    max_gap = gap_s * sr
    for a, b in zip(bounds[:-1], bounds[1:]):
        if not m[a] and a > 0 and b < len(m) and (b - a) < max_gap:
            m[a:b] = True
    return m


def _moving_mean(x: np.ndarray, n: int) -> np.ndarray:
    """Mean of x[t-n+1 .. t] (trailing window; the start uses what is there)."""
    if n <= 1:
        return np.asarray(x, dtype=np.float64)
    c = np.concatenate([[0.0], np.cumsum(x, dtype=np.float64)])
    idx = np.arange(1, len(x) + 1)
    lo = np.maximum(0, idx - n)
    return (c[idx] - c[lo]) / (idx - lo)


def _forward_max(x: np.ndarray, n: int) -> np.ndarray:
    """max(x[t .. t+n-1]) for every t, in O(len) (van Herk / Gil-Werman)."""
    if n <= 1 or len(x) == 0:
        return np.asarray(x, dtype=np.float64)
    L = len(x)
    blocks = -(-(L + n) // n)
    pad = np.full(blocks * n, -np.inf)
    pad[:L] = x
    b = pad.reshape(blocks, n)
    prefix = np.maximum.accumulate(b, axis=1).ravel()
    suffix = np.maximum.accumulate(b[:, ::-1], axis=1)[:, ::-1].ravel()
    t = np.arange(L)
    return np.maximum(suffix[t], prefix[t + n - 1])


def _release(att_db: np.ndarray, sr: int, release_s: float, release_db: float = 6.0) -> np.ndarray:
    """Attenuation may jump up at once but only falls back at release_db per release_s."""
    rate = release_db / (release_s * sr)  # dB per sample
    t = np.arange(len(att_db))
    return np.maximum.accumulate(att_db + rate * t) - rate * t


def limiter_gain(x: np.ndarray, sr: int, ceiling_db: float = PEAK_LIMIT_DBFS) -> np.ndarray:
    """Look-ahead peak limiter gain (<= 1) so that |x * gain| <= ceiling everywhere.

    Required attenuation is held over the look-ahead window, released slowly, then
    smoothed with a box of the look-ahead length (so the gain ramps down *before* a
    peak instead of clicking). Each step only ever increases the attenuation, so the
    ceiling is guaranteed.
    """
    ceiling = 10 ** (ceiling_db / 20)
    a = np.abs(x)
    with np.errstate(divide="ignore"):
        need = np.maximum(0.0, 20 * np.log10(np.maximum(a, 1e-12) / ceiling))
    if not need.any():
        return np.ones(len(x))
    n = max(1, int(round(LIMIT_LOOKAHEAD_S * sr)))
    att = _forward_max(need, n)
    att = _release(att, sr, LIMIT_RELEASE_S)
    att = _moving_mean(att, n)
    return 10 ** (-att / 20)


def _max_window_rms(x: np.ndarray, sr: int, window_s: float = SFX_WINDOW_S) -> float:
    if len(x) == 0:
        return 0.0
    n = min(len(x), max(1, int(round(window_s * sr))))
    c = np.concatenate([[0.0], np.cumsum(x ** 2)])
    return float(np.sqrt(np.max(c[n:] - c[:-n]) / n))


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


def _duck_gain(mask: np.ndarray, sr: int, duck_db: float = DUCK_DB) -> np.ndarray:
    """Smoothed gain curve: 1.0 without speech, -duck_db with speech."""
    step = sr // ENV_RATE
    n_env = len(mask) // step + 1
    padded = np.zeros(n_env * step, dtype=bool)
    padded[:len(mask)] = mask
    target = np.where(padded.reshape(n_env, step).any(axis=1), 10 ** (-duck_db / 20), 1.0)
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


def _lufs(x: np.ndarray) -> float:
    return float(pyln.Meter(SR).integrated_loudness(np.stack([x, x], axis=1)))


def _loudness_envelope(total: np.ndarray, sr: int) -> np.ndarray:
    """Gain envelope that brings ``total`` to TARGET_LUFS with peaks <= PEAK_LIMIT_DBFS.

    Make-up gain to the target, then the look-ahead limiter; limiting lowers the
    loudness a little, so re-measure and correct (two or three passes converge).
    """
    ceiling_db = PEAK_LIMIT_DBFS - LIMIT_MARGIN_DB
    g = 10 ** ((TARGET_LUFS - _lufs(total)) / 20)
    env = np.full(len(total), g)
    for _ in range(4):
        env = g * limiter_gain(total * g, sr, ceiling_db)
        err = TARGET_LUFS - _lufs(total * env)
        if abs(err) < 0.1:
            break
        g *= 10 ** (err / 20)
    return env


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
    voice_len = len(voice)
    total_s = voice_len / SR
    length = voice_len + int(TAIL_S * SR)
    voice = np.concatenate([voice, np.zeros(length - voice_len)])
    mask = np.concatenate([mask, np.zeros(length - len(mask), dtype=bool)])
    duck_mask = close_gaps(mask, SR)
    speech_rms = _rms(voice[mask])

    warnings: list[str] = []
    used: list[dict] = []

    # music: fades in, sits MUSIC_BELOW_VOICE_DB under the voice, ducks under speech,
    # and fades out so it is silent exactly when the voice ends (the mux cuts the tail)
    track, w = lib.pick_music(lib_root, sound.get("music_mood", ""), total_s + TAIL_S)
    warnings += w
    used.append(track)
    music = _loop(_load_mono(lib_root / track["path"]), length)
    base_rms = _rms(music)
    if base_rms == 0:
        raise MixCheckError(f"music track {track['id']} is silent")
    music = music * (speech_rms * 10 ** (-MUSIC_BELOW_VOICE_DB / 20) / base_rms)
    fi = min(int(FADE_IN_S * SR), voice_len)
    fo = min(int(FADE_OUT_S * SR), voice_len)
    music[:fi] *= np.linspace(0, 1, fi)
    music[voice_len - fo:voice_len] *= np.linspace(1, 0, fo)
    music[voice_len:] = 0.0
    music = music * _duck_gain(duck_mask, SR)

    # sfx: loudest 100 ms sits SFX_BELOW_VOICE_DB under the voice, ducked under speech
    sfx = np.zeros(length)
    sfx_target = speech_rms * 10 ** (-SFX_BELOW_VOICE_DB / 20)
    for ev in sound.get("sfx", []):
        item = lib.pick_sfx(lib_root, ev["type"])
        if item not in used:
            used.append(item)
        clip = _load_mono(lib_root / item["path"])
        loud = _max_window_rms(clip, SR)
        if loud > 0:
            clip = clip * (sfx_target / loud)
        s = starts[ev["scene"]] + int(round(ev["at_s"] * SR))
        e = min(length, s + len(clip))
        if s < length:
            sfx[s:e] += clip[:e - s]
    sfx = sfx * _duck_gain(duck_mask, SR, SFX_DUCK_DB)

    # loudness: one gain envelope (make-up gain x look-ahead limiter) for the whole sum,
    # applied identically to every stem, so the stems add up to the mix and check_mix
    # measures the voice/music gap exactly as it is in the final mix
    total = voice + music + sfx
    env = _loudness_envelope(total, SR)
    stems = {"voice": voice * env, "music": music * env, "sfx": sfx * env}
    mixed = total * env

    gap = voice_music_gap_db(stems["voice"], stems["music"], SR)
    lufs = _lufs(mixed)
    if gap < WARN_GAP_DB:
        warnings.append(f"music is only {gap:.1f} dB below the voice (aim for {WARN_GAP_DB:.0f} dB or more)")
    if not -15 <= lufs <= -13:
        warnings.append(f"mix loudness is {lufs:.1f} LUFS (aim for -15 to -13)")

    audio_dir = run_dir / "04-video" / "audio"
    paths = {}
    for name, x in stems.items():
        paths[name] = audio_dir / f"{name}.wav"
        _write(paths[name], x)
    mix_path = audio_dir / "mix.wav"
    _write(mix_path, np.stack([mixed, mixed], axis=1))

    lib.mark_used(lib_root, [i["id"] for i in used])
    lib.write_credits(used, run_dir / "04-video" / "credits.md")
    return MixResult(mix=mix_path, stems=paths, warnings=warnings)


def check_mix(run_dir: Path) -> dict:
    """Measure the written mix; the stems carry the mix's own gain envelope (see top)."""
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
