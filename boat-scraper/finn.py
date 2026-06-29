"""Scraping av Finn.no skjærgårdsjeep-annonser via Playwright.

Strategi:
  1. Naviger til søke-URL (headless Chromium, realistiske headers/locale).
  2. Fang den interne søke-JSON-responsen (inneholder `docs`-array) via
     network-interception. Fall tilbake til DOM-parsing om nødvendig.
  3. For hver nye annonse: hent detaljsiden -> beskrivelsestekst + bilde-URLer.

Geografi: hver annonse får beregnet luftlinjeavstand fra Larvik (haversine) når
koordinater finnes, slik at vi kan håndheve maks-radius uavhengig av Finns filter.
"""
from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass, field

from config import Config


@dataclass
class Listing:
    finnkode: str
    title: str
    url: str
    price: int | None = None
    length_feet: float | None = None
    location: str = ""
    lat: float | None = None
    lon: float | None = None
    distance_km: float | None = None
    image_urls: list[str] = field(default_factory=list)
    description: str = ""


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _first(d: dict, *keys, default=None):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _to_int_price(val) -> int | None:
    if val is None:
        return None
    if isinstance(val, dict):  # Finn pakker ofte pris i {"amount": N, ...}
        val = _first(val, "amount", "total", "value")
    if isinstance(val, (int, float)):
        return int(val)
    m = re.search(r"\d[\d\s.]*", str(val))
    return int(re.sub(r"\D", "", m.group())) if m else None


def _extract_length_feet(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"(\d{1,2}(?:[.,]\d)?)\s*(?:fot|ft|')", text, re.IGNORECASE)
    return float(m.group(1).replace(",", ".")) if m else None


class FinnScraper:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._pw = None
        self._browser = None
        self._ctx = None

    def __enter__(self):
        from playwright.sync_api import sync_playwright

        self._pw = sync_playwright().start()
        import os as _os

        launch_kwargs = {"headless": self.cfg.headless}
        exe = _os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if exe:
            launch_kwargs["executable_path"] = exe

        # Respekter en utgående proxy hvis miljøet krever det (f.eks. sandbox).
        # I vanlig drift (GitHub Actions) er denne ikke satt og ignoreres.
        proxy = _os.environ.get("PLAYWRIGHT_PROXY") or _os.environ.get("HTTPS_PROXY")
        ctx_kwargs = {
            "user_agent": self.cfg.user_agent,
            "locale": "nb-NO",
            "timezone_id": "Europe/Oslo",
            "viewport": {"width": 1366, "height": 900},
        }
        if proxy:
            launch_kwargs["proxy"] = {"server": proxy}
            ctx_kwargs["ignore_https_errors"] = True  # proxy kan MITM-e TLS

        self._browser = self._pw.chromium.launch(**launch_kwargs)
        self._ctx = self._browser.new_context(**ctx_kwargs)
        return self

    def __exit__(self, *exc):
        for closer in (self._ctx, self._browser):
            try:
                closer and closer.close()
            except Exception:
                pass
        try:
            self._pw and self._pw.stop()
        except Exception:
            pass

    # ---- intern hjelp ----
    def _accept_consent(self, page) -> None:
        """Best-effort: klikk bort samtykke-dialog hvis den dukker opp."""
        labels = ["Godta alle", "Aksepter alle", "Godta", "Aksepter", "Accept all"]
        for frame in page.frames:
            for label in labels:
                try:
                    btn = frame.get_by_role("button", name=re.compile(label, re.I))
                    if btn.count() > 0:
                        btn.first.click(timeout=2000)
                        page.wait_for_timeout(500)
                        return
                except Exception:
                    continue

    def _parse_docs(self, docs: list) -> list[Listing]:
        out: list[Listing] = []
        for d in docs:
            if not isinstance(d, dict):
                continue
            finnkode = str(_first(d, "id", "ad_id", "adId", "finnkode", default="")).strip()
            if not finnkode or not finnkode.isdigit():
                continue
            url = _first(d, "canonical_url", "ad_link", "link", default="")
            if isinstance(url, dict):
                url = _first(url, "href", "url", default="")
            if url and not str(url).startswith("http"):
                url = "https://www.finn.no" + str(url)
            if not url:
                url = f"https://www.finn.no/mobility/item/{finnkode}"

            coords = _first(d, "coordinates", "coordinate", default={}) or {}
            lat = _first(coords, "lat", "latitude") if isinstance(coords, dict) else None
            lon = _first(coords, "lon", "lng", "longitude") if isinstance(coords, dict) else None

            listing = Listing(
                finnkode=finnkode,
                title=str(_first(d, "heading", "title", "name", default="")).strip(),
                url=str(url),
                price=_to_int_price(_first(d, "price", "price_total", "main_price")),
                location=str(_first(d, "location", "city", default="")).strip(),
                lat=float(lat) if lat is not None else None,
                lon=float(lon) if lon is not None else None,
            )
            img = _first(d, "image", "main_image", default={})
            if isinstance(img, dict):
                img = _first(img, "url", "uri", default="")
            if img:
                listing.image_urls = [str(img)]
            out.append(listing)
        return out

    def _harvest_docs_from_json(self, obj, found: list) -> None:
        """Rekursivt let etter en `docs`-liste i en JSON-struktur."""
        if isinstance(obj, dict):
            for key in ("docs", "results", "items", "ads"):
                v = obj.get(key)
                if isinstance(v, list) and v and isinstance(v[0], dict):
                    found.extend(v)
            for v in obj.values():
                self._harvest_docs_from_json(v, found)
        elif isinstance(obj, list):
            for v in obj:
                self._harvest_docs_from_json(v, found)

    # ---- offentlig API ----
    def search(self) -> list[Listing]:
        listings: dict[str, Listing] = {}
        page = self._ctx.new_page()
        captured: list = []

        def on_response(resp):
            try:
                ct = resp.headers.get("content-type", "")
                if "json" not in ct:
                    return
                if not re.search(r"search|result|api", resp.url):
                    return
                data = resp.json()
                docs: list = []
                self._harvest_docs_from_json(data, docs)
                if docs:
                    captured.extend(docs)
            except Exception:
                pass

        page.on("response", on_response)

        for pg in range(1, self.cfg.max_pages + 1):
            captured.clear()
            url = self.cfg.search_url(pg)
            try:
                page.goto(url, wait_until="networkidle", timeout=45000)
            except Exception:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if pg == 1:
                self._accept_consent(page)
                page.wait_for_timeout(1500)

            page_listings = self._parse_docs(captured)
            if not page_listings:
                # Fallback: DOM-parsing av annonsekort.
                page_listings = self._parse_dom(page)
            if not page_listings:
                break

            new_on_page = 0
            for ls in page_listings:
                if ls.finnkode not in listings:
                    listings[ls.finnkode] = ls
                    new_on_page += 1
            if new_on_page == 0:
                break
            time.sleep(self.cfg.request_delay_s)

        page.close()

        result = list(listings.values())
        self._annotate_distance(result)
        return result

    def _parse_dom(self, page) -> list[Listing]:
        out: list[Listing] = []
        try:
            anchors = page.eval_on_selector_all(
                "a[href*='/item/'], a[href*='finnkode=']",
                """els => els.map(a => ({
                    href: a.href,
                    text: a.innerText,
                }))""",
            )
        except Exception:
            return out
        seen = set()
        for a in anchors:
            href = a.get("href", "")
            m = re.search(r"(?:item/|finnkode=)(\d{6,})", href)
            if not m:
                continue
            code = m.group(1)
            if code in seen:
                continue
            seen.add(code)
            out.append(
                Listing(
                    finnkode=code,
                    title=(a.get("text") or "").strip().split("\n")[0],
                    url=href,
                )
            )
        return out

    def _annotate_distance(self, listings: list[Listing]) -> None:
        for ls in listings:
            if ls.lat is not None and ls.lon is not None:
                ls.distance_km = round(
                    haversine_km(self.cfg.origin_lat, self.cfg.origin_lon, ls.lat, ls.lon), 1
                )

    def fetch_detail(self, listing: Listing) -> Listing:
        page = self._ctx.new_page()
        try:
            try:
                page.goto(listing.url, wait_until="networkidle", timeout=45000)
            except Exception:
                page.goto(listing.url, wait_until="domcontentloaded", timeout=45000)
            self._accept_consent(page)
            page.wait_for_timeout(800)

            # Beskrivelse: meta + synlig tekst fra hovedinnhold.
            desc_parts: list[str] = []
            try:
                meta = page.get_attribute("meta[property='og:description']", "content")
                if meta:
                    desc_parts.append(meta.strip())
            except Exception:
                pass
            for sel in [
                "[data-testid='description']",
                "section:has(h2:text-matches('Beskrivelse','i'))",
                "div.import-decoration",
                "article",
            ]:
                try:
                    el = page.query_selector(sel)
                    if el:
                        txt = (el.inner_text() or "").strip()
                        if len(txt) > 40:
                            desc_parts.append(txt)
                            break
                except Exception:
                    continue
            listing.description = "\n\n".join(dict.fromkeys(desc_parts))[:6000]

            # Bilder fra finncdn (galleri). Dedupe og foretrekk store varianter.
            try:
                srcs = page.eval_on_selector_all(
                    "img",
                    "els => els.map(i => i.currentSrc || i.src).filter(Boolean)",
                )
            except Exception:
                srcs = []
            imgs: list[str] = []
            for s in srcs:
                if "finncdn.no" not in s and "finn.no" not in s:
                    continue
                base = re.sub(r"\?.*$", "", s)
                if base not in imgs:
                    imgs.append(base)
            if imgs:
                listing.image_urls = imgs[: self.cfg.max_images]

            # Hent lokasjon/koordinater hvis vi ikke har dem fra søket.
            if not listing.location:
                try:
                    loc = page.query_selector("[data-testid='object-address']")
                    if loc:
                        listing.location = (loc.inner_text() or "").strip()
                except Exception:
                    pass

            if listing.length_feet is None:
                listing.length_feet = _extract_length_feet(
                    listing.title + " " + listing.description
                )
        finally:
            page.close()
        return listing
