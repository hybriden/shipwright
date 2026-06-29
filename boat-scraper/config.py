"""Konfigurasjon for Finn.no skjærgårdsjeep-varsler.

Alle verdier kan overstyres med miljøvariabler, slik at GitHub Actions kan
injisere secrets/innstillinger uten kodeendringer.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw not in (None, "") else default


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    return float(raw) if raw not in (None, "") else default


def _env_str(name: str, default: str) -> str:
    raw = os.environ.get(name)
    return raw if raw not in (None, "") else default


@dataclass
class Config:
    # --- Søkekriterier (Finn) ---
    boat_class: int = _env_int("BOAT_CLASS", 3827)  # Skjærgårdsjeep og Landstedsbåt
    price_to: int = _env_int("PRICE_TO", 75000)
    length_feet_from: int = _env_int("LENGTH_FEET_FROM", 14)
    length_feet_to: int = _env_int("LENGTH_FEET_TO", 17)
    max_pages: int = _env_int("MAX_PAGES", 10)

    # --- Geografi: maks avstand fra Larvik ---
    origin_lat: float = _env_float("ORIGIN_LAT", 59.0537)   # Larvik
    origin_lon: float = _env_float("ORIGIN_LON", 10.0357)
    origin_name: str = _env_str("ORIGIN_NAME", "Larvik")
    radius_km: float = _env_float("RADIUS_KM", 75.0)

    # --- Feature-toggles ---
    # Slå PÅ for å bruke Claude vision (bilder+tekst). AV = rask tekst-heuristikk.
    enable_vision: bool = _env_str("ENABLE_VISION", "0") == "1"
    # Slå PÅ for å sende e-post + bare varsle NYE annonser (produksjon). AV = bare rapport.
    enable_email: bool = _env_str("ENABLE_EMAIL", "0") == "1"

    # --- Claude vision-vurdering ---
    eval_model: str = _env_str("EVAL_MODEL", "claude-sonnet-4-6")
    max_images: int = _env_int("MAX_IMAGES", 5)
    anthropic_api_key: str = _env_str("ANTHROPIC_API_KEY", "")
    # Maks antall annonser som hentes i detalj/vurderes per kjøring (sikkerhetstak).
    max_eval: int = _env_int("MAX_EVAL", 40)

    # --- Rangering / terskel ---
    # Båter med score under denne varsles ikke (demper støy). 0 = varsle alle som
    # oppfyller hard-kravene.
    min_score: float = _env_float("MIN_SCORE", 0.0)

    # Vekter for rangeringsscore (maks 100). Summen av positive vekter = 100.
    weight_four_stroke: float = _env_float("WEIGHT_FOUR_STROKE", 40.0)
    weight_center_console: float = _env_float("WEIGHT_CENTER_CONSOLE", 30.0)
    weight_wheel_centered: float = _env_float("WEIGHT_WHEEL_CENTERED", 30.0)
    # Delvis uttelling når firetakt er ukjent (andel av weight_four_stroke).
    four_stroke_unknown_fraction: float = _env_float("FOUR_STROKE_UNKNOWN_FRACTION", 0.4)

    # --- E-post (Resend) ---
    resend_api_key: str = _env_str("RESEND_API_KEY", "")
    recipient_email: str = _env_str("RECIPIENT_EMAIL", "eirik.blomacher@gmail.com")
    from_email: str = _env_str("FROM_EMAIL", "Finn-varsler <onboarding@resend.dev>")

    # --- Diverse ---
    request_delay_s: float = _env_float("REQUEST_DELAY_S", 1.5)
    headless: bool = _env_str("HEADLESS", "1") != "0"
    user_agent: str = _env_str(
        "USER_AGENT",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    )

    def search_url(self, page: int = 1) -> str:
        """Bygg Finn-søke-URL med alle filtre, sortert på nyeste først."""
        from urllib.parse import urlencode

        params = {
            "class": self.boat_class,
            "price_to": self.price_to,
            "length_feet_from": self.length_feet_from,
            "length_feet_to": self.length_feet_to,
            "sort": "PUBLISHED_DESC",
            # Geografisk filter rundt Larvik. radius i meter (Finn-konvensjon).
            "lat": self.origin_lat,
            "lon": self.origin_lon,
            "radius": int(self.radius_km * 1000),
        }
        if page > 1:
            params["page"] = page
        return "https://www.finn.no/mobility/search/boat?" + urlencode(params)


CONFIG = Config()
