"""Tests for gold corpus loader and safety gates."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from ml.datasets.gold_loader import (
    GoldCorpusError,
    VerificationStatus,
    load_all,
    load_gold_file,
    verify_for_use,
    REQUIRED_INSTRUCTION_COUNT,
    NEEDS_TRANSLATION_MARKER,
)

GOLD = Path(__file__).parent.parent / "datasets" / "gold"


def test_loads_all_six_languages() -> None:
    corpus = load_all()
    assert set(corpus.keys()) == {"en", "fr", "ar", "ha", "sw", "tw"}


def test_english_is_fully_authored() -> None:
    gf = load_gold_file(GOLD / "instructions.en.json")
    assert len(gf.instructions) == REQUIRED_INSTRUCTION_COUNT
    assert gf.is_fully_translated
    assert gf.verification_status == VerificationStatus.AUTHORED


def test_french_is_draft() -> None:
    gf = load_gold_file(GOLD / "instructions.fr.json")
    assert gf.is_fully_translated
    assert gf.verification_status == VerificationStatus.DRAFT


@pytest.mark.parametrize("lang", ["ar", "ha", "sw", "tw"])
def test_unverified_languages_are_stubs(lang: str) -> None:
    gf = load_gold_file(GOLD / f"instructions.{lang}.json")
    assert gf.verification_status == VerificationStatus.STUB
    assert gf.unfilled_count == REQUIRED_INSTRUCTION_COUNT
    assert not gf.is_fully_translated


def test_verify_blocks_fine_tuning_on_stubs() -> None:
    corpus = load_all()
    with pytest.raises(GoldCorpusError) as excinfo:
        verify_for_use(corpus, "fine_tuning")
    # The error must mention every stub language
    msg = str(excinfo.value)
    for lang in ("ar", "ha", "sw", "tw"):
        assert lang in msg


def test_verify_blocks_production_on_draft_french() -> None:
    corpus = load_all()
    with pytest.raises(GoldCorpusError):
        verify_for_use(corpus, "production_release")


def test_verify_allows_research_on_english_and_french(tmp_path: Path) -> None:
    """English and French alone should pass research_only."""
    en_raw = (GOLD / "instructions.en.json").read_text(encoding="utf-8")
    fr_raw = (GOLD / "instructions.fr.json").read_text(encoding="utf-8")

    research_corpus = {
        "en": load_gold_file(GOLD / "instructions.en.json"),
        "fr": load_gold_file(GOLD / "instructions.fr.json"),
    }
    # Should not raise
    verify_for_use(research_corpus, "research_only")


def test_invalid_use_case_raises() -> None:
    with pytest.raises(ValueError):
        verify_for_use({}, "nonsense_tier")
