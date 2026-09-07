"""Local-only browser fixture server with room for parallel atlas shard requests."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial


class FixtureServer(ThreadingHTTPServer):
    # Several pages each load dozens of files in parallel. The default backlog
    # of five can reset connections before the handler sees the requests.
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    with FixtureServer(("127.0.0.1", 8766), handler) as server:
        server.serve_forever()
