"""E-postvarsling via Resend API.

Bygger én HTML-e-post med alle nye, aktuelle båter rangert etter score (best
først) og sender til mottakeren i config. Returnerer True ved vellykket sending.
"""
from __future__ import annotations

import html

import httpx

from config import Config

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _badge(label: str, ok: bool | None) -> str:
    if ok is True:
        color, txt = "#1a7f37", "✓ " + label
    elif ok is False:
        color, txt = "#b35900", "✗ " + label
    else:
        color, txt = "#666", "? " + label
    return (
        f'<span style="display:inline-block;background:{color};color:#fff;'
        f'border-radius:4px;padding:2px 8px;margin:2px 4px 2px 0;font-size:12px">'
        f"{html.escape(txt)}</span>"
    )


def _boat_card(rank: int, item: dict) -> str:
    ls = item["listing"]
    ev = item["evaluation"]
    img = ls.image_urls[0] if ls.image_urls else ""
    four = {"ja": True, "nei": False}.get(ev.firetakt, None)
    price = f"{ls.price:,} kr".replace(",", " ") if ls.price else "Pris ukjent"
    dist = f"{ls.distance_km} km fra Larvik" if ls.distance_km is not None else "avstand ukjent"
    length = f"{ls.length_feet:g} fot" if ls.length_feet else ""
    img_html = (
        f'<img src="{html.escape(img)}" alt="" '
        f'style="width:200px;height:auto;border-radius:6px;float:right;margin-left:12px">'
        if img
        else ""
    )
    badges = (
        _badge("Firetakt", four)
        + _badge("Ratt", ev.har_ratt)
        + _badge("Gasskontroll", ev.har_gasskontroll)
        + _badge("Center-konsoll", ev.center_konsoll)
    )
    return f"""
    <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin:0 0 16px 0;overflow:hidden">
      {img_html}
      <div style="font-size:13px;color:#888">#{rank} · Score {ev.score:.0f}/100</div>
      <h3 style="margin:4px 0 6px 0">
        <a href="{html.escape(ls.url)}" style="color:#0063fb;text-decoration:none">
          {html.escape(ls.title or 'Båtannonse')}</a>
      </h3>
      <div style="font-size:14px;color:#333;margin-bottom:6px">
        <b>{html.escape(price)}</b> · {html.escape(length)} · {html.escape(dist)}
        · {html.escape(ls.location)}
      </div>
      <div style="margin:8px 0">{badges}</div>
      <div style="font-size:14px;color:#444;margin-top:6px">
        Rattsentrering: <b>{ev.ratt_sentrering_score}/100</b><br>
        {html.escape(ev.oppsummering)}
      </div>
      <div style="font-size:12px;color:#888;margin-top:6px">
        {html.escape(ev.firetakt_begrunnelse)}
      </div>
    </div>
    """


def build_html(items: list[dict], cfg: Config) -> str:
    cards = "".join(_boat_card(i + 1, it) for i, it in enumerate(items))
    return f"""
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:680px;margin:0 auto">
      <h2 style="color:#0063fb">🛥️ {len(items)} ny(e) aktuell(e) skjærgårdsjeep(er)</h2>
      <p style="color:#555;font-size:14px">
        14–17 fot · maks {cfg.price_to:,} kr · innen {cfg.radius_km:g} km fra {html.escape(cfg.origin_name)}.
        Rangert etter hvor godt de treffer ønskene dine (best først).
      </p>
      {cards}
      <p style="color:#999;font-size:12px;margin-top:24px">
        Automatisk varsel fra Finn-skjærgårdsjeep-scraperen.
      </p>
    </div>
    """.replace(",", " ")


def send_email(items: list[dict], cfg: Config) -> bool:
    if not items:
        return False
    if not cfg.resend_api_key:
        raise RuntimeError("RESEND_API_KEY mangler")

    subject = f"🛥️ {len(items)} ny(e) skjærgårdsjeep(er) på Finn (innen {cfg.radius_km:g} km fra {cfg.origin_name})"
    body = {
        "from": cfg.from_email,
        "to": [cfg.recipient_email],
        "subject": subject,
        "html": build_html(items, cfg),
    }
    resp = httpx.post(
        RESEND_ENDPOINT,
        headers={"Authorization": f"Bearer {cfg.resend_api_key}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    return True
