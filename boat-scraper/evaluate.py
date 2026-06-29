"""Vurdering av annonser med Claude vision (Anthropic API).

For hver annonse sendes tittel + beskrivelse + inntil N bilder til Claude, som
returnerer en strukturert vurdering (tving via tool-call / JSON-schema):
  - firetakt (ja/nei/ukjent), ratt, gasskontroll, center-konsoll
  - rattets sentrering i bredden (0-100)
Til slutt beregnes en rangeringsscore (0-100) ut fra konfigurerbare vekter.
"""
from __future__ import annotations

import base64
import io
from dataclasses import dataclass, field

import httpx

from config import Config
from finn import Listing

EVAL_TOOL = {
    "name": "rapporter_vurdering",
    "description": "Rapporter en strukturert vurdering av båtannonsen.",
    "input_schema": {
        "type": "object",
        "properties": {
            "firetakt": {
                "type": "string",
                "enum": ["ja", "nei", "ukjent"],
                "description": "Har båten firetaktsmotor? Vurder både tekst og bilder "
                "(merker som Yamaha F-serie, Honda, Suzuki DF, Mercury FourStroke er firetakt; "
                "'2-takt'/'totakt' eller blå røyk-omtale tyder på totakt).",
            },
            "firetakt_begrunnelse": {"type": "string"},
            "har_ratt": {
                "type": "boolean",
                "description": "Har båten ratt (styrehjul)? Synlig på bilder eller nevnt i tekst.",
            },
            "har_gasskontroll": {
                "type": "boolean",
                "description": "Har båten gass-/girkontroll (kontrollspak ved styreplass)?",
            },
            "ratt_gass_begrunnelse": {"type": "string"},
            "center_konsoll": {
                "type": "boolean",
                "description": "Er det center-konsoll (konsoll midt i båten slik at man kan "
                "gå på begge sider)?",
            },
            "ratt_sentrering_score": {
                "type": "integer",
                "minimum": 0,
                "maximum": 100,
                "description": "Hvor nær midten av båten (i bredden) er rattet/styreplassen "
                "plassert? 100 = helt sentrert (center-konsoll), 0 = helt ute ved skroksiden. "
                "Vurder fra bilder.",
            },
            "lengde_fot": {"type": ["number", "null"]},
            "pris": {"type": ["integer", "null"]},
            "oppsummering": {
                "type": "string",
                "description": "Kort oppsummering på norsk (1-3 setninger) om hvorfor båten "
                "passer eller ikke.",
            },
        },
        "required": [
            "firetakt",
            "har_ratt",
            "har_gasskontroll",
            "center_konsoll",
            "ratt_sentrering_score",
            "oppsummering",
        ],
    },
}


@dataclass
class Evaluation:
    firetakt: str = "ukjent"
    firetakt_begrunnelse: str = ""
    har_ratt: bool = False
    har_gasskontroll: bool = False
    ratt_gass_begrunnelse: str = ""
    center_konsoll: bool = False
    ratt_sentrering_score: int = 0
    lengde_fot: float | None = None
    pris: int | None = None
    oppsummering: str = ""
    score: float = 0.0
    error: str = ""


def _download_image(url: str, cfg: Config) -> tuple[str, str] | None:
    """Returner (media_type, base64-data) eller None ved feil. Nedskalerer ved behov."""
    try:
        resp = httpx.get(url, headers={"User-Agent": cfg.user_agent}, timeout=20, follow_redirects=True)
        resp.raise_for_status()
        data = resp.content
    except Exception:
        return None
    media_type = resp.headers.get("content-type", "image/jpeg").split(";")[0]
    try:
        from PIL import Image  # type: ignore

        img = Image.open(io.BytesIO(data))
        img = img.convert("RGB")
        img.thumbnail((1024, 1024))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82)
        data = buf.getvalue()
        media_type = "image/jpeg"
    except Exception:
        pass  # send originalen hvis Pillow mangler / feiler
    return media_type, base64.standard_b64encode(data).decode("ascii")


def compute_score(ev: Evaluation, cfg: Config) -> float:
    score = 0.0
    if ev.firetakt == "ja":
        score += cfg.weight_four_stroke
    elif ev.firetakt == "ukjent":
        score += cfg.weight_four_stroke * cfg.four_stroke_unknown_fraction
    if ev.center_konsoll:
        score += cfg.weight_center_console
    score += cfg.weight_wheel_centered * (ev.ratt_sentrering_score / 100.0)
    return round(score, 1)


def evaluate(listing: Listing, cfg: Config) -> Evaluation:
    from anthropic import Anthropic

    client = Anthropic(api_key=cfg.anthropic_api_key)

    content: list = []
    for url in listing.image_urls[: cfg.max_images]:
        got = _download_image(url, cfg)
        if got:
            media_type, b64 = got
            content.append(
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                }
            )

    prompt = (
        "Vurder denne båtannonsen fra Finn.no. Brukeren leter etter en "
        "skjærgårdsjeep (14-17 fot) og bryr seg om: firetaktsmotor (ønskelig), "
        "ratt OG gasskontroll (krav), center-konsoll (optimalt), og at rattet er "
        "mest mulig sentrert i bredden. Bruk både teksten og bildene.\n\n"
        f"TITTEL: {listing.title}\n"
        f"PRIS: {listing.price}\n"
        f"STED: {listing.location}\n\n"
        f"BESKRIVELSE:\n{listing.description or '(ingen tekst hentet)'}\n\n"
        "Kall verktøyet rapporter_vurdering med din vurdering."
    )
    content.append({"type": "text", "text": prompt})

    try:
        msg = client.messages.create(
            model=cfg.eval_model,
            max_tokens=1024,
            tools=[EVAL_TOOL],
            tool_choice={"type": "tool", "name": "rapporter_vurdering"},
            messages=[{"role": "user", "content": content}],
        )
    except Exception as exc:  # noqa: BLE001
        return Evaluation(error=f"API-feil: {exc}")

    payload = None
    for block in msg.content:
        if getattr(block, "type", None) == "tool_use":
            payload = block.input
            break
    if not payload:
        return Evaluation(error="Ingen strukturert respons fra modellen")

    ev = Evaluation(
        firetakt=payload.get("firetakt", "ukjent"),
        firetakt_begrunnelse=payload.get("firetakt_begrunnelse", ""),
        har_ratt=bool(payload.get("har_ratt", False)),
        har_gasskontroll=bool(payload.get("har_gasskontroll", False)),
        ratt_gass_begrunnelse=payload.get("ratt_gass_begrunnelse", ""),
        center_konsoll=bool(payload.get("center_konsoll", False)),
        ratt_sentrering_score=int(payload.get("ratt_sentrering_score", 0) or 0),
        lengde_fot=payload.get("lengde_fot"),
        pris=payload.get("pris"),
        oppsummering=payload.get("oppsummering", ""),
    )
    ev.score = compute_score(ev, cfg)
    return ev
