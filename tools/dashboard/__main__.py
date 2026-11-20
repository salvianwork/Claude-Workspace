"""python -m tools.dashboard [--port 8765] [--no-browser] [--root DIR]"""
from __future__ import annotations

import argparse
import sys
import webbrowser
from pathlib import Path

from tools.dashboard.server import make_server

PORT_TRIES = 11  # the requested port plus the next 10


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m tools.dashboard")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-browser", action="store_true")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    args = ap.parse_args(argv)
    server = None
    for port in range(args.port, args.port + PORT_TRIES):
        try:
            server = make_server(args.root, port)
            break
        except OSError:
            continue
    if server is None:
        print(f"No free port in {args.port}-{args.port + PORT_TRIES - 1}.", file=sys.stderr)
        return 1
    print(f"Studio running at {server.url} (Ctrl+C to stop)", flush=True)
    if not args.no_browser:
        webbrowser.open(server.url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
