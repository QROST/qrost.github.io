"""Adapter registry. A source = anything that yields (NormalizedShelter, [NormalizedCat]).

manage.py stays source-agnostic: it just calls iter_source(name, session, **opts).
Add a new region/source by writing a module here and registering it below.
"""
from __future__ import annotations

from . import socrata, rescuegroups

# source name -> (module, fetch callable)
_REGISTRY = {
    "socrata": socrata,
    "rescuegroups": rescuegroups,
}

ATTRIBUTIONS = {
    "socrata": socrata.ATTRIBUTION,
    "rescuegroups": rescuegroups.ATTRIBUTION,
}


def available_sources() -> list[str]:
    return list(_REGISTRY.keys())


def iter_source(name: str, session, **opts):
    """Yield (shelter, cats) tuples for the named source."""
    if name == "socrata":
        keys = opts.get("socrata_sources")
        yield from socrata.fetch(session, source_keys=keys,
                                  max_per_source=opts.get("max", 1000))
    elif name == "rescuegroups":
        yield from rescuegroups.fetch(session, max_total=opts.get("max", 500),
                                      location=opts.get("location"),
                                      radius=opts.get("radius", 100))
    else:
        raise SystemExit(f"unknown source '{name}'. Available: {available_sources()}")
