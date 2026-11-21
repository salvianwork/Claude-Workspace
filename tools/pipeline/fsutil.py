"""Small filesystem helpers shared by the pipeline and the studio dashboard."""
from __future__ import annotations

import os
import time
from pathlib import Path


def replace_retry(tmp: Path, dst: Path, tries: int = 20, delay: float = 0.05) -> None:
    """os.replace(tmp, dst), retrying on PermissionError.

    On Windows, replacing a file fails with PermissionError while another
    process (e.g. the studio server polling status.json) has it open for
    reading. The reader closes it within milliseconds, so retry briefly; the
    last failure is re-raised after `tries` attempts.
    """
    for attempt in range(tries):
        try:
            os.replace(tmp, dst)
            return
        except PermissionError:
            if attempt == tries - 1:
                raise
            time.sleep(delay)
