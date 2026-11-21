"""A small run folder for the HyperFrames builder: 3 scenes (volcano hero from the prop library,
steps kit, recap kit) with FakeEngine-style voice wavs, words.json, manifest, shots.json,
style.json and sound.json."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import soundfile as sf

from tools.voice.words import display_tokens, script_tokens

SR = 24000

NARRATION = {
    1: ("Deep under a volcano sits a magma chamber, a pool of molten rock. As pressure builds, "
        "the magma pushes upward through a narrow vent. When it bursts out at the top, we call it lava."),
    2: "First pressure builds, then the magma rises, and finally it bursts out.",
    3: "Remember: magma waits in a chamber, pressure pushes it up, and lava builds the cone.",
}
SECONDS = {1: 9.0, 2: 4.5, 3: 4.6}


def words_for(text: str, seconds: float) -> list[dict]:
    """Even word timings from 0.3 s to 0.5 s before the end (FakeEngine-style)."""
    toks, shown = script_tokens(text), display_tokens(text)
    step = (seconds - 0.8) / len(toks)
    out = []
    for i, (t, d) in enumerate(zip(toks, shown)):
        s = round(0.3 + i * step, 3)
        out.append({"i": i, "text": t, "display": d, "start": s, "end": round(s + step * 0.8, 3)})
    return out


def _voice(path: Path, words: list[dict], seconds: float) -> None:
    t = np.arange(int(seconds * SR)) / SR
    x = np.zeros_like(t)
    for w in words:
        m = (t >= w["start"]) & (t < w["end"])
        x[m] = 0.3 * np.sin(2 * np.pi * 220 * t[m])
    sf.write(str(path), x.astype(np.float32), SR)


def shots() -> dict:
    return {"scenes": [
        {"id": 1, "kind": "hero", "prop": "volcano", "new_prop": False,
         "brief": "Cut-away volcano: chamber under the cone, vent to crater.",
         "facts": ["magma chamber lies beneath the volcano"],
         "params": {"sky": "dusk"},
         "camera": [{"at": {"word": 0}, "frame": "wide"},
                    {"at": {"word": 7}, "frame": {"focus": "chamber", "zoom": 1.4}}],
         "cues": [{"at": {"word": 7}, "show": "label", "target": "chamber", "text": "Magma chamber", "until": {"word": 16}},
                  {"at": {"word": 17}, "show": "phase", "target": "rise"},
                  {"at": {"word": 22}, "show": "label", "target": "vent", "text": "Vent"},
                  {"at": {"word": 26}, "show": "phase", "target": "burst"},
                  {"at": {"word": 34}, "show": "label", "target": "lava", "text": "Lava"}],
         "presenter": {"pose": "point-left", "expression": "curious", "position": "right", "size": "small"},
         "transition": "fade"},
        {"id": 2, "kind": "kit", "scene": "steps",
         "props": {"title": "How an eruption builds", "steps": ["Pressure", "Rise", "Burst"]},
         "camera": [], "cues": [{"at": {"word": 1}, "show": "step", "index": 0},
                                {"at": {"word": 6}, "show": "step", "index": 1},
                                {"at": {"word": 10}, "show": "step", "index": 2}],
         "presenter": {"pose": "talk", "expression": "happy", "position": "left", "size": "small"},
         "transition": "slide"},
        {"id": 3, "kind": "kit", "scene": "recap",
         "props": {"title": "Remember", "points": ["Magma waits in a chamber", "Pressure pushes it up", "Lava builds the cone"]},
         "camera": [], "cues": [{"at": {"word": 1}, "show": "point", "index": 0},
                                {"at": {"word": 6}, "show": "point", "index": 1},
                                {"at": {"word": 11}, "show": "point", "index": 2}],
         "presenter": {"pose": "celebrate", "expression": "happy", "position": "left", "size": "large"},
         "transition": "blur"},
    ]}


def make_run(root: Path) -> Path:
    run = Path(root) / "my run"  # space on purpose (Windows paths)
    for d in ("02-voice", "03-design", "04-video"):
        (run / d).mkdir(parents=True)
    scenes, words = [], []
    for sid, text in NARRATION.items():
        ws = words_for(text, SECONDS[sid])
        name = f"scene-{sid:02d}.wav"
        _voice(run / "02-voice" / name, ws, SECONDS[sid])
        scenes.append({"id": sid, "file": name, "duration_s": SECONDS[sid]})
        words.append({"id": sid, "source": "kokoro", "words": ws})
    manifest = {"language": "en", "engine": "kokoro", "voice": "v", "speed": 1.0, "sample_rate": SR,
                "scenes": scenes, "total_s": round(sum(SECONDS.values()), 3)}
    (run / "02-voice" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    (run / "02-voice" / "words.json").write_text(json.dumps({"source": "kokoro", "scenes": words}), encoding="utf-8")
    (run / "03-design" / "shots.json").write_text(json.dumps(shots(), indent=1), encoding="utf-8")
    (run / "03-design" / "style.json").write_text(json.dumps({
        "colors": {"background": "#0F172A", "surface": "#1E293B", "primary": "#38BDF8", "accent": "#F59E0B", "text": "#F1F5F9"},
        "fonts": {"heading": "Poppins", "body": "Inter"},
        "sizes": {"title": 104, "heading": 64, "body": 40, "caption": 40},
        "presenterOutfit": "labcoat"}), encoding="utf-8")
    (run / "03-design" / "sound.json").write_text(json.dumps({"music_mood": "curious", "sfx": []}), encoding="utf-8")
    return run


def load(run: Path) -> tuple[dict, dict, dict]:
    """(shots, words, manifest) of a run."""
    r = lambda p: json.loads((run / p).read_text(encoding="utf-8"))
    return r("03-design/shots.json"), r("02-voice/words.json"), r("02-voice/manifest.json")
