"""Compare what was spoken (via faster-whisper) with what the script says."""
from __future__ import annotations

import difflib
import functools
import json
import re
import sys
from pathlib import Path

from num2words import num2words

_NUM = re.compile(r"\d[\d,]*(?:\.\d+)?|\.\d+")


def _num_to_words(match: re.Match) -> str:
    raw = match.group(0).replace(",", "")
    try:
        value = float(raw) if "." in raw else int(raw)
    except ValueError:
        return raw
    return " " + num2words(value) + " "


def normalize_words(text: str) -> list[str]:
    text = text.lower()
    text = text.replace("°c", " degrees celsius ").replace("%", " percent ")
    text = _NUM.sub(_num_to_words, text)
    text = text.replace("-", " ")
    text = re.sub(r"[^a-z0-9' ]+", " ", text.replace("’", "'"))
    return [w.strip("'") for w in text.split() if w.strip("'")]


def _compare_words(exp: list[str], heard: list[str]) -> list[str]:
    problems: list[str] = []
    sm = difflib.SequenceMatcher(a=exp, b=heard, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        e, h = " ".join(exp[i1:i2]), " ".join(heard[j1:j2])
        if tag == "delete":
            problems.append(f'missing: "{e}"')
        elif tag == "insert":
            problems.append(f'extra: "{h}"')
        elif tag == "replace":
            problems.append(f'wrong: "{e}" heard as "{h}"')
    return problems


def compare(expected: str, heard: str) -> list[str]:
    return _compare_words(normalize_words(expected), normalize_words(heard))


VOICE_CACHE = Path("review") / "voice-transcripts.json"


@functools.lru_cache(maxsize=None)
def _whisper(model: str):
    """Load each Whisper model once per process (loading takes many seconds)."""
    from faster_whisper import WhisperModel  # lazy: optional extra

    return WhisperModel(model, device="cpu", compute_type="int8")


def transcribe(path: Path, model: str = "small.en") -> str:
    segments, _ = _whisper(model).transcribe(str(path), language="en")
    return " ".join(s.text.strip() for s in segments)


def _stamp(path: Path) -> dict:
    st = path.stat()
    return {"size": st.st_size, "mtime_ns": st.st_mtime_ns}


def _write_voice_cache(run_dir: Path, texts: dict[str, str]) -> None:
    entries = [{"file": f, **_stamp(run_dir / "02-voice" / f), "text": t} for f, t in texts.items()]
    path = run_dir / VOICE_CACHE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"scenes": entries}, indent=2), encoding="utf-8")


def _cached_voice_text(run_dir: Path, file: str) -> str:
    """Voice-only transcript of one scene, reused from the voice check if the file is unchanged."""
    wav = run_dir / "02-voice" / file
    try:
        cache = json.loads((run_dir / VOICE_CACHE).read_text(encoding="utf-8"))
        for e in cache.get("scenes", []):
            if e["file"] == file and {"size": e["size"], "mtime_ns": e["mtime_ns"]} == _stamp(wav):
                return e["text"]
    except (OSError, ValueError, KeyError, TypeError):
        pass
    return transcribe(wav)


def _voice(run_dir: Path) -> dict:
    from tools.pipeline.script import parse_script

    script = parse_script(run_dir / "01-script" / "script.md")
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    files = {s["id"]: s["file"] for s in manifest["scenes"]}
    scenes, ok, texts = [], True, {}
    for sc in script.scenes:
        wav = run_dir / "02-voice" / files[sc.id]
        texts[files[sc.id]] = heard = transcribe(wav)
        problems = compare(sc.narration, heard)
        ok = ok and not problems
        scenes.append({"id": sc.id, "problems": problems})
    _write_voice_cache(run_dir, texts)
    return {"scenes": scenes, "ok": ok}


def _final(run_dir: Path) -> dict:
    from tools.pipeline.script import parse_script

    script = parse_script(run_dir / "01-script" / "script.md")
    manifest = json.loads((run_dir / "02-voice" / "manifest.json").read_text(encoding="utf-8"))
    video = run_dir / "04-video" / "out" / "video.mp4"
    heard = transcribe(video)
    problems = compare(" ".join(s.narration for s in script.scenes), heard)
    voice_text = " ".join(_cached_voice_text(run_dir, s["file"]) for s in manifest["scenes"])
    missing = [p for p in compare(voice_text, heard) if p.startswith("missing:")]
    return {"problems": problems, "missing_vs_voice": missing,
            "ok": not problems and not missing}


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 2 or args[0] not in ("voice", "final"):
        print("usage: python -m tools.review.transcript voice|final <run_dir>", file=sys.stderr)
        return 2
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    run_dir = Path(args[1])
    result = _voice(run_dir) if args[0] == "voice" else _final(run_dir)
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
