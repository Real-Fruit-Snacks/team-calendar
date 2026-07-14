#!/usr/bin/env python3
"""Zero-dependency static server for Team Calendar.

Uses only the Python 3 standard library — no pip installs, no internet, no
external files. Serves this folder over HTTP with the correct MIME types so the
ES modules load (some platforms otherwise mis-serve .js and break the app).

Usage:
    python serve.py [port]      # default port 8080

Then open http://localhost:8080 in a browser. Ctrl+C to stop.
"""
import contextlib
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        "": "application/octet-stream",
    }


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    with ThreadingHTTPServer(("0.0.0.0", port), Handler) as httpd:
        print(f"Serving Team Calendar on http://localhost:{port}  (Ctrl+C to stop)")
        with contextlib.suppress(KeyboardInterrupt):
            httpd.serve_forever()


if __name__ == "__main__":
    main()
