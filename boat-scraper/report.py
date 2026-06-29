"""Bygg en rapport (Markdown + JSON) over aktuelle båter med lenker.

Brukes når e-post er slått av (test-/rapportmodus), slik at man får en oversikt
med direkte lenker til annonsene som regnes som interessante.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from config import Config

REPORT_MD = os.path.join(os.path.dirname(__file__), "last-report.md")
REPORT_JSON = os.path.join(os.path.dirname(__file__), "last-report.json")


def _flag(val) -> str:
    if val is True:
        return "✅"
    if val is False:
        return "❌"
    return "❓"


def _four(firetakt: str) -> str:
    return {"ja": "✅", "nei": "❌"}.get(firetakt, "❓")


def build_markdown(matches: list[dict], cfg: Config, total_found: int, mode: str) -> str:
    ts = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    lines = [
        "# 🛥️ Skjærgårdsjeep-rapport",
        "",
        f"- **Tidspunkt:** {ts}",
        f"- **Søk:** 14–17 fot · maks {cfg.price_to:,} kr · innen {cfg.radius_km:g} km fra {cfg.origin_name}".replace(",", " "),
        f"- **Vurderingsmetode:** {mode}",
        f"- **Treff i søket:** {total_found}",
        f"- **Aktuelle (etter filtrering):** {len(matches)}",
        "",
    ]
    if not matches:
        lines += ["_Ingen aktuelle båter funnet i denne kjøringen._", ""]
        return "\n".join(lines)

    lines += [
        "Rangert etter hvor godt de treffer ønskene (best først). "
        "Kolonner: firetakt / ratt / gasskontroll / center-konsoll.",
        "",
        "| # | Score | Båt | Pris | Lengde | Avstand | 4-takt | Ratt | Gass | Center | Rattsentr. |",
        "|--:|------:|-----|-----:|:------:|--------:|:------:|:----:|:----:|:------:|----------:|",
    ]
    for i, m in enumerate(matches, 1):
        ls, ev = m["listing"], m["evaluation"]
        price = f"{ls.price:,} kr".replace(",", " ") if ls.price else "?"
        length = f"{ls.length_feet:g} fot" if ls.length_feet else "?"
        dist = f"{ls.distance_km:g} km" if ls.distance_km is not None else "?"
        title = (ls.title or "Båtannonse").replace("|", "/")
        lines.append(
            f"| {i} | {ev.score:.0f} | [{title}]({ls.url}) | {price} | {length} | {dist} | "
            f"{_four(ev.firetakt)} | {_flag(ev.har_ratt)} | {_flag(ev.har_gasskontroll)} | "
            f"{_flag(ev.center_konsoll)} | {ev.ratt_sentrering_score} |"
        )

    lines += ["", "## Detaljer", ""]
    for i, m in enumerate(matches, 1):
        ls, ev = m["listing"], m["evaluation"]
        lines += [
            f"### #{i} · {ls.title or 'Båtannonse'} — score {ev.score:.0f}/100",
            f"- Lenke: {ls.url}",
            f"- Sted: {ls.location or '?'} ({ls.distance_km if ls.distance_km is not None else '?'} km fra {cfg.origin_name})",
            f"- Firetakt: {ev.firetakt} — {ev.firetakt_begrunnelse}",
            f"- Ratt/gass: ratt={ev.har_ratt}, gasskontroll={ev.har_gasskontroll} — {ev.ratt_gass_begrunnelse}",
            f"- Center-konsoll: {ev.center_konsoll} · rattsentrering {ev.ratt_sentrering_score}/100",
            f"- Oppsummering: {ev.oppsummering}",
            "",
        ]
    return "\n".join(lines)


def build_json(matches: list[dict], cfg: Config, total_found: int, mode: str) -> dict:
    return {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "criteria": {
            "length_feet": [cfg.length_feet_from, cfg.length_feet_to],
            "price_to": cfg.price_to,
            "radius_km": cfg.radius_km,
            "origin": cfg.origin_name,
        },
        "total_found": total_found,
        "match_count": len(matches),
        "matches": [
            {
                "rank": i,
                "finnkode": m["listing"].finnkode,
                "title": m["listing"].title,
                "url": m["listing"].url,
                "price": m["listing"].price,
                "length_feet": m["listing"].length_feet,
                "distance_km": m["listing"].distance_km,
                "location": m["listing"].location,
                "score": m["evaluation"].score,
                "firetakt": m["evaluation"].firetakt,
                "har_ratt": m["evaluation"].har_ratt,
                "har_gasskontroll": m["evaluation"].har_gasskontroll,
                "center_konsoll": m["evaluation"].center_konsoll,
                "ratt_sentrering_score": m["evaluation"].ratt_sentrering_score,
                "oppsummering": m["evaluation"].oppsummering,
            }
            for i, m in enumerate(matches, 1)
        ],
    }


def write_report(matches: list[dict], cfg: Config, total_found: int, mode: str) -> str:
    md = build_markdown(matches, cfg, total_found, mode)
    with open(REPORT_MD, "w", encoding="utf-8") as fh:
        fh.write(md + "\n")
    with open(REPORT_JSON, "w", encoding="utf-8") as fh:
        json.dump(build_json(matches, cfg, total_found, mode), fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return md
