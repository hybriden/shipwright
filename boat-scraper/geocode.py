"""Enkel geokoding av norske postnnumre/steder -> koordinater.

Finn-detaljsider eksponerer ikke rå koordinater, men har postnummer + poststed.
Vi slår opp postnummer (eller stedsnavn) mot OpenStreetMap Nominatim for å få et
representativt punkt (postområdets senter) – presist nok for et 75 km radiusfilter.

Resultater caches i minne + en valgfri cache-fil for å unngå gjentatte oppslag.
Respekterer Nominatims bruksvilkår: maks ~1 forespørsel/sekund og egen User-Agent.
"""
from __future__ import annotations

import json
import os
import time

import httpx

_CACHE: dict[str, tuple[float, float] | None] = {}
_LAST_CALL = [0.0]
_MIN_INTERVAL = 1.1  # sekunder mellom Nominatim-kall
_CACHE_PATH = os.path.join(os.path.dirname(__file__), "geocache.json")
_UA = "shipwright-boat-scraper/1.0 (+https://github.com/hybriden/shipwright)"


def _load_cache() -> None:
    if _CACHE or not os.path.exists(_CACHE_PATH):
        return
    try:
        with open(_CACHE_PATH, "r", encoding="utf-8") as fh:
            for k, v in json.load(fh).items():
                _CACHE[k] = tuple(v) if v else None
    except (OSError, ValueError):
        pass


def _save_cache() -> None:
    try:
        with open(_CACHE_PATH, "w", encoding="utf-8") as fh:
            json.dump(_CACHE, fh, ensure_ascii=False)
    except OSError:
        pass


def _throttle() -> None:
    wait = _MIN_INTERVAL - (time.monotonic() - _LAST_CALL[0])
    if wait > 0:
        time.sleep(wait)


def _query(params: dict) -> tuple[float, float] | None:
    _throttle()
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={**params, "format": "json", "limit": 1, "country": "Norway"},
            headers={"User-Agent": _UA},
            timeout=20,
            follow_redirects=True,
        )
        _LAST_CALL[0] = time.monotonic()
        data = resp.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        _LAST_CALL[0] = time.monotonic()
    return None


def geocode(postal_code: str = "", place: str = "") -> tuple[float, float] | None:
    """Returner (lat, lon) for et postnummer (foretrukket) eller stedsnavn."""
    _load_cache()
    key = f"pc:{postal_code}" if postal_code else f"q:{place.lower()}"
    if not postal_code and not place:
        return None
    if key in _CACHE:
        return _CACHE[key]

    coords = None
    if postal_code:
        coords = _query({"postalcode": postal_code})
    if coords is None and place:
        coords = _query({"q": place})

    _CACHE[key] = coords
    _save_cache()
    return coords
