"""Polite HTTP layer — safety-first, ban-resistant fetching for the build-time pipeline.

Design principles (the whole point of this module):

  1. Honest identity   — a descriptive User-Agent with a contact URL; we never
                         masquerade as a browser to evade detection.
  2. Per-host throttle — a minimum interval (+ random jitter) between requests to
                         the SAME host, so we never hammer one server.
  3. Backoff           — exponential backoff that honours `Retry-After` on 429/503.
  4. On-disk cache     — every response is cached; re-runs are nearly free and put
                         ~zero extra load on the source. Conditional GET (ETag /
                         Last-Modified) revalidates cheaply when the TTL expires.
  5. robots.txt        — enforced for HTML-crawl adapters (`respect_robots=True`).
                         Documented JSON data APIs (Socrata SODA, RescueGroups) are
                         *called*, not crawled: we still throttle + cache + identify,
                         but do not treat the API path as a crawl target. Each source
                         opts into robots enforcement explicitly.

Stdlib only (urllib) — no third-party network dependency, so the pipeline stays
portable and auditable.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from pathlib import Path

DEFAULT_UA = "qrost-shelter-cats-demo/0.1 (+https://qrost.github.io; non-commercial adoption demo)"


class PoliteSession:
    """A throttled, cached, robots-aware HTTP client. One instance per pipeline run."""

    def __init__(
        self,
        cache_dir: Path,
        user_agent: str = DEFAULT_UA,
        min_interval: float = 2.0,
        jitter: float = 1.0,
        cache_ttl: float = 6 * 3600,
        max_retries: int = 4,
        timeout: float = 30.0,
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ua = user_agent
        self.min_interval = min_interval
        self.jitter = jitter
        self.cache_ttl = cache_ttl
        self.max_retries = max_retries
        self.timeout = timeout
        self._last_hit: dict[str, float] = {}      # host -> monotonic ts
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}

    # ----- throttle ---------------------------------------------------------
    def _throttle(self, host: str) -> None:
        last = self._last_hit.get(host)
        if last is not None:
            wait = self.min_interval + random.uniform(0, self.jitter) - (time.monotonic() - last)
            if wait > 0:
                time.sleep(wait)
        self._last_hit[host] = time.monotonic()

    # ----- robots -----------------------------------------------------------
    def _robots_for(self, scheme: str, host: str):
        if host in self._robots:
            return self._robots[host]
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{scheme}://{host}/robots.txt")
        try:
            rp.read()
        except Exception:
            rp = None  # no robots.txt reachable -> default allow, but stay polite
        self._robots[host] = rp
        return rp

    def allowed(self, url: str) -> bool:
        p = urllib.parse.urlparse(url)
        rp = self._robots_for(p.scheme, p.netloc)
        if rp is None:
            return True
        try:
            return rp.can_fetch(self.ua, url)
        except Exception:
            return True

    # ----- cache ------------------------------------------------------------
    def _cache_path(self, url: str) -> Path:
        h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:20]
        return self.cache_dir / f"{h}.json"

    def _read_cache(self, url: str):
        cp = self._cache_path(url)
        if not cp.exists():
            return None
        try:
            return json.loads(cp.read_text(encoding="utf-8"))
        except Exception:
            return None

    def _write_cache(self, url: str, status: int, headers: dict, body_b64: str | None, text: str | None) -> None:
        cp = self._cache_path(url)
        cp.write_text(json.dumps({
            "url": url, "status": status, "fetched": time.time(),
            "etag": headers.get("ETag"), "last_modified": headers.get("Last-Modified"),
            "text": text, "body_b64": body_b64,
        }), encoding="utf-8")

    # ----- core GET ---------------------------------------------------------
    def _do_request(self, url: str, extra_headers: dict | None, binary: bool):
        host = urllib.parse.urlparse(url).netloc
        self._throttle(host)
        headers = {"User-Agent": self.ua, "Accept-Encoding": "gzip"}
        if extra_headers:
            headers.update(extra_headers)
        req = urllib.request.Request(url, headers=headers)
        attempt = 0
        while True:
            attempt += 1
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    raw = r.read()
                    if r.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                    hd = {k: v for k, v in r.headers.items()}
                    return r.status, hd, raw
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503, 504) and attempt <= self.max_retries:
                    ra = e.headers.get("Retry-After") if e.headers else None
                    delay = float(ra) if (ra and str(ra).isdigit()) else min(60, 2 ** attempt)
                    time.sleep(delay + random.uniform(0, self.jitter))
                    continue
                if e.code == 304:  # not modified — caller falls back to cache
                    return 304, dict(e.headers or {}), b""
                raise
            except (urllib.error.URLError, TimeoutError):
                if attempt <= self.max_retries:
                    time.sleep(min(60, 2 ** attempt) + random.uniform(0, self.jitter))
                    continue
                raise

    def get_text(self, url: str, respect_robots: bool = False, force: bool = False,
                 headers: dict | None = None) -> str | None:
        """Return decoded text, using cache when fresh; revalidate via ETag when stale."""
        if respect_robots and not self.allowed(url):
            print(f"    robots.txt disallows {url} — skipped")
            return None
        cached = None if force else self._read_cache(url)
        if cached and cached.get("text") is not None and (time.time() - cached.get("fetched", 0)) < self.cache_ttl:
            return cached["text"]
        cond = dict(headers or {})
        if cached:
            if cached.get("etag"):
                cond["If-None-Match"] = cached["etag"]
            if cached.get("last_modified"):
                cond["If-Modified-Since"] = cached["last_modified"]
        status, hd, raw = self._do_request(url, cond, binary=False)
        if status == 304 and cached:
            self._write_cache(url, 200, hd, None, cached.get("text"))
            return cached.get("text")
        text = raw.decode("utf-8", errors="replace")
        self._write_cache(url, status, hd, None, text)
        return text

    def get_json(self, url: str, respect_robots: bool = False, force: bool = False,
                 headers: dict | None = None):
        t = self.get_text(url, respect_robots=respect_robots, force=force, headers=headers)
        return None if t is None else json.loads(t)

    def get_bytes(self, url: str, respect_robots: bool = False) -> bytes | None:
        """Fetch binary (images). Not body-cached (cache holds JSON/text only)."""
        if respect_robots and not self.allowed(url):
            return None
        status, hd, raw = self._do_request(url, None, binary=True)
        return raw if status == 200 else None
