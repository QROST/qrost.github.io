#!/usr/bin/env python3
"""Taiwan batch climate fallback (2026-06-15).

Try Open-Meteo ERA5 archive once per listing; on 429/any error fall back to
climate-api.open-meteo.com (separate quota). Writes monthly `climate` + light
`daily_climate` JSON. Sets climate_src note on listings via daily JSON key.
Idempotent: only fills missing monthly/daily for geocoded rows.
"""
from __future__ import annotations

import json
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import ssl
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enrich  # noqa: E402

DB = ROOT / "data" / "housing.db"
CACHE = ROOT / "data" / "research" / "tw-climate-cache-2026-06.json"
_SSL = ssl.create_default_context()
UA = "qrost-china-housing/1.0 (+https://qrost.github.io)"
ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
CLIMATE = "https://climate-api.open-meteo.com/v1/climate"


def _fetch(url_base, lat, lng, daily, start, end):
    url = url_base + "?" + urllib.parse.urlencode({
        "latitude": lat, "longitude": lng,
        "start_date": start, "end_date": end,
        "daily": daily, "timezone": "auto",
        "models": "EC_Earth3P_HR",
    })
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60, context=_SSL) as r:
        return json.loads(r.read())["daily"]


def monthly_from(d):
    times = d["time"]
    tm, tx, tn, pr = (d["temperature_2m_mean"], d["temperature_2m_max"],
                      d["temperature_2m_min"], d["precipitation_sum"])
    acc = {}
    for i, t in enumerate(times):
        m = int(t[5:7]); y = int(t[:4])
        a = acc.setdefault(m, {"tmean": [], "tmax": [], "tmin": [], "psum": {}})
        if tm[i] is not None:
            a["tmean"].append(tm[i])
        if tx[i] is not None:
            a["tmax"].append(tx[i])
        if tn[i] is not None:
            a["tmin"].append(tn[i])
        if pr[i] is not None:
            a["psum"][y] = a["psum"].get(y, 0.0) + pr[i]
    out = []
    for m in range(1, 13):
        a = acc.get(m)
        if not a or not a["tmean"]:
            out.append((m, None, None, None, None))
            continue
        mean = sum(a["tmean"]) / len(a["tmean"])
        hi = sum(a["tmax"]) / len(a["tmax"]) if a["tmax"] else None
        lo = sum(a["tmin"]) / len(a["tmin"]) if a["tmin"] else None
        ps = (sum(a["psum"].values()) / len(a["psum"])) if a["psum"] else None
        out.append((m, round(mean, 1), round(hi, 1) if hi else None,
                    round(lo, 1) if lo else None, round(ps, 1) if ps else None))
    return out


def daily_from(d):
    times = d["time"]
    series = {"tmean": d["temperature_2m_mean"], "tmax": d["temperature_2m_max"],
              "tmin": d["temperature_2m_min"]}
    acc = {k: [[] for _ in range(365)] for k in series}
    for i, t in enumerate(times):
        if t[5:10] == "02-29":
            continue
        doy = enrich._doy_365(int(t[5:7]), int(t[8:10])) - 1
        for k, vals in series.items():
            if vals[i] is not None:
                acc[k][doy].append(vals[i])
    norm = {k: [(sum(v) / len(v) if v else None) for v in acc[k]] for k in acc}
    sm = {k: enrich._smooth_circular(norm[k], 15) for k in norm}
    extreme = [((tm is not None and tm < -5) or (tx is not None and tx >= enrich.EXTREME_HEAT_TMAX_C))
               for tm, tx in zip(sm["tmean"], sm["tmax"])]
    comfort = [(tn is not None and tx is not None and tn >= 8 and tx <= 26 and not ex)
               for tn, tx, ex in zip(sm["tmin"], sm["tmax"], extreme)]
    q = lambda a: [None if v is None else int(round(v)) for v in a]
    return {
        "curve": {"tmean": q(sm["tmean"]), "tmax": q(sm["tmax"]), "tmin": q(sm["tmin"])},
        "comfortDays": enrich._day_ranges(comfort), "extremeDays": enrich._day_ranges(extreme),
        "comfortDayCount": sum(comfort), "extremeDayCount": sum(extreme),
        "climate_src": "open-meteo-climate-api",
    }


def bake(lat, lng):
    daily_vars = "temperature_2m_mean,temperature_2m_max,temperature_2m_min,precipitation_sum"
    try:
        d = _fetch(ARCHIVE, lat, lng, daily_vars, "2014-01-01", "2023-12-31")
        src = "open-meteo-era5-archive"
    except urllib.error.HTTPError as e:
        if e.code != 429:
            raise
        d = _fetch(CLIMATE, lat, lng, daily_vars, "1991-01-01", "2020-12-31")
        src = "open-meteo-climate-api"
    except Exception:
        d = _fetch(CLIMATE, lat, lng, daily_vars, "1991-01-01", "2020-12-31")
        src = "open-meteo-climate-api"
    dc = daily_from(d)
    dc["climate_src"] = src
    return monthly_from(d), dc, src


def main():
    rows_raw = []
    con = sqlite3.connect(DB, timeout=120)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=120000")
    rows = con.execute(
        "SELECT l.id, l.lat, l.lng FROM listings l "
        "WHERE l.prov='台湾' AND l.lat IS NOT NULL "
        "AND (NOT EXISTS(SELECT 1 FROM climate c WHERE c.listing_id=l.id) "
        "OR l.daily_climate IS NULL OR l.daily_climate='') "
        "ORDER BY l.id").fetchall()
    con.close()
    print(f"tw-climate: {len(rows)} listing(s)", flush=True)
    for r in rows:
        try:
            months, dc, src = bake(r["lat"], r["lng"])
            rows_raw.append((r["id"], months, dc, src))
            print(f"  fetched id{r['id']} src={src}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"  ! fetch id{r['id']} {repr(e)[:100]}", flush=True)
        time.sleep(2.5)
    if rows_raw:
        CACHE.write_text(json.dumps(
            [{"id": lid, "months": months, "daily": dc, "src": src}
             for lid, months, dc, src in rows_raw],
            ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  cache → {CACHE.name}", flush=True)
    for attempt in range(30):
        try:
            con = sqlite3.connect(DB, timeout=120)
            con.execute("PRAGMA busy_timeout=120000")
            for lid, months, dc, src in rows_raw:
                enrich._store_climate_months(con, lid, months)
                con.execute("UPDATE listings SET daily_climate=? WHERE id=?",
                            (json.dumps(dc, separators=(",", ":")), lid))
            con.commit()
            con.close()
            print(f"  stored {len(rows_raw)} row(s)", flush=True)
            break
        except sqlite3.OperationalError as e:
            print(f"  db retry {attempt+1}: {e}", flush=True)
            time.sleep(15)
    else:
        print("  ! gave up on DB writes", flush=True)


if __name__ == "__main__":
    main()
