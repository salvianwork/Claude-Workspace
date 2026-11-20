import subprocess
import sys
import threading
import time
from pathlib import Path

from tools.dashboard import answers
from tools.dashboard.wait import wait_for_answer


def test_waiter_returns_answer(tmp_path):
    r = answers.write_request(tmp_path, "gate-1", "T", "B", ["approve", "changes"])
    threading.Timer(0.3, answers.write_answer, (tmp_path, r["id"], "approve")).start()
    got = wait_for_answer(tmp_path, r["id"], timeout_s=5, poll_s=0.05)
    assert got["decision"] == "approve"


def test_waiter_times_out(tmp_path):
    t = time.time()
    assert wait_for_answer(tmp_path, "gate-1-1", timeout_s=0.2, poll_s=0.05) is None
    assert time.time() - t < 2


def test_waiter_tolerates_half_written(tmp_path):
    (tmp_path / "board").mkdir()
    f = tmp_path / "board" / "answer-gate-1-1.json"
    f.write_text('{"id": "gat', encoding="utf-8")
    threading.Timer(0.2, f.write_text, ('{"id":"gate-1-1","decision":"approve"}',),
                    {"encoding": "utf-8"}).start()
    assert wait_for_answer(tmp_path, "gate-1-1", timeout_s=5, poll_s=0.05)["decision"] == "approve"


def test_wait_cli_timeout(tmp_path):
    p = subprocess.run([sys.executable, "-m", "tools.dashboard.wait", str(tmp_path),
                        "--id", "gate-1-1", "--timeout", "0.2"],
                       capture_output=True, text=True, cwd=Path(__file__).resolve().parents[2])
    assert p.returncode == 3 and p.stdout.strip() == "timeout"
