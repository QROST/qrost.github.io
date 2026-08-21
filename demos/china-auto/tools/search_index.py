#!/usr/bin/env python3
"""Pinyin / initials / alias search keys for china-auto entities.

Uses tmp/venv pypinyin when present so seed does not depend on system pip.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_VENV_SP = ROOT / "tmp" / "venv" / "lib"
if _VENV_SP.exists():
    for sp in _VENV_SP.glob("python*/site-packages"):
        p = str(sp)
        if p not in sys.path:
            sys.path.insert(0, p)

try:
    from pypinyin import Style, lazy_pinyin
except ImportError:  # pragma: no cover
    lazy_pinyin = None  # type: ignore
    Style = None  # type: ignore

_NON_ALNUM = re.compile(r"[^0-9a-z\u4e00-\u9fff]+", re.I)
_CJK = re.compile(r"[\u4e00-\u9fff]")


def fold(s: str) -> str:
    t = (s or "").strip().lower().replace("ü", "v").replace("u:", "v")
    t = t.replace("'", "").replace("’", "").replace("`", "")
    t = _NON_ALNUM.sub("", t)
    return t


def _pinyin_parts(text: str) -> list[str]:
    if not text or lazy_pinyin is None:
        return []
    return [p for p in lazy_pinyin(text, style=Style.NORMAL) if p]


def make_keys(*parts: str | None, aliases: list[str] | None = None) -> list[str]:
    texts: list[str] = []
    for p in parts:
        if p:
            texts.append(str(p))
    if aliases:
        texts.extend(str(a) for a in aliases if a)

    keys: set[str] = set()
    for t in texts:
        t = t.strip()
        if not t:
            continue
        keys.add(t)
        keys.add(t.lower())
        folded = fold(t)
        if folded:
            keys.add(folded)
        slug = t.lower().replace("_", "-")
        keys.add(slug)
        keys.add(slug.replace("-", ""))

        py = _pinyin_parts(t)
        if py:
            joined = "".join(py)
            spaced = " ".join(py)
            initials = "".join(p[0] for p in py if p)
            keys.update({joined, spaced, initials, fold(joined), fold(spaced)})
            # 单字首字母：仅 CJK 音节
            cjk_init = "".join(p[0] for p, ch in zip(py, t) if _CJK.match(ch) and p)
            if cjk_init:
                keys.add(cjk_init)
            # 连续前缀：b, bj, bjd… 由查询端做 prefix；这里放全量 initials
            if len(initials) >= 2:
                keys.add(initials[:2])
            if len(initials) >= 3:
                keys.add(initials[:3])

        if lazy_pinyin is not None and _CJK.search(t):
            fl = "".join(lazy_pinyin(t, style=Style.FIRST_LETTER))
            if fl:
                keys.add(fl)
                if len(fl) >= 2:
                    keys.add(fl[:2])
                if len(fl) >= 3:
                    keys.add(fl[:3])

    out = sorted({fold(k) or k.lower() for k in keys if k and (fold(k) or k.lower())})
    return [k for k in out if k]


def matches(keys: list[str], query: str) -> bool:
    q = fold(query)
    if not q:
        return True
    folded = [fold(k) for k in keys if k]
    for k in folded:
        if q in k or (len(k) >= 2 and k in q):
            return True
    # initials: query is a prefix of an initials-like key (all letters, short)
    if q.isalpha() and 1 <= len(q) <= 8:
        for k in folded:
            if k.startswith(q):
                return True
            # subsequence of initials only when query length >= 2 and key is short
    return False


def attach(entity: dict, *fields: str, extra: list[str] | None = None) -> None:
    parts: list[str | None] = [entity.get("id")]
    for f in fields:
        parts.append(entity.get(f))
    aliases = list(entity.get("aliases") or [])
    if extra:
        aliases.extend(extra)
    entity["search_keys"] = make_keys(*parts, aliases=aliases)
