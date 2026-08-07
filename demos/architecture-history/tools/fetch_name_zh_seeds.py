#!/usr/bin/env python3
"""Fetch durable Chinese-name seeds from enwiki→zh langlinks for catalog people."""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

from fetch_wikidata_pilot import atomic_write_json, load_json, qid_number


ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "assets" / "data" / "catalog" / "wikidata-hydration.json"
DEFAULT_OUTPUT = ROOT / "tools" / "name-zh-seeds.json"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
ENWIKI_API = "https://en.wikipedia.org/w/api.php"
ZHWIKI_API = "https://zh.wikipedia.org/w/api.php"
USER_AGENT = "QROST-Architecture-History/0.1 (name-zh langlink)"
BATCH_SIZE = 40
WIKIDATA_INTERVAL = 0.5
ENWIKI_INTERVAL = 1.0
ZHWIKI_INTERVAL = 1.0
DISAMBIG_SUFFIX = " (消歧义)"


def langlink_title(row: dict) -> str | None:
    title = row.get("*") or row.get("title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    return None


def api_error(payload: dict, url: str) -> None:
    error = payload.get("error")
    if isinstance(error, dict):
        raise RuntimeError(f"{url}: API error {error.get('code')}: {error.get('info')}")


def qid_slug(qid: str) -> str:
    qid_number(qid)
    return qid.lower()


def entity_id(qid: str) -> str:
    return f"person-wd-{qid_slug(qid)}"


def wiki_title_to_name(title: str) -> str:
    return title.replace("_", " ")


def zh_wiki_url(title: str) -> str:
    encoded = urllib.parse.quote(title.replace(" ", "_"), safe="/")
    return f"https://zh.wikipedia.org/wiki/{encoded}"


def request_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                raise RuntimeError(f"{url}: expected JSON object")
            return payload
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            if not retryable or attempt + 1 == 5:
                raise
            retry_after = error.headers.get("Retry-After")
            delay = (
                int(retry_after)
                if retry_after and retry_after.isdigit()
                else 2 ** attempt
            )
            time.sleep(min(delay, 30))
        except (TimeoutError, urllib.error.URLError):
            if attempt + 1 == 5:
                raise
            time.sleep(min(2 ** attempt, 20))
    raise RuntimeError("unreachable request retry state")


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


def fetch_sitelinks(qids: list[str]) -> dict[str, str | None]:
    titles: dict[str, str | None] = {}
    for batch in chunked(qids, BATCH_SIZE):
        params = urllib.parse.urlencode(
            {
                "action": "wbgetentities",
                "format": "json",
                "ids": "|".join(batch),
                "props": "sitelinks",
            }
        )
        payload = request_json(f"{WIKIDATA_API}?{params}")
        api_error(payload, WIKIDATA_API)
        time.sleep(WIKIDATA_INTERVAL)
        entities = payload.get("entities", {})
        for qid in batch:
            entity = entities.get(qid, {})
            sitelinks = entity.get("sitelinks", {})
            enwiki = sitelinks.get("enwiki", {})
            title = enwiki.get("title")
            titles[qid] = title if isinstance(title, str) and title.strip() else None
    return titles


def fetch_zh_langlinks(enwiki_titles: dict[str, str]) -> dict[str, str | None]:
    """Map qid -> zh langlink title (or None)."""
    zh_titles: dict[str, str | None] = {}
    title_to_qids: dict[str, list[str]] = {}
    for qid, title in enwiki_titles.items():
        title_to_qids.setdefault(title, []).append(qid)

    unique_titles = sorted(title_to_qids)
    for batch in chunked(unique_titles, 50):
        params = urllib.parse.urlencode(
            {
                "action": "query",
                "format": "json",
                "formatversion": "1",
                "prop": "langlinks",
                "lllang": "zh",
                "redirects": "1",
                "titles": "|".join(batch),
            }
        )
        payload = request_json(f"{ENWIKI_API}?{params}")
        api_error(payload, ENWIKI_API)
        time.sleep(ENWIKI_INTERVAL)
        query = payload.get("query", {})
        alias_to_canonical: dict[str, str] = {}
        for row in query.get("normalized", []):
            if isinstance(row.get("from"), str) and isinstance(row.get("to"), str):
                alias_to_canonical[row["from"]] = row["to"]
        for row in query.get("redirects", []):
            if isinstance(row.get("from"), str) and isinstance(row.get("to"), str):
                alias_to_canonical[row["from"]] = row["to"]

        resolved: dict[str, str | None] = {}
        for page in query.get("pages", {}).values():
            page_title = page.get("title")
            if not isinstance(page_title, str):
                continue
            langlinks = page.get("langlinks")
            zh_title: str | None = None
            if isinstance(langlinks, list) and langlinks:
                candidates = [
                    title
                    for row in langlinks
                    if isinstance(row, dict)
                    and row.get("lang") == "zh"
                    for title in [langlink_title(row)]
                    if title is not None
                ]
                if candidates:
                    non_disambig = [
                        title
                        for title in candidates
                        if not title.endswith(DISAMBIG_SUFFIX)
                    ]
                    if non_disambig:
                        zh_title = non_disambig[0]
                    elif len(candidates) == 1:
                        zh_title = candidates[0]
            resolved[page_title] = zh_title

        for title in batch:
            canonical = alias_to_canonical.get(title, title)
            zh_title = resolved.get(canonical)
            for qid in title_to_qids.get(title, []):
                zh_titles[qid] = zh_title
    return zh_titles


def fetch_page_wikibase_items(
    api_base: str,
    titles: list[str],
    *,
    interval: float,
) -> dict[str, str | None]:
    """Map Wikipedia page title -> wikibase_item QID (or None if missing)."""
    if not titles:
        return {}

    unique_titles = sorted(set(titles))
    result: dict[str, str | None] = {title: None for title in unique_titles}

    for batch in chunked(unique_titles, 50):
        params = urllib.parse.urlencode(
            {
                "action": "query",
                "format": "json",
                "formatversion": "1",
                "prop": "pageprops",
                "ppprop": "wikibase_item",
                "redirects": "1",
                "titles": "|".join(batch),
            }
        )
        payload = request_json(f"{api_base}?{params}")
        api_error(payload, api_base)
        time.sleep(interval)
        query = payload.get("query", {})
        alias_to_canonical: dict[str, str] = {}
        for row in query.get("normalized", []):
            if isinstance(row.get("from"), str) and isinstance(row.get("to"), str):
                alias_to_canonical[row["from"]] = row["to"]
        for row in query.get("redirects", []):
            if isinstance(row.get("from"), str) and isinstance(row.get("to"), str):
                alias_to_canonical[row["from"]] = row["to"]

        resolved: dict[str, str | None] = {}
        for page in query.get("pages", {}).values():
            page_title = page.get("title")
            if not isinstance(page_title, str):
                continue
            pageprops = page.get("pageprops", {})
            wikibase_item = pageprops.get("wikibase_item")
            if isinstance(wikibase_item, str) and wikibase_item.startswith("Q"):
                resolved[page_title] = wikibase_item
            else:
                resolved[page_title] = None

        for title in batch:
            canonical = alias_to_canonical.get(title, title)
            result[title] = resolved.get(canonical)

    return result


def filter_enwiki_by_owner(
    enwiki_titles: dict[str, str | None],
) -> tuple[dict[str, str], int]:
    """Keep enwiki sitelinks whose page wikibase_item matches the person QID."""
    with_enwiki = {
        qid: title
        for qid, title in enwiki_titles.items()
        if isinstance(title, str) and title.strip()
    }
    title_to_owner = fetch_page_wikibase_items(
        ENWIKI_API,
        sorted(set(with_enwiki.values())),
        interval=ENWIKI_INTERVAL,
    )

    ok: dict[str, str] = {}
    rejected = 0
    for qid, title in with_enwiki.items():
        owner = title_to_owner.get(title)
        if owner == qid:
            ok[qid] = title
        else:
            rejected += 1
    return ok, rejected


def filter_zh_by_owner(
    zh_titles: dict[str, str | None],
) -> tuple[dict[str, str], int]:
    """Keep zh langlinks whose page wikibase_item matches the person QID."""
    with_zh = {
        qid: title
        for qid, title in zh_titles.items()
        if isinstance(title, str) and title.strip()
    }
    title_to_owner = fetch_page_wikibase_items(
        ZHWIKI_API,
        sorted(set(with_zh.values())),
        interval=ZHWIKI_INTERVAL,
    )

    ok: dict[str, str] = {}
    rejected = 0
    for qid, title in with_zh.items():
        owner = title_to_owner.get(title)
        if owner == qid:
            ok[qid] = title
        else:
            rejected += 1
    return ok, rejected


def missing_people(catalog: dict) -> list[dict]:
    return sorted(
        [
            person
            for person in catalog["people"]
            if person.get("name_zh") is None
        ],
        key=lambda row: qid_number(row["external_ids"]["wikidata"]),
    )


def build_seeds(
    people: list[dict],
    zh_titles: dict[str, str | None],
    accessed: str,
) -> list[dict]:
    seeds: list[dict] = []
    for person in people:
        qid = person["external_ids"]["wikidata"]
        zh_title = zh_titles.get(qid)
        if not zh_title:
            continue
        name_zh = wiki_title_to_name(zh_title)
        seeds.append(
            {
                "qid": qid,
                "entity_id": person["id"],
                "name_en": person["name_en"],
                "name_zh": name_zh,
                "name_zh_status": "common_translation",
                "evidence_url": zh_wiki_url(zh_title),
                "source": "enwiki_langlink",
            }
        )
    seeds.sort(key=lambda row: qid_number(row["qid"]))
    return seeds


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--accessed",
        default=date.today().isoformat(),
        help="Access date for the seed file (YYYY-MM-DD).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output seed JSON path.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog = load_json(CATALOG_PATH)
    people = missing_people(catalog)
    qids = [person["external_ids"]["wikidata"] for person in people]

    enwiki_titles = fetch_sitelinks(qids)
    with_enwiki = sum(
        1 for title in enwiki_titles.values() if isinstance(title, str) and title.strip()
    )
    enwiki_owner_ok, enwiki_rejected = filter_enwiki_by_owner(enwiki_titles)

    zh_titles_raw = fetch_zh_langlinks(enwiki_owner_ok)
    with_zh_langlink = sum(
        1 for title in zh_titles_raw.values() if isinstance(title, str) and title.strip()
    )
    zh_owner_ok, zh_rejected = filter_zh_by_owner(zh_titles_raw)

    seeds = build_seeds(people, zh_owner_ok, args.accessed)

    print(f"missing: {len(qids)}", flush=True)
    print(f"with_enwiki: {with_enwiki}", flush=True)
    print(f"enwiki_owner_ok: {len(enwiki_owner_ok)}", flush=True)
    if enwiki_rejected:
        print(f"enwiki_owner_mismatch_rejected: {enwiki_rejected}", flush=True)
    print(f"with_zh_langlink: {with_zh_langlink}", flush=True)
    print(f"zh_owner_ok: {len(zh_owner_ok)}", flush=True)
    if zh_rejected:
        print(f"zh_owner_mismatch_rejected: {zh_rejected}", flush=True)
    print(f"seeds_written: {len(seeds)}", flush=True)

    payload = {
        "seed_version": "0.1.0",
        "accessed": args.accessed,
        "method": "enwiki_langlink_to_zh",
        "rejected": {
            "enwiki_owner_mismatch": enwiki_rejected,
            "zh_owner_mismatch": zh_rejected,
        },
        "seeds": seeds,
    }
    atomic_write_json(args.output.resolve(), payload)
    print(f"Wrote {len(seeds)} seeds to {args.output}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
