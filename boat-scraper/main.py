"""Orkestrator for Finn.no skjærgårdsjeep-varsler.

Flyt: scrape søk -> (diff mot seen ved e-post) -> hent detaljer -> vurder ->
hard-filtrer (ratt+gass, pris, lengde, avstand) -> ranger -> rapport (+ e-post).

Feature-toggles (env):
  ENABLE_VISION=1   bruk Claude vision (bilder). Standard: tekst-heuristikk.
  ENABLE_EMAIL=1    send e-post + varsle bare NYE (produksjon). Standard: bare rapport.

Kjør lokalt:
  python main.py            # bruker togglene i miljøet
  python main.py --dry-run  # tving rapportmodus (ingen e-post / ingen lagring)
"""
from __future__ import annotations

import argparse
import sys

from config import CONFIG
from evaluate import evaluate
from finn import FinnScraper, Listing
from report import REPORT_JSON, REPORT_MD, write_report
from state import load_seen, mark_seen, save_seen


def passes_hard_requirements(listing: Listing, evaluation, cfg, enforce_wheel: bool) -> tuple[bool, str]:
    # Ratt + gasskontroll er hard-krav – men kun pålitelig fra bilder (vision).
    if enforce_wheel and not (evaluation.har_ratt and evaluation.har_gasskontroll):
        return False, "mangler ratt og/eller gasskontroll"
    price = evaluation.pris or listing.price
    if price is not None and price > cfg.price_to:
        return False, f"pris {price} over {cfg.price_to}"
    length = evaluation.lengde_fot or listing.length_feet
    if length is not None and not (cfg.length_feet_from - 0.5 <= length <= cfg.length_feet_to + 0.5):
        return False, f"lengde {length} fot utenfor {cfg.length_feet_from}-{cfg.length_feet_to}"
    if listing.distance_km is not None and listing.distance_km > cfg.radius_km:
        return False, f"avstand {listing.distance_km} km over {cfg.radius_km} km"
    return True, ""


def run(dry_run: bool = False) -> int:
    cfg = CONFIG
    send_mail = cfg.enable_email and not dry_run
    mode = "Claude vision (bilder+tekst)" if cfg.enable_vision else "tekst-heuristikk"

    if cfg.enable_vision and not cfg.anthropic_api_key:
        print("FEIL: ENABLE_VISION=1 men ANTHROPIC_API_KEY mangler", file=sys.stderr)
        return 2
    if send_mail and not cfg.resend_api_key:
        print("FEIL: ENABLE_EMAIL=1 men RESEND_API_KEY mangler", file=sys.stderr)
        return 2

    seen = load_seen() if send_mail else {}
    print(f"Vurderingsmetode: {mode} | e-post: {'PÅ' if send_mail else 'AV (rapport)'}")
    print(f"Søker på Finn: {cfg.search_url(1)}")

    with FinnScraper(cfg) as scraper:
        listings = scraper.search()
        print(f"Fant {len(listings)} treff i søket.")

        # I rapportmodus vurderes alle treff; i e-postmodus bare nye.
        to_eval = [ls for ls in listings if ls.finnkode not in seen][: cfg.max_eval]
        print(f"Vurderer {len(to_eval)} annonser (tak {cfg.max_eval}).")

        matches: list[dict] = []
        for ls in to_eval:
            scraper.fetch_detail(ls)
            ev = evaluate(ls, cfg)
            if ev.error:
                print(f"  [{ls.finnkode}] vurdering feilet: {ev.error}")
                continue
            ok, reason = passes_hard_requirements(ls, ev, cfg, enforce_wheel=cfg.enable_vision)
            keep = ok and ev.score >= cfg.min_score
            print(
                f"  {'✓' if keep else '✗'} [{ls.finnkode}] score={ev.score:.0f} "
                f"4takt={ev.firetakt} center={ev.center_konsoll} dist={ls.distance_km} "
                f":: {(ls.title or '')[:50]}" + (f"  -> forkastet ({reason})" if not ok else "")
            )
            if keep:
                matches.append({"listing": ls, "evaluation": ev})

    matches.sort(key=lambda m: m["evaluation"].score, reverse=True)

    # Alltid skriv rapport (Markdown + JSON).
    md = write_report(matches, cfg, total_found=len(listings), mode=mode)
    print(f"\n===== RAPPORT ({len(matches)} aktuelle) =====\n")
    print(md)
    print(f"\nRapport skrevet: {REPORT_MD} og {REPORT_JSON}")

    if send_mail:
        from notify import send_email

        if matches:
            send_email(matches, cfg)
            for m in matches:
                mark_seen(seen, m["listing"].finnkode, m["evaluation"].score)
            save_seen(seen)
            print(f"E-post sendt til {cfg.recipient_email}; seen.json oppdatert.")
        else:
            print("Ingen nye aktuelle båter – ingen e-post sendt.")

    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Finn.no skjærgårdsjeep-varsler")
    ap.add_argument("--dry-run", action="store_true", help="Tving rapportmodus (ingen e-post/lagring)")
    args = ap.parse_args()
    sys.exit(run(dry_run=args.dry_run))
