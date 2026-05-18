"""Tests for iNaturalist fetcher — pure unit tests, no network calls."""
from __future__ import annotations

from ml.datasets.inaturalist_fetch import (
    PERMISSIVE_LICENSES,
    _parse_observation,
    _safe_filename,
    _species_slug,
)


def test_species_slug() -> None:
    assert _species_slug("Bitis arietans") == "bitis_arietans"
    assert _species_slug("Naja Haje") == "naja_haje"


def test_safe_filename_is_deterministic() -> None:
    url = "https://static.inaturalist.org/photos/12345/square.jpg"
    a = _safe_filename(url)
    b = _safe_filename(url)
    assert a == b
    assert a.endswith(".jpg")


def test_safe_filename_defaults_to_jpg() -> None:
    assert _safe_filename("https://example.com/photo?foo=bar").endswith(".jpg")


def test_parse_observation_rejects_restrictive_license() -> None:
    raw = {
        "id": 1,
        "license_code": "cc-by-nc",
        "photos": [{"url": "https://x/square.jpg"}],
        "user": {"login": "u"},
    }
    assert _parse_observation(raw, "Bitis arietans") is None


def test_parse_observation_rejects_no_photos() -> None:
    raw = {"id": 1, "license_code": "cc0", "photos": [], "user": {"login": "u"}}
    assert _parse_observation(raw, "Bitis arietans") is None


def test_parse_observation_accepts_permissive() -> None:
    raw = {
        "id": 42,
        "license_code": "cc-by",
        "photos": [{"url": "https://static.inaturalist.org/photos/42/square.jpg"}],
        "place_guess": "Accra, Ghana",
        "observed_on": "2024-01-15",
        "user": {"login": "calyxish"},
    }
    obs = _parse_observation(raw, "Bitis arietans")
    assert obs is not None
    assert obs.observation_id == 42
    assert obs.license == "cc-by"
    assert obs.user == "calyxish"
    # 'square' replaced with 'large'
    assert "large" in obs.photo_urls[0]
    assert "square" not in obs.photo_urls[0]


def test_all_permissive_licenses_recognized() -> None:
    assert "cc0" in PERMISSIVE_LICENSES
    assert "cc-by" in PERMISSIVE_LICENSES
    assert "cc-by-sa" in PERMISSIVE_LICENSES
    assert "pd" in PERMISSIVE_LICENSES
