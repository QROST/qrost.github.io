#!/usr/bin/env python3
"""Shared fail-closed provenance helpers for CIS evidence links.

The public QROST site is a presentation surface, never an information source.
An external-looking URL is insufficient by itself: each inline evidence link
must also declare who publishes it, that the publisher is external, and the
limited support scope assigned during review.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

VALID_SUPPORT_SCOPES = {"entity_identity", "claim_evidence", "candidate_lead"}
FORBIDDEN_SELF_AUTHORED_MARKERS = (
    "qrost",
    "research brief",
    "research note",
    "internal brief",
    "研究简报",
    "研究笔记",
    "内部简报",
)
REGISTRY_PATH = Path(__file__).with_name("source-authority-registry.json")
REGISTRY_REVIEW_STATUS = "screened_independent_external"


def url_host(url: object) -> str:
    """Return a normalized hostname for an external HTTP(S) URL, else ``""``."""
    try:
        parsed = urlparse(str(url or ""))
    except ValueError:
        return ""
    host = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme not in {"http", "https"} or not host:
        return ""
    if host in {"localhost", "127.0.0.1", "::1"}:
        return ""
    if host == "qrost.github.io" or host.endswith(".qrost.github.io"):
        return ""
    return host


@lru_cache(maxsize=1)
def load_authority_registry() -> tuple[dict[str, dict], tuple[str, ...]]:
    """Load the exact-URL authority decisions without inferring ownership.

    Registry entries are deliberately separate from public data and migration
    code.  Adding a plausible-looking URL to a record cannot make it evidence:
    the exact URL and publisher identity must already have a reviewed entry.
    """
    issues: list[str] = []
    try:
        payload = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {}, (f"source authority registry is unreadable: {exc}",)

    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        issues.append("source authority registry schema_version must be 1")
    entries = payload.get("entries") if isinstance(payload, dict) else None
    if not isinstance(entries, list):
        return {}, tuple(issues + ["source authority registry entries must be an array"])

    registry: dict[str, dict] = {}
    required = {
        "url", "publisher", "publisher_domain", "publisher_ownership",
        "review_status", "review_basis", "reviewed_at",
    }
    for index, entry in enumerate(entries):
        ctx = f"source authority registry entries[{index}]"
        if not isinstance(entry, dict):
            issues.append(f"{ctx}: entry must be an object")
            continue
        missing = sorted(required - set(entry))
        extra = sorted(set(entry) - required - {"publisher_aliases"})
        if missing:
            issues.append(f"{ctx}: missing fields {missing}")
        if extra:
            issues.append(f"{ctx}: unexpected fields {extra}")
        url = entry.get("url")
        host = url_host(url)
        if not host:
            issues.append(f"{ctx}: external http(s) URL required")
            continue
        if url in registry:
            issues.append(f"{ctx}: duplicate exact URL {url!r}")
            continue
        if entry.get("publisher_domain") != host:
            issues.append(f"{ctx}: publisher_domain must match exact URL host")
        if entry.get("publisher_ownership") != "external":
            issues.append(f"{ctx}: publisher_ownership must be external")
        if entry.get("review_status") != REGISTRY_REVIEW_STATUS:
            issues.append(f"{ctx}: invalid review_status")
        for field in ("publisher", "review_basis", "reviewed_at"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                issues.append(f"{ctx}: nonempty {field} required")
        aliases = entry.get("publisher_aliases", [])
        if not isinstance(aliases, list) or any(
            not isinstance(alias, str) or not alias.strip() for alias in aliases
        ):
            issues.append(f"{ctx}: publisher_aliases must be an array of nonempty strings")
        searchable = " ".join(
            str(entry.get(field) or "")
            for field in ("url", "publisher", "publisher_domain", "review_basis")
        ) + " " + " ".join(str(alias) for alias in aliases if isinstance(alias, str))
        searchable = searchable.lower()
        for marker in FORBIDDEN_SELF_AUTHORED_MARKERS:
            if marker in searchable:
                issues.append(f"{ctx}: forbidden self-authored marker {marker!r}")
        registry[str(url)] = entry
    return registry, tuple(issues)


def authority_for_url(url: object) -> dict | None:
    registry, _ = load_authority_registry()
    return registry.get(str(url or ""))


def registry_contract_issues() -> list[str]:
    """Return structural errors in the checked-in authority registry."""
    _, issues = load_authority_registry()
    return list(issues)


def normalize_source(source: dict, support_scope: str) -> dict:
    """Fill missing metadata only from an exact reviewed registry decision.

    Existing ownership is never overwritten.  In particular, a record marked
    ``self_authored`` stays self-authored and will fail validation.
    """
    normalized = dict(source)
    authority = authority_for_url(source.get("url"))
    if authority:
        normalized.setdefault("publisher", authority["publisher"])
        normalized.setdefault("publisher_domain", authority["publisher_domain"])
        normalized.setdefault("publisher_ownership", authority["publisher_ownership"])
    normalized["support_scope"] = support_scope
    return normalized


def normalize_source_url(record: dict, support_scope: str) -> dict:
    """Fill legacy shorthand metadata from the same exact reviewed registry."""
    normalized = dict(record)
    authority = authority_for_url(record.get("source_url"))
    if authority:
        normalized.setdefault("source_publisher", authority["publisher"])
        normalized.setdefault("source_publisher_domain", authority["publisher_domain"])
        normalized.setdefault("source_publisher_ownership", authority["publisher_ownership"])
    normalized["source_support_scope"] = support_scope
    return normalized


def source_contract_issues(
    source: object,
    ctx: str,
    *,
    expected_scope: str | None = None,
) -> list[str]:
    """Validate URL, publisher identity, ownership and declared support scope."""
    if not isinstance(source, dict):
        return [f"{ctx}: source must be object"]

    issues: list[str] = []
    host = url_host(source.get("url"))
    if not host:
        issues.append(f"{ctx}: external http(s) source URL required")

    publisher = source.get("publisher")
    if not isinstance(publisher, str) or not publisher.strip():
        issues.append(f"{ctx}: nonempty publisher required")

    publisher_domain = source.get("publisher_domain")
    if not isinstance(publisher_domain, str) or not publisher_domain.strip():
        issues.append(f"{ctx}: nonempty publisher_domain required")
    elif host and publisher_domain.lower().rstrip(".") != host:
        issues.append(f"{ctx}: publisher_domain must match source URL host")

    if source.get("publisher_ownership") != "external":
        issues.append(f"{ctx}: publisher_ownership must be external")

    authority = authority_for_url(source.get("url"))
    if authority is None:
        issues.append(f"{ctx}: exact URL is absent from reviewed source authority registry")
    else:
        allowed_publishers = {authority.get("publisher"), *(authority.get("publisher_aliases") or [])}
        if source.get("publisher") not in allowed_publishers:
            issues.append(f"{ctx}: publisher does not match reviewed source authority registry")
        for field in ("publisher_domain", "publisher_ownership"):
            if source.get(field) != authority.get(field):
                issues.append(f"{ctx}: {field} does not match reviewed source authority registry")

    scope = source.get("support_scope")
    if scope not in VALID_SUPPORT_SCOPES:
        issues.append(f"{ctx}: invalid support_scope={scope!r}")
    elif expected_scope is not None and scope != expected_scope:
        issues.append(f"{ctx}: support_scope must be {expected_scope!r}")

    searchable = " ".join(
        str(source.get(field) or "")
        for field in ("url", "title", "publisher", "publisher_domain")
    ).lower()
    for marker in FORBIDDEN_SELF_AUTHORED_MARKERS:
        if marker in searchable:
            issues.append(f"{ctx}: forbidden self-authored marker {marker!r}")

    return issues


def source_url_contract_issues(
    record: object,
    ctx: str,
    *,
    expected_scope: str | None = None,
) -> list[str]:
    """Validate publisher metadata stored beside a legacy ``source_url``."""
    if not isinstance(record, dict):
        return [f"{ctx}: source_url record must be object"]
    source = {
        "url": record.get("source_url"),
        "title": record.get("title") or record.get("title_zh") or record.get("text_zh"),
        "publisher": record.get("source_publisher"),
        "publisher_domain": record.get("source_publisher_domain"),
        "publisher_ownership": record.get("source_publisher_ownership"),
        "support_scope": record.get("source_support_scope"),
    }
    return source_contract_issues(source, ctx, expected_scope=expected_scope)
