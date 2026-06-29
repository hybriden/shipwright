"""Vedvarende tilstand: hvilke annonser som allerede er varslet.

Lagres som JSON ved siden av koden slik at GitHub Actions kan committe filen
tilbake til repoet mellom kjøringer.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

SEEN_PATH = os.path.join(os.path.dirname(__file__), "seen.json")


def load_seen(path: str = SEEN_PATH) -> dict:
    """Returner map: finnkode -> {varslet, score}."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def mark_seen(seen: dict, finnkode: str, score: float) -> None:
    seen[str(finnkode)] = {
        "varslet": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "score": round(score, 1),
    }


def save_seen(seen: dict, path: str = SEEN_PATH) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(seen, fh, ensure_ascii=False, indent=2, sort_keys=True)
        fh.write("\n")
