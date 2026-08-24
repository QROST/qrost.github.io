#!/usr/bin/env python3
"""Run the stable, read-only public-site gate suite with grouped failures."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Gate:
    group: str
    label: str
    command: tuple[str, ...]


GATES = (
    Gate("root", "cache tokens", (sys.executable, "tools/build.py", "--check")),
    Gate("root", "committed Tailwind CSS", ("npm", "run", "check:css")),
    Gate("root", "public metadata inventory", (sys.executable, "tools/check_public_metadata.py")),
    Gate("root", "metadata mutation tests", (sys.executable, "tools/test_public_metadata.py")),
    Gate("china-auto", "data/schema provenance", (sys.executable, "demos/china-auto/tools/validate.py")),
    Gate("china-auto", "search contract", (sys.executable, "demos/china-auto/tools/test_search.py")),
    Gate("china-auto", "source-authority mutations", (sys.executable, "demos/china-auto/tools/test_provenance.py")),
    Gate("china-auto", "page contract", (sys.executable, "demos/china-auto/tools/test_page_contract.py")),
    Gate("china-auto", "cluster graph projection", ("node", "demos/china-auto/tools/test_cluster_graph.js")),
    Gate("china-auto", "cache token and build contract", (sys.executable, "demos/china-auto/tools/build.py", "--check")),
    Gate("china-auto", "build idempotence", (sys.executable, "demos/china-auto/tools/test_build_idempotence.py")),
    Gate("architecture-history", "page/data projection contract", (sys.executable, "demos/architecture-history/tools/test_page_contract.py")),
    Gate("architecture-history", "lazy verified loader", ("node", "demos/architecture-history/tools/test_data_loader.js")),
    Gate("architecture-history", "people display/lineage boundary", (sys.executable, "demos/architecture-history/tools/test_people_policy.py")),
    Gate("china-industrial-software", "data/schema provenance", (sys.executable, "demos/china-industrial-software/tools/validate.py")),
    Gate("china-industrial-software", "source-authority mutations", (sys.executable, "demos/china-industrial-software/tools/test_provenance.py")),
    Gate("china-industrial-software", "deterministic migration", (sys.executable, "demos/china-industrial-software/tools/test_breakthrough_migration.py")),
    Gate("china-industrial-software", "closed schema and FK mutations", (sys.executable, "demos/china-industrial-software/tools/test_data_contract.py")),
    Gate("china-industrial-software", "page contract", (sys.executable, "demos/china-industrial-software/tools/test_page_contract.py")),
    Gate("china-industrial-software", "build idempotence", (sys.executable, "demos/china-industrial-software/tools/test_build_idempotence.py")),
    Gate("china-housing", "cache tokens", ("node", "demos/china-housing/tools/stamp-cache.mjs", "--check")),
    Gate("pharm-companies", "manifest/cache/data check", (sys.executable, "demos/pharm-companies/tools/build.py", "--check")),
    Gate("pharm-companies", "atomic lazy product loader", ("node", "demos/pharm-companies/tools/test_data_loader.js")),
    Gate("pharm-companies", "lazy UI contract", ("node", "demos/pharm-companies/tools/test_lazy_ui_contract.js")),
    Gate("shelter-cats", "manifest/cache check", (sys.executable, "demos/shelter-cats/tools/build.py", "--check")),
    Gate("shelter-cats", "SQLite projection mutation", (sys.executable, "demos/shelter-cats/tools/test_build_check.py")),
    Gate("shelter-cats", "data validation", (sys.executable, "demos/shelter-cats/tools/validate.py")),
    Gate("visual-page", "cache tokens", ("node", "demos/visual-page/tools/stamp-cache.mjs", "--check")),
    Gate("neon-abyss", "cache tokens", ("node", "demos/neon-abyss/tools/stamp-cache.mjs", "--check")),
    Gate("generative-art", "pre-module fallback and reduced motion", ("node", "demos/visual-page/tools/check-module-watchdog.mjs")),
    Gate("makoauto", "multi-page contract", (sys.executable, "demos/makoauto/tools/test_page_contract.py")),
    Gate("repository", "Python and JavaScript syntax", (sys.executable, "tools/check_syntax.py")),
)


def main() -> int:
    failures: list[str] = []
    with tempfile.TemporaryDirectory(prefix="qrost-check-all-") as cache:
        env = os.environ.copy()
        env["PYTHONPYCACHEPREFIX"] = cache
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        for gate in GATES:
            heading = f"{gate.group} / {gate.label}"
            print(f"\n[check_all] START {heading}", flush=True)
            try:
                completed = subprocess.run(gate.command, cwd=ROOT, env=env, check=False)
            except FileNotFoundError as exc:
                print(f"[check_all] FAIL  {heading}: missing executable {exc.filename}", file=sys.stderr)
                failures.append(heading)
                continue
            if completed.returncode:
                print(f"[check_all] FAIL  {heading} (exit {completed.returncode})", file=sys.stderr)
                failures.append(heading)
            else:
                print(f"[check_all] PASS  {heading}", flush=True)
    if failures:
        print(f"\n[check_all] FAILED {len(failures)}/{len(GATES)} gates:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1
    print(f"\n[check_all] OK {len(GATES)}/{len(GATES)} read-only gates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
