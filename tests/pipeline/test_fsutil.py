import os

import pytest

from tools.pipeline import fsutil
from tools.pipeline.fsutil import replace_retry


def _flaky_replace(monkeypatch, fails):
    calls = []
    real = os.replace

    def fake(src, dst):
        calls.append((src, dst))
        if fails is None or len(calls) <= fails:
            raise PermissionError(13, "file in use")
        real(src, dst)

    monkeypatch.setattr(fsutil.os, "replace", fake)
    monkeypatch.setattr(fsutil.time, "sleep", lambda s: None)
    return calls


def test_replace_retry_succeeds_after_two_failures(tmp_path, monkeypatch):
    tmp, dst = tmp_path / "a.tmp", tmp_path / "a.json"
    tmp.write_text("new", encoding="utf-8")
    dst.write_text("old", encoding="utf-8")
    calls = _flaky_replace(monkeypatch, fails=2)
    replace_retry(tmp, dst)
    assert len(calls) == 3
    assert dst.read_text(encoding="utf-8") == "new" and not tmp.exists()


def test_replace_retry_gives_up_after_tries(tmp_path, monkeypatch):
    tmp, dst = tmp_path / "a.tmp", tmp_path / "a.json"
    tmp.write_text("new", encoding="utf-8")
    calls = _flaky_replace(monkeypatch, fails=None)
    with pytest.raises(PermissionError):
        replace_retry(tmp, dst, tries=5, delay=0)
    assert len(calls) == 5 and tmp.exists() and not dst.exists()


def test_replace_retry_other_errors_not_retried(tmp_path):
    with pytest.raises(FileNotFoundError):
        replace_retry(tmp_path / "missing.tmp", tmp_path / "x.json")


def test_status_and_answers_use_replace_retry(tmp_path, monkeypatch):
    from tools.dashboard import answers
    from tools.pipeline import status
    calls = _flaky_replace(monkeypatch, fails=1)
    run = status.init_run("Retry topic", tmp_path)  # writes status.json
    assert len(calls) == 2 and (run / "status.json").is_file()
    calls = _flaky_replace(monkeypatch, fails=1)
    answers.write_request(run, "gate-1", "T", "B", ["approve"])
    assert len(calls) == 2 and (run / "board" / "request.json").is_file()
