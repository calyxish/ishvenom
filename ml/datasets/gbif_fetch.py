"""Fetch snake occurrence records from GBIF as a secondary source.

GBIF provides broader taxonomic coverage with license-tagged media.
This complements iNaturalist by including museum and research-institution records.

Usage:
    python -m ml.datasets.gbif_fetch species --name "Bitis arietans"
    python -m ml.datasets.gbif_fetch all

API docs: https://www.gbif.org/developer/occurrence
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
import typer

API_BASE = "https://api.gbif.org/v1"
SPECIES_FILE = Path(__file__).parent / "species" / "priority_species.json"

PERMISSIVE_GBIF_LICENSES: frozenset[str] = frozenset(
    {"CC0_1_0", "CC_BY_4_0", "CC_BY_SA_4_0"}
)

# GBIF country codes use ISO 3166-1 alpha-2 (same as iNat)
AFRICAN_ISO: tuple[str, ...] = (
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CG",
    "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN",
    "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ",
    "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD",
    "TZ", "TG", "TN", "UG", "EH", "ZM", "ZW",
)

app = typer.Typer(add_completion=False, help="GBIF fetcher for African snake data")


@dataclass(frozen=True)
class Occurrence:
    gbif_id: int
    species: str
    country: str | None
    decimal_latitude: float | None
    decimal_longitude: float | None
    event_date: str | None
    license: str
    media_urls: tuple[str, ...]


def _load_priority_species() -> list[str]:
    data = json.loads(SPECIES_FILE.read_text(encoding="utf-8"))
    return [s["scientific_name"] for s in data["species"]]


def _species_slug(name: str) -> str:
    return name.lower().replace(" ", "_")


def _lookup_taxon_key(scientific_name: str, session: requests.Session) -> int | None:
    r = session.get(
        f"{API_BASE}/species/match",
        params={"name": scientific_name},
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()
    key = data.get("usageKey")
    return int(key) if key else None


def _parse_occurrence(raw: dict[str, Any], species: str) -> Occurrence | None:
    license_str = (raw.get("license") or "").upper().replace("HTTP://CREATIVECOMMONS.ORG/", "")
    # Normalize variants
    for permissive in PERMISSIVE_GBIF_LICENSES:
        if permissive.replace("_", "").lower() in license_str.replace("_", "").replace("/", "").lower():
            license_str = permissive
            break
    else:
        return None

    country = raw.get("countryCode")
    if country and country not in AFRICAN_ISO:
        return None

    media_urls: list[str] = []
    for m in raw.get("media") or []:
        if m.get("type") == "StillImage":
            url = m.get("identifier")
            if url:
                media_urls.append(url)

    return Occurrence(
        gbif_id=int(raw["key"]),
        species=species,
        country=country,
        decimal_latitude=raw.get("decimalLatitude"),
        decimal_longitude=raw.get("decimalLongitude"),
        event_date=raw.get("eventDate"),
        license=license_str,
        media_urls=tuple(media_urls),
    )


def fetch_species_occurrences(
    scientific_name: str,
    limit_per_page: int = 100,
    max_pages: int = 10,
    session: requests.Session | None = None,
) -> list[Occurrence]:
    sess = session or requests.Session()
    taxon_key = _lookup_taxon_key(scientific_name, sess)
    if taxon_key is None:
        typer.echo(f"⚠️  GBIF could not resolve {scientific_name}", err=True)
        return []

    out: list[Occurrence] = []
    for page in range(max_pages):
        params: dict[str, Any] = {
            "taxonKey": taxon_key,
            "continent": "AFRICA",
            "mediaType": "StillImage",
            "limit": limit_per_page,
            "offset": page * limit_per_page,
        }
        r = sess.get(f"{API_BASE}/occurrence/search", params=params, timeout=30)
        r.raise_for_status()
        payload = r.json()
        results = payload.get("results", [])
        if not results:
            break
        for raw in results:
            parsed = _parse_occurrence(raw, scientific_name)
            if parsed is not None:
                out.append(parsed)
        if payload.get("endOfRecords"):
            break
        time.sleep(1.0)

    return out


@app.command(name="species")
def fetch_one(
    name: str = typer.Option(...),
    out: Path = typer.Option(Path("data/raw/gbif")),
    max_pages: int = typer.Option(10),
) -> None:
    """Fetch one species from GBIF."""
    out.mkdir(parents=True, exist_ok=True)
    typer.echo(f"📡 GBIF: {name}")
    occs = fetch_species_occurrences(name, max_pages=max_pages)
    typer.echo(f"   {len(occs)} permissively-licensed occurrences")
    manifest = out / f"{_species_slug(name)}.jsonl"
    with manifest.open("w", encoding="utf-8") as f:
        for o in occs:
            f.write(
                json.dumps(
                    {
                        "gbif_id": o.gbif_id,
                        "species": o.species,
                        "country": o.country,
                        "decimal_latitude": o.decimal_latitude,
                        "decimal_longitude": o.decimal_longitude,
                        "event_date": o.event_date,
                        "license": o.license,
                        "media_urls": list(o.media_urls),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    typer.echo(f"   → {manifest}")


@app.command(name="all")
def fetch_all(
    out: Path = typer.Option(Path("data/raw/gbif")),
    max_pages: int = typer.Option(10),
) -> None:
    for name in _load_priority_species():
        fetch_one(name=name, out=out, max_pages=max_pages)
        time.sleep(2.0)


if __name__ == "__main__":
    app()
