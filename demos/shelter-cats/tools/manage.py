#!/usr/bin/env python3
"""shelter-cats CLI — fetch (safely) into the SQLite SSOT, plus stats/prune.

Usage (from demos/shelter-cats/):
  python tools/manage.py init
  python tools/manage.py sources
  python tools/manage.py fetch --source socrata
  python tools/manage.py fetch --source socrata --socrata-sources montgomery_md
  python tools/manage.py fetch --source rescuegroups --location 20855 --radius 100
  python tools/manage.py stats
  python tools/manage.py prune --removed-older-than 365

All network access is throttled + cached + identifies itself (see tools/crawl/http.py).
Then run `python tools/build.py` to emit the static JSON + cache-bust, and
`python tools/thumbs.py` to cache photo thumbnails.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # demos/shelter-cats/
sys.path.insert(0, str(ROOT))

from tools import db, enums                              # noqa: E402
from tools.adapters import iter_source, ATTRIBUTIONS, available_sources  # noqa: E402
from tools.crawl import PoliteSession                    # noqa: E402

DB_PATH = ROOT / "data" / "shelters.db"
CACHE_DIR = ROOT / ".httpcache"


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cmd_init(args) -> int:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = db.connect(DB_PATH)
    db.init_schema(conn)
    conn.commit()
    print(f"initialized {DB_PATH}")
    return 0


def cmd_sources(args) -> int:
    from tools.adapters import socrata, generic, rescuegroups
    print("Registered sources:")
    print(f"  socrata        live datasets: {', '.join(socrata.list_sources())}")
    print(f"                 (all configured: {', '.join(socrata.SOURCES.keys())})")
    glive = generic.list_sources()
    print(f"  generic        live datasets: {', '.join(glive) if glive else '(none yet — intl CKAN/ODS/ArcGIS feeds)'}")
    print(f"  rescuegroups   key set: {rescuegroups.have_key()}  "
          f"(export RESCUEGROUPS_API_KEY to enable)")
    return 0


def cmd_fetch(args) -> int:
    if not DB_PATH.exists():
        print("DB missing — run `python tools/manage.py init` first")
        return 1
    conn = db.connect(DB_PATH)
    db.init_schema(conn)
    session = PoliteSession(CACHE_DIR, min_interval=args.min_interval)
    run_ts = _now()
    opts = {
        "max": args.max,
        "socrata_sources": args.socrata_sources.split(",") if args.socrata_sources else None,
        "location": args.location, "radius": args.radius,
    }
    print(f"fetch source={args.source} at {run_ts}")
    refreshed_shelters: list[str] = []
    new_n = upd_n = 0
    for shelter, cats in iter_source(args.source, session, **opts):
        db.upsert_shelter(conn, shelter.to_row(), run_ts)
        refreshed_shelters.append(shelter.id)
        for cat in cats:
            r = db.upsert_cat(conn, cat.to_row(), run_ts)
            if r == "new":
                new_n += 1
            else:
                upd_n += 1
        conn.commit()
    # delist sweep: cats in refreshed shelters not seen this run -> removed (kept)
    removed = db.delist(conn, _adapter_source_tag(args.source), refreshed_shelters, run_ts)
    attr = ATTRIBUTIONS.get(args.source, {})
    db.set_meta(conn, f"last_fetch_{args.source}", run_ts)
    db.set_meta(conn, f"attribution_{args.source}", attr.get("name", ""))
    conn.commit()
    print(f"  done: +{new_n} new, ~{upd_n} updated, {removed} delisted (kept). "
          f"shelters refreshed: {len(refreshed_shelters)}")
    return 0


def _adapter_source_tag(source: str) -> str:
    """The `source` value stored on cat rows (socrata cats carry source='socrata')."""
    return source


def cmd_stats(args) -> int:
    conn = db.connect(DB_PATH)
    db.init_schema(conn)
    total = conn.execute("SELECT COUNT(*) n FROM cats").fetchone()["n"]
    shelters = conn.execute("SELECT COUNT(*) n FROM shelters").fetchone()["n"]
    print(f"cats: {total}   shelters: {shelters}")
    print("by status:")
    for r in conn.execute("SELECT status, COUNT(*) n FROM cats GROUP BY status ORDER BY n DESC"):
        print(f"  {r['status']:<12} {r['n']}")
    print("by region:")
    for r in conn.execute(
        "SELECT s.region, COUNT(*) n FROM cats c JOIN shelters s ON c.shelter_id=s.id "
        "GROUP BY s.region ORDER BY n DESC"):
        print(f"  {r['region']:<14} {r['n']}")
    print("by coat / pattern:")
    for dim in ("coat_length", "pattern"):
        rows = conn.execute(f"SELECT {dim} v, COUNT(*) n FROM cats GROUP BY {dim} ORDER BY n DESC").fetchall()
        print(f"  {dim}: " + ", ".join(f"{r['v'] or '?'}={r['n']}" for r in rows))
    withphoto = conn.execute("SELECT COUNT(*) n FROM cats WHERE photo_url<>''").fetchone()["n"]
    withthumb = conn.execute("SELECT COUNT(*) n FROM cats WHERE thumb_path IS NOT NULL").fetchone()["n"]
    print(f"photos: {withphoto} have source url, {withthumb} have cached thumbnail")
    return 0


def cmd_prune(args) -> int:
    conn = db.connect(DB_PATH)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.removed_older_than)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = conn.execute(
        "SELECT id, thumb_path FROM cats WHERE status IN ('removed','adopted') AND last_status_change < ?",
        (cutoff,)).fetchall()
    for r in rows:
        if r["thumb_path"]:
            p = ROOT / r["thumb_path"]
            if p.exists():
                p.unlink()
    conn.execute("DELETE FROM cats WHERE status IN ('removed','adopted') AND last_status_change < ?", (cutoff,))
    conn.commit()
    print(f"pruned {len(rows)} stale removed/adopted cat(s) older than {args.removed_older_than}d")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="shelter-cats data pipeline CLI")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init")
    sub.add_parser("sources")
    sub.add_parser("stats")
    f = sub.add_parser("fetch")
    f.add_argument("--source", required=True, choices=available_sources())
    f.add_argument("--socrata-sources", default=None, help="csv of socrata source keys")
    f.add_argument("--location", default=None, help="postcode (rescuegroups)")
    f.add_argument("--radius", type=int, default=100)
    f.add_argument("--max", type=int, default=1000)
    f.add_argument("--min-interval", type=float, default=2.0, help="seconds between requests to a host")
    p = sub.add_parser("prune")
    p.add_argument("--removed-older-than", type=int, default=365)
    args = ap.parse_args()
    return {
        "init": cmd_init, "sources": cmd_sources, "fetch": cmd_fetch,
        "stats": cmd_stats, "prune": cmd_prune,
    }[args.cmd](args)


if __name__ == "__main__":
    raise SystemExit(main())
