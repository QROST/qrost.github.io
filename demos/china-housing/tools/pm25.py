#!/usr/bin/env python3
"""
china-housing PM2.5 enrichment — ChinaHighPM2.5 (Zenodo 6398971).

Samples the 1 km CHAP gridded PM2.5 product at each geocoded listing:
  - pm25_annual   — calendar-year mean (Y1K NetCDF, µg/m³)
  - pm25_heating  — heating-season mean Nov(Y−1)…Mar(Y) (M1K monthly, µg/m³)

Source: Wei et al., RSE 2021 / ACP 2020; WGS-84 lat/lon grid (~0.01°).
Heating season follows the northern municipal heating window (Nov–Mar).

Requires netCDF4 (+ numpy). If missing from the active interpreter, falls back to
tools/.venv (see tools/requirements-pm25.txt).
"""
from __future__ import annotations

import site
import sqlite3
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "chinahighpm25"
ZENODO_REC = "6398971"
ZENODO_BASE = f"https://zenodo.org/api/records/{ZENODO_REC}/files"
VERSION_TAG = "V4"
REF_YEAR = 2020
UA = "qrost-china-housing/1.0 (+https://qrost.github.io; contact czd358121692@gmail.com)"
_OVERSEAS_PROV = {"California"}
# ChinaHighPM2.5 grid extent (approx; listings outside → null)
_CN_LAT = (15.0, 55.0)
_CN_LNG = (70.0, 137.0)
_HEATING_MONTHS = ((11, -1), (12, -1), (1, 0), (2, 0), (3, 0))  # (month, year offset from REF_YEAR)


def _ensure_numpy_netcdf():
    """Import numpy + netCDF4; inject tools/.venv site-packages if needed."""
    try:
        import numpy as np  # noqa: WPS433
        from netCDF4 import Dataset  # noqa: WPS433
        return np, Dataset
    except ImportError:
        venv = Path(__file__).resolve().parent / ".venv"
        if venv.is_dir():
            for sp in sorted((venv / "lib").glob("python*/site-packages")):
                site.addsitedir(str(sp))
        import numpy as np  # noqa: WPS433
        from netCDF4 import Dataset  # noqa: WPS433
        return np, Dataset


def _zenodo_url(filename: str) -> str:
    from urllib.parse import quote
    return f"{ZENODO_BASE}/{quote(filename)}/content"


def _download(url: str, dest: Path, log) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    log(f"  download {dest.name} …")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as fh:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            fh.write(chunk)


def _y1k_path(year: int) -> Path:
    return CACHE / f"CHAP_PM2.5_Y1K_{year}_{VERSION_TAG}.nc"


def _m1k_rar_path(year: int) -> Path:
    return CACHE / f"CHAP_PM2.5_M1K_{year}_{VERSION_TAG}.rar"


def _m1k_nc_path(year: int, month: int) -> Path:
    return CACHE / f"m1k_{year}" / f"CHAP_PM2.5_M1K_{year}{month:02d}_{VERSION_TAG}.nc"


def _extract_m1k_month(year: int, month: int, log) -> Path:
    """Ensure one monthly M1K NetCDF exists (extract from year rar via bsdtar)."""
    out = _m1k_nc_path(year, month)
    if out.exists() and out.stat().st_size > 0:
        return out
    rar = _m1k_rar_path(year)
    member = f"CHAP_PM2.5_M1K_{year}{month:02d}_{VERSION_TAG}.nc"
    _download(_zenodo_url(rar.name), rar, log)
    out.parent.mkdir(parents=True, exist_ok=True)
    log(f"  extract {member} from {rar.name}")
    subprocess.run(
        ["bsdtar", "-xf", str(rar), "-C", str(out.parent), member],
        check=True,
        capture_output=True,
    )
    if not out.exists():
        raise FileNotFoundError(f"bsdtar did not produce {out}")
    return out


def _read_pm25_value(path: Path, lat: float, lng: float) -> float | None:
    np, Dataset = _ensure_numpy_netcdf()
    if not (_CN_LAT[0] <= lat <= _CN_LAT[1] and _CN_LNG[0] <= lng <= _CN_LNG[1]):
        return None
    with Dataset(path) as ds:
        lats = ds.variables["lat"][:]
        lons = ds.variables["lon"][:]
        li = int(np.argmin(np.abs(lats - lat)))
        lj = int(np.argmin(np.abs(lons - lng)))
        var = ds.variables["PM2.5"]
        # netCDF4 applies scale_factor/add_offset on read (auto-scale defaults on).
        raw = var[li, lj] if var.ndim == 2 else var[0, li, lj]
        if np.ma.is_masked(raw):
            return None
        val = float(raw)
        if val < 0 or val > 500:
            return None
        return round(val, 1)


def _heating_paths(ref_year: int) -> list[tuple[int, int, Path]]:
    paths = []
    for month, yoff in _HEATING_MONTHS:
        y = ref_year + yoff
        paths.append((y, month, _m1k_nc_path(y, month)))
    return paths


def ensure_cache(ref_year: int, log) -> dict:
    """Download Y1K + M1K rars/months needed for ref_year annual + heating season."""
    CACHE.mkdir(parents=True, exist_ok=True)
    y1k = _y1k_path(ref_year)
    _download(_zenodo_url(y1k.name), y1k, log)
    years_needed = {ref_year + off for _, off in _HEATING_MONTHS}
    for y in sorted(years_needed):
        for month, yoff in _HEATING_MONTHS:
            if ref_year + yoff != y:
                continue
            _extract_m1k_month(y, month, log)
    return {"y1k": y1k, "heating": _heating_paths(ref_year)}


def sample_listing(lat: float, lng: float, ref_year: int, cache: dict) -> dict:
    annual = _read_pm25_value(cache["y1k"], lat, lng)
    heating_vals = []
    for y, month, _ in cache["heating"]:
        p = _m1k_nc_path(y, month)
        v = _read_pm25_value(p, lat, lng)
        if v is not None:
            heating_vals.append(v)
    heating = round(sum(heating_vals) / len(heating_vals), 1) if len(heating_vals) == 5 else None
    return {
        "pm25_annual": annual,
        "pm25_heating": heating,
        "pm25_year": ref_year,
        "pm25_src": f"ChinaHighPM2.5 Zenodo {ZENODO_REC} Y1K/M1K {VERSION_TAG}",
    }


def migrate(con: sqlite3.Connection) -> None:
    cols = {r[1] for r in con.execute("PRAGMA table_info(listings)")}
    for col, decl in (
        ("pm25_annual", "REAL"),
        ("pm25_heating", "REAL"),
        ("pm25_year", "INTEGER"),
        ("pm25_src", "TEXT"),
    ):
        if col not in cols:
            con.execute(f"ALTER TABLE listings ADD COLUMN {col} {decl}")
    con.commit()


def pm25_all(
    con: sqlite3.Connection,
    log,
    *,
    year: int = REF_YEAR,
    force: bool = False,
) -> dict:
    """Sample PM2.5 for all geocoded China listings; resumable unless --force."""
    migrate(con)
    _ensure_numpy_netcdf()
    cache = ensure_cache(year, log)
    if force:
        rows = con.execute(
            """SELECT id, lat, lng, prov FROM listings
               WHERE lat IS NOT NULL AND prov NOT IN ('California')"""
        ).fetchall()
    else:
        rows = con.execute(
            """SELECT id, lat, lng, prov FROM listings
               WHERE lat IS NOT NULL AND prov NOT IN ('California')
                 AND pm25_annual IS NULL"""
        ).fetchall()
    log(f"pm25: {len(rows)} listing(s) to sample (ChinaHighPM2.5 {year}) …")
    done = miss = 0
    for r in rows:
        s = sample_listing(r["lat"], r["lng"], year, cache)
        if s["pm25_annual"] is None and s["pm25_heating"] is None:
            miss += 1
        else:
            done += 1
        con.execute(
            """UPDATE listings SET pm25_annual=?, pm25_heating=?, pm25_year=?, pm25_src=?
               WHERE id=?""",
            (s["pm25_annual"], s["pm25_heating"], s["pm25_year"], s["pm25_src"], r["id"]),
        )
    con.commit()
    total = con.execute(
        """SELECT COUNT(*) FROM listings
           WHERE lat IS NOT NULL AND prov NOT IN ('California') AND pm25_annual IS NOT NULL"""
    ).fetchone()[0]
    geo_cn = con.execute(
        "SELECT COUNT(*) FROM listings WHERE lat IS NOT NULL AND prov NOT IN ('California')"
    ).fetchone()[0]
    rep = {
        "year": year,
        "processed": len(rows),
        "filled": done,
        "missing_grid": miss,
        "coverage": f"{total}/{geo_cn}",
        "cache_dir": str(CACHE.relative_to(ROOT)),
        "sampling": "nearest 1 km grid cell (WGS-84 lat/lon)",
        "heating_months": "Nov(Y-1), Dec(Y-1), Jan(Y), Feb(Y), Mar(Y)",
    }
    log(f"pm25 done: {done} filled, {miss} off-grid/null this pass; coverage {rep['coverage']}")
    return rep


def dataset_meta() -> dict:
    """Static metadata for README / methodology stub."""
    return {
        "doi": "10.5281/zenodo.6398971",
        "zenodo": ZENODO_REC,
        "product": "ChinaHighPM2.5 CHAP",
        "resolution_km": 1,
        "crs": "WGS-84 geographic (~0.01° lat/lon)",
        "years_zenodo_y1k": list(range(2000, 2022)),
        "ref_year_default": REF_YEAR,
        "variables": {"annual": "Y1K calendar-year mean", "heating": "M1K mean Nov(Y-1)–Mar(Y)"},
        "units": "µg/m³",
    }
