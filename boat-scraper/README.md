# Finn.no skjærgårdsjeep-varsler

Liten app som regelmessig leter på [Finn.no](https://www.finn.no) etter
**skjærgårdsjeeper** og sender **e-post** når nye, aktuelle båter dukker opp –
rangert etter hvor godt de treffer ønskene dine.

## Kriterier

| Krav | Verdi | Type |
|------|-------|------|
| Båttype | Skjærgårdsjeep og Landstedsbåt (`class=3827`) | hardt |
| Lengde | 14–17 fot | hardt |
| Pris | maks 75 000 kr | hardt |
| Avstand | maks 75 km fra Larvik | hardt |
| Ratt **og** gasskontroll | må finnes | hardt |
| Firetaktsmotor | ønskelig | scoring |
| Center-konsoll | optimalt | scoring |
| Rattets sentrering i bredden | jo mer sentrert, jo bedre | scoring |

Hver ny annonse vurderes av **Claude vision** ut fra både annonsetekst og bilder.
Båter som oppfyller hard-kravene rangeres med en **score (0–100)**:

```
score = 40·(firetakt) + 30·(center-konsoll) + 30·(rattsentrering/100)
```

Vekter og terskel kan justeres i `config.py` eller via miljøvariabler.

## Filer

| Fil | Ansvar |
|-----|--------|
| `main.py` | Orkestrator (scrape → vurder → filtrer → ranger → e-post → lagre) |
| `finn.py` | Playwright-scraping av søk + detaljside, avstandsberegning |
| `evaluate.py` | Claude vision-vurdering (strukturert output) + scoring |
| `notify.py` | Bygger og sender HTML-e-post via Resend |
| `state.py` | `seen.json` – allerede varslede annonser |
| `config.py` | Konfigurasjon (env-overstyrbar) |

## Oppsett

```bash
cd boat-scraper
pip install -r requirements.txt
python -m playwright install --with-deps chromium
```

Sett miljøvariabler / secrets:

| Variabel | Beskrivelse |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API-nøkkel (Claude vision) |
| `RESEND_API_KEY` | [Resend](https://resend.com) API-nøkkel |
| `RECIPIENT_EMAIL` | Mottaker (standard: `eirik.blomacher@gmail.com`) |
| `FROM_EMAIL` | Verifisert avsender i Resend (standard: `onboarding@resend.dev`) |
| `EVAL_MODEL` | (valgfri) f.eks. `claude-opus-4-8` for grundigere vurdering |
| `MIN_SCORE` | (valgfri) minste score for varsling, demper støy |

## Kjøring

```bash
python main.py            # full kjøring: vurderer, sender e-post, lagrer seen.json
python main.py --dry-run  # tester scraping+vurdering uten e-post/lagring
```

## Automatisk kjøring (GitHub Actions)

Workflowen `.github/workflows/boat-scraper.yml` kjører hver 3. time, oppdaterer
`seen.json` og committer den tilbake. Legg `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
`RECIPIENT_EMAIL` (og evt. `FROM_EMAIL`) inn under **Settings → Secrets and
variables → Actions**. Kan også trigges manuelt via **Run workflow**.

> **Merk:** GitHub-runnere bruker datacenter-IP som Finn av og til blokkerer. Appen
> bruker realistiske headers + retries. Ved vedvarende blokkering kan du i stedet
> kjøre `python main.py` via cron på egen maskin (residential IP), eller legge på en
> proxy. Logikken er den samme uansett hvor den kjøres.

## Forbehold

Rattets eksakte sentrering i bredden er vanskelig å måle presist fra annonsefoto;
`ratt_sentrering_score` er en Claude-vurdert heuristikk (center-konsoll ≈ sentrert),
ikke en eksakt måling.
