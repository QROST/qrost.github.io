#!/usr/bin/env python3
"""
finish_era5_download.py — 健壮补全 2024/2025 ERA5 下载（手动运行）。

为什么需要这个脚本（而不是直接 `era5_bulk.py download`）：
  默认 `cdsapi.Client()` 用 timeout=60 / retry_max=500。46MB 的结果文件
  在慢链路上下载超 60s 就 `Read timed out`，随即触发 500 次 ×120s 的空转
  （最长 ~16 小时假死）。本脚本把 client 调成 timeout=600 / 有界 retry，
  并加一层我方的 per-year 有界重试 + 半截校验，从根上消除"卡死"。

它做的事：
  - 复用 era5_bulk 的请求 schema(`_cds_retrieve`) 与合并逻辑(`_merge_year_parts`)，不重复造轮子。
  - 已存在且能打开的 .part.nc 半截 → 复用（当前盘上 2024/2025 的 tmean 半截都完好，只需补降水半截）。
  - 损坏/不完整的半截 → 删除重下。
  - 每年最多重试 OUTER_RETRIES 次，指数退避；某年失败不阻塞下一年。
  - 屏蔽 CDS "known issue（极值字段）" 噪声——我们只用 t2m / tp，与该 issue 无关。

用法：
  cd demos/china-housing
  tools/.venv/bin/python tools/finish_era5_download.py            # 默认 2024 2025
  tools/.venv/bin/python tools/finish_era5_download.py --years 2024
  tools/.venv/bin/python tools/finish_era5_download.py --force    # 忽略半截，全部重下

下完后（在母 session 里）：bump gridfield.YEARS → era5-bulk sample --force → build → commit。
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

# tools/ 自身加进 path，保证 `import era5_bulk` 可用，与 cwd 无关
sys.path.insert(0, str(Path(__file__).resolve().parent))
import era5_bulk  # noqa: E402

os.environ.setdefault("HDF5_USE_FILE_LOCKING", "FALSE")

DEFAULT_YEARS = (2024, 2025)
OUTER_RETRIES = 3            # 每年整体重试次数（我方层，cdsapi 内部另有有界 retry）
OUTER_BACKOFF = (30, 90, 180)  # 秒；指数退避
MIN_TIMESTEPS = 360         # 一整年应有 365/366 步；低于此判为不完整
# (variable, daily_statistic, part-path 取值器, 期望 data_var)
VARIABLES = (
    ("2m_temperature", "daily_mean", era5_bulk._temp_part_path, "t2m"),
    ("total_precipitation", "daily_sum", era5_bulk._prcp_part_path, "tp"),
)


def log(msg: str) -> None:
    print(msg, flush=True)


def _silence_cds_known_issue() -> None:
    """屏蔽 CDS 对极值字段的 known-issue 警告——与我们的 t2m/tp 无关，纯噪声。"""
    markers = ("known issue", "post-processed daily", "should not be used",
               "issue with the following parameters")

    class _DropKnownIssue(logging.Filter):
        def filter(self, record: logging.LogRecord) -> bool:  # noqa: A003
            text = str(record.getMessage()).lower()
            return not any(m in text for m in markers)

    flt = _DropKnownIssue()
    # cdsapi 0.7.x 走 datapi / cads_api_client；root 也挂一份兜底
    for name in ("", "datapi", "cads_api_client", "cdsapi", "ecmwf.datastores"):
        logging.getLogger(name).addFilter(flt)


def _robust_client():
    """timeout=600（结果下载不再超时，根因修复）+ 有界 retry（不再 500 空转）。"""
    import cdsapi  # noqa: WPS433
    return cdsapi.Client(
        quiet=False,            # 仍打印 accepted/running/successful
        progress=True,
        timeout=600,            # ← 关键：10 分钟读超时，46MB 文件下载充裕
        retry_max=6,            # ← 关键：cdsapi 内部 retry 收紧（默认 500）
        sleep_max=60,
        # 双保险消噪：API 侧 warning 也丢弃
        warning_callback=lambda *a, **k: None,
    )


def _valid_part(path: Path, expected_var: str) -> bool:
    """半截 NetCDF 能打开、含期望变量、步数≈整年 → 可复用。"""
    if not path.exists() or path.stat().st_size < 1_000_000:
        return False
    try:
        _np, xr = era5_bulk._ensure_deps()
        ds = xr.open_dataset(path)
        try:
            if expected_var not in ds.data_vars:
                return False
            tdims = [d for d in ds.sizes if "time" in d.lower() or "valid" in d.lower()]
            tlen = max((int(ds.sizes[d]) for d in tdims), default=0)
            return tlen >= MIN_TIMESTEPS
        finally:
            ds.close()
    except Exception:  # noqa: BLE001
        return False


def _valid_merged(year: int) -> bool:
    """合并后的 china_YYYY.nc 应同时含 t2m + tp。"""
    out = era5_bulk.era5_year_path(year)
    if not out.exists() or out.stat().st_size < 1_000_000:
        return False
    try:
        _np, xr = era5_bulk._ensure_deps()
        ds = xr.open_dataset(out)
        try:
            return "t2m" in ds.data_vars and "tp" in ds.data_vars
        finally:
            ds.close()
    except Exception:  # noqa: BLE001
        return False


def _download_year_once(client, year: int, *, force: bool) -> None:
    """下满一年的两个半截并合并；抛异常则交给外层重试。"""
    era5_bulk.ERA5_DIR.mkdir(parents=True, exist_ok=True)
    for variable, stat, part_fn, var_name in VARIABLES:
        part = part_fn(year)
        if not force and _valid_part(part, var_name):
            log(f"  ✓ reuse {part.name}（已完整，跳过）")
            continue
        if part.exists():
            log(f"  ! {part.name} 不完整/损坏 → 删除重下")
            part.unlink(missing_ok=True)
        era5_bulk._cds_retrieve(client, year, variable, stat, part, log)
        if not _valid_part(part, var_name):
            part.unlink(missing_ok=True)
            raise RuntimeError(f"{part.name} 下载后校验失败（步数不足或缺变量）")
    era5_bulk._merge_year_parts(year, log)
    if not _valid_merged(year):
        raise RuntimeError(f"china_{year}.nc 合并后校验失败（缺 t2m/tp）")


def download_year_robust(client, year: int, *, force: bool) -> bool:
    if not force and _valid_merged(year):
        log(f"[{year}] ✓ 已完整（china_{year}.nc 存在且有效），跳过")
        return True
    for attempt in range(1, OUTER_RETRIES + 1):
        try:
            log(f"[{year}] 尝试 {attempt}/{OUTER_RETRIES} …")
            _download_year_once(client, year, force=force and attempt == 1)
            log(f"[{year}] ✅ 完成 → {era5_bulk.era5_year_path(year).name}")
            return True
        except KeyboardInterrupt:
            raise
        except Exception as e:  # noqa: BLE001
            log(f"[{year}] ✗ 尝试 {attempt} 失败：{repr(e)[:160]}")
            if attempt < OUTER_RETRIES:
                wait = OUTER_BACKOFF[min(attempt - 1, len(OUTER_BACKOFF) - 1)]
                log(f"[{year}] {wait}s 后重试（已下好的半截会被复用）…")
                time.sleep(wait)
    log(f"[{year}] ⛔ {OUTER_RETRIES} 次后仍失败——保留已下半截，可重跑本脚本续传")
    return False


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="健壮补全 2024/2025 ERA5 下载")
    ap.add_argument("--years", nargs="+", type=int, default=list(DEFAULT_YEARS))
    ap.add_argument("--force", action="store_true", help="忽略已有半截，全部重下")
    args = ap.parse_args(argv)

    if not era5_bulk._cds_credentials_ok():
        log("✗ 缺 ~/.cdsapirc（url + key）——无法下载。")
        return 2

    _silence_cds_known_issue()
    log(f"=== ERA5 补全：{args.years}（timeout=600s, retry_max=6, 外层重试 {OUTER_RETRIES}）===")
    client = _robust_client()

    ok = []
    for year in args.years:
        if download_year_robust(client, year, force=args.force):
            ok.append(year)

    log("")
    log(f"=== 完成 {len(ok)}/{len(args.years)}：{ok} ===")
    if len(ok) == len(args.years):
        log("下一步（母 session 里执行）：")
        log("  1) gridfield.YEARS = (2014, %d)" % max(args.years))
        log("  2) era5-bulk sample --step 1.0  --force")
        log("  3) era5-bulk sample --step 0.25 --force")
        log("  4) build → 浏览器验证 → commit")
    return 0 if len(ok) == len(args.years) else 1


if __name__ == "__main__":
    raise SystemExit(main())
