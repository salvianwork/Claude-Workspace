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


def get_engine(name: str, language: str) -> TTSEngine:
    if name == "kokoro" and language == "en":
        return KokoroEngine(lang_code="a")
    raise ValueError(f"No voice engine for language {language!r} (engine {name!r})")
