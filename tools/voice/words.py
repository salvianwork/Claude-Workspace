"""Word timings for each scene: map engine tokens back to the script's own words.

Algorithm (align_to_script):
  1. Script tokens = whitespace split of the narration, punctuation stripped from the ends
     (so "1,000" and "°C" survive as written; tokens that are only punctuation are dropped).
  2. Both the script tokens and the engine tokens are normalised to spoken words
     (tools.review.transcript.normalize_words: "1,000" -> "one thousand", "°C" -> "degrees celsius",
     punctuation vanishes). Each normalised word remembers the token it came from.
  3. The two word sequences are aligned monotonically (difflib.SequenceMatcher).
  4. A script token takes start = first start, end = last end of the engine tokens its words
     matched (so "1,000" spoken as several tokens spans all of them).
  4b. Each word also keeps `display`: the token exactly as written, punctuation included
     ("chamber,", "rock."), for captions; `text` (used for cue matching) is unchanged.
  5. Script tokens with no match are interpolated evenly in the gap between the nearest timed
     neighbours. Finally times are forced monotonic with start < end.
Times are seconds from the start of the scene wav.

Sources (per scene, and top-level in words.json): "kokoro" = Kokoro token timestamps,
"whisper" = faster-whisper fallback, "engine" = timestamps from any other engine (test /
extension value). Top-level is the common value, or "mixed" when scenes disagree.
"""
from __future__ import annotations

import difflib
import json
from pathlib import Path

from tools.review.transcript import normalize_words

_STRIP = " \t\n\r.,;:!?\"'()[]{}…“”‘’—–-*_"
_MIN_DUR = 0.01


def script_tokens(text: str) -> list[str]:
    toks = [t.strip(_STRIP) for t in text.split()]
    return [t for t in toks if t]


def display_tokens(text: str) -> list[str]:
    """The script tokens exactly as written (punctuation kept), one per script_tokens() entry.
    A token that is only punctuation (e.g. a dash) joins the previous token with a space."""
    out: list[str] = []
    pending = ""
    for raw in text.split():
        if raw.strip(_STRIP):
            out.append(pending + raw)
            pending = ""
        elif out:
            out[-1] += " " + raw
        else:
            pending += raw + " "
    return out


def align_to_script(script_text: str, timed: list[dict]) -> list[dict]:
    toks = script_tokens(script_text)
    shown = display_tokens(script_text)
    if not toks:
        return []
    if not timed:
        raise ValueError("no word timings for this scene")
    s_words, s_owner = [], []
    for i, t in enumerate(toks):
        for w in normalize_words(t):
            s_words.append(w)
            s_owner.append(i)
    t_words, t_owner = [], []
    for j, t in enumerate(timed):
        for w in normalize_words(str(t.get("text", ""))):
            t_words.append(w)
            t_owner.append(j)

    matched: dict[int, list[int]] = {}
    sm = difflib.SequenceMatcher(a=s_words, b=t_words, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            matched.setdefault(s_owner[blk.a + k], []).append(t_owner[blk.b + k])

    start: list[float | None] = [None] * len(toks)
    end: list[float | None] = [None] * len(toks)
    for i, js in matched.items():
        start[i] = min(timed[j]["start"] for j in js)
        end[i] = max(timed[j]["end"] for j in js)

    # interpolate runs of unmatched tokens between timed neighbours
    total_end = max((t["end"] for t in timed), default=0.0)
    i = 0
    while i < len(toks):
        if start[i] is not None:
            i += 1
            continue
        k = i
        while k < len(toks) and start[k] is None:
            k += 1
        lo = end[i - 1] if i > 0 else 0.0
        hi = start[k] if k < len(toks) else total_end
        hi = max(hi, lo)
        n = k - i
        for m in range(n):
            start[i + m] = lo + (hi - lo) * m / n
            end[i + m] = lo + (hi - lo) * (m + 1) / n
        i = k

    out, prev_end = [], 0.0
    for i, tok in enumerate(toks):
        s = max(float(start[i]), prev_end)
        e = max(float(end[i]), s + _MIN_DUR)
        out.append({"i": i, "text": tok, "display": shown[i], "start": round(s, 3), "end": round(e, 3)})
        prev_end = e
    return out


def write_words(run_dir: Path, scenes: dict[int, list[dict]], source: str | dict[int, str],
                keep_ids: set[int] | None = None) -> Path:
    """Write run_dir/words.json: replace the given scenes, keep other existing ones.

    ``source`` is one label for all given scenes or {scene id: label}. ``keep_ids`` limits the
    file to those scene ids (drops stale ones). Top-level source is the shared label or "mixed".
    """
    run_dir = Path(run_dir)
    path = run_dir / "words.json"
    merged: dict[int, tuple[str, list[dict]]] = {}
    if path.exists():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
            for s in old.get("scenes", []):
                merged[int(s["id"])] = (s.get("source", old.get("source", "kokoro")), s["words"])
        except (ValueError, KeyError):
            pass
    for i, words in scenes.items():
        merged[i] = (source if isinstance(source, str) else source[i], words)
    if keep_ids is not None:
        merged = {i: v for i, v in merged.items() if i in keep_ids}
    labels = {v[0] for v in merged.values()}
    top = labels.pop() if len(labels) == 1 else ("mixed" if labels else "kokoro")
    data = {"source": top,
            "scenes": [{"id": i, "source": merged[i][0], "words": merged[i][1]}
                       for i in sorted(merged)]}
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def whisper_words(wav: Path) -> list[dict]:
    """Fallback for engines without timestamps: faster-whisper word timestamps."""
    from tools.review.transcript import _whisper  # lazy faster-whisper load

    model = _whisper("small.en")
    segments, _ = model.transcribe(str(wav), word_timestamps=True, language="en")
    return [{"text": w.word.strip(), "start": float(w.start), "end": float(w.end)}
            for seg in segments for w in (seg.words or [])]
