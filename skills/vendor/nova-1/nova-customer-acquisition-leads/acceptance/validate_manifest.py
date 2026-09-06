#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Validate acceptance manifests for customer-acquisition-leads skill."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ACCEPTANCE = Path(__file__).resolve().parent
THEMES = [
    "beijing-ooh-procurement",
    "ai-software-outsourcing",
]

NOISE_LABELS = {"noise_irrelevant"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_manifest(manifest: dict, theme: str) -> list[str]:
    errors: list[str] = []
    leads = manifest.get("leads") or []
    if len(leads) < 5:
        errors.append(f"leads {len(leads)} < 5")
    if manifest.get("leads_count") != len(leads):
        errors.append("leads_count mismatch")
    qe = manifest.get("query_expansion") or {}
    alts = qe.get("alternate_queries") or []
    if len(alts) < 6:
        errors.append(f"alternate_queries {len(alts)} < 6")
    if not (manifest.get("keyword") or "").strip():
        errors.append("empty keyword")
    ds = manifest.get("data_sources") or []
    if not ds:
        errors.append("empty data_sources")
    for i, lead in enumerate(leads):
        if not (lead.get("source_url") or "").strip():
            errors.append(f"lead[{i}] missing source_url")
        if not (lead.get("description") or lead.get("title") or "").strip():
            errors.append(f"lead[{i}] missing description/title")
        if lead.get("intent_label") in NOISE_LABELS:
            errors.append(f"lead[{i}] noise_irrelevant in delivery")
        contact = (lead.get("contact_info") or "").strip()
        cands = lead.get("contact_candidates") or []
        if lead.get("track_level") == "High" and not contact and not cands:
            errors.append(f"lead[{i}] High without contact")
    return [f"{theme}: {e}" for e in errors]


def main() -> int:
    all_errors: list[str] = []
    for theme in THEMES:
        path = ACCEPTANCE / theme / "acquisition-manifest.json"
        if not path.is_file():
            all_errors.append(f"{theme}: missing manifest")
            continue
        manifest = load_json(path)
        all_errors.extend(validate_manifest(manifest, theme))
    if all_errors:
        for e in all_errors:
            print("FAIL", e)
        return 1
    print("OK", len(THEMES), "themes validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
