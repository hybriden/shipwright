"""Orkestrator for Finn.no skjærgårdsjeep-varsler.

Flyt: scrape søk -> finn nye annonser (ikke i seen.json) -> hent detaljer ->
vurder med Claude vision -> hard-filtrer (ratt+gass, pris, lengde, avstand) ->
ranger etter score -> send e-post -> oppdater seen.json.

Kjør lokalt:  python main.py            (full kjøring, sender e-post)
              python main.py --dry-run  (ingen e-post, ingen lagring; printer treff)
"""
from __future__ import annotations

import argparse
import sys

from config import CONFIG
from evaluate import evaluate
from finn import FinnScraper, Listing
from notify import send_email
from state import load_seen, mark_seen, save_seen


def passes_hard_requirements(listing: Listing, evaluation, cfg) -> tuple[bool, str]:
    if not (evaluation.har_ratt and evaluation.har_gasskontroll):
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
    if not cfg.anthropic_api_key:
        print("FEIL: ANTHROPIC_API_KEY mangler", file=sys.stderr)
        return 2

    seen = load_seen()
    print(f"Søker på Finn ({cfg.search_url(1)})")

    with FinnScraper(cfg) as scraper:
        listings = scraper.search()
        print(f"Fant {len(listings)} treff i søket.")

        new_listings = [ls for ls in listings if ls.finnkode not in seen]
        print(f"{len(new_listings)} er nye (ikke varslet før).")

        matches: list[dict] = []
        for ls in new_listings:
            scraper.fetch_detail(ls)
            ev = evaluate(ls, cfg)
            if ev.error:
                print(f"  [{ls.finnkode}] vurdering feilet: {ev.error}")
                continue
            ok, reason = passes_hard_requirements(ls, ev, cfg)
            tag = "✓" if (ok and ev.score >= cfg.min_score) else "✗"
            print(
                f"  {tag} [{ls.finnkode}] score={ev.score:.0f} "
                f"firetakt={ev.firetakt} ratt={ev.har_ratt} gass={ev.har_gasskontroll} "
                f"center={ev.center_konsoll} dist={ls.distance_km} :: {ls.title[:50]}"
                + (f"  -> forkastet ({reason})" if not ok else "")
            )
            if ok and ev.score >= cfg.min_score:
                matches.append({"listing": ls, "evaluation": ev})

    # Ranger best-match først.
    matches.sort(key=lambda m: m["evaluation"].score, reverse=True)
    print(f"\n{len(matches)} aktuelle båter etter filtrering.")

    if dry_run:
        for i, m in enumerate(matches, 1):
            print(f"  #{i} score={m['evaluation'].score:.0f} {m['listing'].url}")
        print("(dry-run: sender ingen e-post, lagrer ikke seen.json)")
        return 0

    if matches:
        send_email(matches, cfg)
        print(f"E-post sendt til {cfg.recipient_email}.")
        for m in matches:
            mark_seen(seen, m["listing"].finnkode, m["evaluation"].score)
        save_seen(seen)
        print("seen.json oppdatert.")
    else:
        print("Ingen nye aktuelle båter – ingen e-post sendt.")

    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Finn.no skjærgårdsjeep-varsler")
    ap.add_argument("--dry-run", action="store_true", help="Ikke send e-post / ikke lagre")
    args = ap.parse_args()
    sys.exit(run(dry_run=args.dry_run))
