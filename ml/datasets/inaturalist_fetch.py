"""Fetch research-grade African snake observations from iNaturalist.

Phase 2 deliverable. For each species in priority_species.json, pulls
research-grade observations filtered to African countries, downloads photos
under permissive licenses (CC-BY, CC-BY-SA, CC0, public domain), and writes
a JSONL manifest plus a flat image directory per species.

Usage:
    python -m ml.datasets.inaturalist_fetch species --name "Bitis arietans"
    python -m ml.datasets.inaturalist_fetch all --out data/raw/inat

API docs: https://api.inaturalist.org/v1/docs/
Rate limit: ~60 req/min. This script stays well under with 1s sleeps.
"""
from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
import typer

API_BASE = "https://api.inaturalist.org/v1"

# Licenses permissive enough for a training dataset
PERMISSIVE_LICENSES: frozenset[str] = frozenset({"cc0", "cc-by", "cc-by-sa", "pd"})

SPECIES_FILE = Path(__file__).parent / "species" / "priority_species.json"

app = typer.Typer(add_completion=False, help="iNaturalist fetcher for African snake data")


@dataclass(frozen=True)
class Observation:
    observation_id: int
    species: str
    place_guess: str | None
    observed_on: str | None
    photo_urls: tuple[str, ...]
    license: str
    user: str


def _load_priority_species() -> list[str]:
    data = json.loads(SPECIES_FILE.read_text(encoding="utf-8"))
    return [s["scientific_name"] for s in data["species"]]


def _parse_observation(raw: dict[str, Any], species: str) -> Observation | None:
    license_code = (raw.get("license_code") or "").lower()
    if license_code not in PERMISSIVE_LICENSES:
        return None
    photos = raw.get("photos") or []
    urls: list[str] = []
    for p in photos:
        url = p.get("url")
        if not url:
            continue
        # iNaturalist returns a square thumbnail by default; swap for large
        urls.append(url.replace("square", "large"))
    if not urls:
        return None
    return Observation(
        observation_id=int(raw["id"]),
        species=species,
        place_guess=raw.get("place_guess"),
        observed_on=raw.get("observed_on"),
        photo_urls=tuple(urls),
        license=license_code,
        user=(raw.get("user") or {}).get("login") or "unknown",
    )


def fetch_species_observations(
    scientific_name: str,
    per_page: int = 100,
    max_pages: int = 10,
    session: requests.Session | None = None,
) -> list[Observation]:
    """Fetch research-grade observations for a species, filtered to permissive licenses."""
    sess = session or requests.Session()
    out: list[Observation] = []

    for page in range(1, max_pages + 1):
        params: dict[str, Any] = {
            "taxon_name": scientific_name,
            "quality_grade": "research",
            "has[]": "photos",
            "per_page": per_page,
            "page": page,
            "photo_license": ",".join(sorted(PERMISSIVE_LICENSES)),
            "iconic_taxa": "Reptilia",
        }
        r = sess.get(f"{API_BASE}/observations", params=params, timeout=30)
        r.raise_for_status()
        payload = r.json()
        results = payload.get("results", [])
        if not results:
            break
        for raw in results:
            parsed = _parse_observation(raw, scientific_name)
            if parsed is not None:
                out.append(parsed)
        if len(results) < per_page:
            break
        time.sleep(1.0)

    return out


def _safe_filename(url: str) -> str:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    ext = url.rsplit(".", 1)[-1].split("?")[0].lower()
    if ext not in {"jpg", "jpeg", "png", "webp"}:
        ext = "jpg"
    return f"{digest}.{ext}"


def download_photos(
    observations: list[Observation],
    out_dir: Path,
    session: requests.Session | None = None,
) -> int:
    sess = session or requests.Session()
    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for obs in observations:
        for url in obs.photo_urls:
            target = out_dir / _safe_filename(url)
            if target.exists():
                continue
            try:
                r = sess.get(url, timeout=30, stream=True)
                r.raise_for_status()
                with target.open("wb") as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                count += 1
                time.sleep(0.2)
            except requests.RequestException as e:
                typer.echo(f"⚠️  skipped {url}: {e}", err=True)
    return count


def _species_slug(scientific_name: str) -> str:
    return scientific_name.lower().replace(" ", "_")


@app.command(name="species")
def fetch_one(
    name: str = typer.Option(..., help="Scientific name, e.g. 'Bitis arietans'"),
    out: Path = typer.Option(Path("data/raw/inat"), help="Output root directory"),
    max_pages: int = typer.Option(10, help="Max API pages (100 obs each)"),
    download_images: bool = typer.Option(True, help="Also download photos"),
) -> None:
    """Fetch one species."""
    slug = _species_slug(name)
    out.mkdir(parents=True, exist_ok=True)

    typer.echo(f"📡 Fetching {name}...")
    obs = fetch_species_observations(name, max_pages=max_pages)
    typer.echo(f"   found {len(obs)} permissively-licensed observations")

    manifest = out / f"{slug}.jsonl"
    with manifest.open("w", encoding="utf-8") as f:
        for o in obs:
            f.write(
                json.dumps(
                    {
                        "observation_id": o.observation_id,
                        "species": o.species,
                        "place_guess": o.place_guess,
                        "observed_on": o.observed_on,
                        "photo_urls": list(o.photo_urls),
                        "license": o.license,
                        "user": o.user,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    typer.echo(f"   manifest → {manifest}")

    if download_images:
        img_dir = out / slug
        typer.echo(f"⬇️   downloading photos → {img_dir}")
        n = download_photos(obs, img_dir)
        typer.echo(f"   downloaded {n} new files")


@app.command(name="all")
def fetch_all(
    out: Path = typer.Option(Path("data/raw/inat")),
    max_pages: int = typer.Option(10),
    download_images: bool = typer.Option(True),
) -> None:
    """Fetch all 20 priority species."""
    species_list = _load_priority_species()
    typer.echo(f"Fetching {len(species_list)} priority species...")
    for name in species_list:
        fetch_one(name=name, out=out, max_pages=max_pages, download_images=download_images)
        time.sleep(2.0)


if __name__ == "__main__":
    app()
