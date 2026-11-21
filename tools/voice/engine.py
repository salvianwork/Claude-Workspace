"""Text-to-speech engines. get_engine is the single swap point for new languages."""
from __future__ import annotations

from typing import Protocol

import numpy as np


class TTSEngine(Protocol):
    name: str
    sample_rate: int

    def synth(self, text: str, voice: str, speed: float) -> np.ndarray:
        """Return mono float32 samples at ``sample_rate``."""
        ...

    def synth_words(self, text: str, voice: str, speed: float) -> tuple[np.ndarray, list[dict]]:
        """Samples plus engine word timings [{text, start, end}] in seconds (empty if unknown)."""
        ...


class KokoroEngine:
    name = "kokoro"
    sample_rate = 24000

    def __init__(self, lang_code: str = "a") -> None:
        from kokoro import KPipeline  # lazy: kokoro is an optional extra

        self._pipeline = KPipeline(lang_code=lang_code)

    def synth(self, text: str, voice: str, speed: float) -> np.ndarray:
        chunks = []
        for result in self._pipeline(text, voice=voice, speed=speed):
            audio = result[-1] if isinstance(result, tuple) else result.audio
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            chunks.append(np.asarray(audio, dtype=np.float32).reshape(-1))
        if not chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(chunks)

    def synth_words(self, text, voice, speed):
        chunks, words, offset = [], [], 0.0
        for result in self._pipeline(text, voice=voice, speed=speed):
            audio = result[-1] if isinstance(result, tuple) else result.audio
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            for t in (getattr(result, "tokens", None) or []):
                if t.start_ts is not None and t.end_ts is not None:
                    words.append({"text": t.text, "start": offset + float(t.start_ts),
                                  "end": offset + float(t.end_ts)})
            chunks.append(audio)
            offset += len(audio) / self.sample_rate
        audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
        return audio, words


def kokoro_lang_code(voice: str | None) -> str:
    """Kokoro pipeline accent for a voice: British voices (bf_*, bm_*) need "b", else "a"."""
    return "b" if voice and voice.lower().startswith("b") else "a"


def get_engine(name: str, language: str, voice: str | None = None) -> TTSEngine:
    if name == "kokoro" and language == "en":
        return KokoroEngine(lang_code=kokoro_lang_code(voice))
    raise ValueError(f"No voice engine for language {language!r} (engine {name!r})")
