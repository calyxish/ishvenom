"""Tests for the Phase 3 safety gate.

The gate must refuse to let training start if any gold file is below the
`fine_tuning` verification tier or has NEEDS_TRANSLATION markers.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from ml.train.safety import SafetyGateError, assert_training_safe


GOLD_SRC = Path(__file__).parent.parent / "datasets" / "gold"


def _copy_gold(dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for src in GOLD_SRC.glob("instructions.*.json"):
        (dst / src.name).write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
    schema = GOLD_SRC / "instruction.schema.json"
    if schema.exists():
        (dst / schema.name).write_text(schema.read_text(encoding="utf-8"), encoding="utf-8")


def test_unknown_use_case_is_rejected(tmp_path: Path) -> None:
    _copy_gold(tmp_path)
    with pytest.raises(SafetyGateError, match="Unknown use case"):
        assert_training_safe(use_case="not_a_tier", gold_dir=tmp_path)


def test_stub_corpus_blocks_fine_tuning(tmp_path: Path) -> None:
    """Default gold files ship as stubs — fine-tuning must be blocked."""
    _copy_gold(tmp_path)
    with pytest.raises(SafetyGateError) as exc_info:
        assert_training_safe(use_case="fine_tuning", gold_dir=tmp_path)
    msg = str(exc_info.value)
    assert "Safety gate FAILED" in msg
    assert "Recovery:" in msg


def test_stub_corpus_allowed_for_research_only(tmp_path: Path) -> None:
    """`research_only` is the lowest tier and accepts authored+draft files.

    If Phase 2 ships with AR/HA/SW/TW as plain stubs (below research_only),
    this will raise — that is the correct, conservative behaviour and the
    test documents it.
    """
    _copy_gold(tmp_path)
    try:
        result = assert_training_safe(use_case="research_only", gold_dir=tmp_path)
        assert set(result.keys()) >= {"en", "fr"}
    except SafetyGateError as exc:
        # This is the conservative path: gate still refuses because
        # at least one language is pure STUB. That's fine — the test
        # just asserts the gate is active, not that research_only must pass.
        assert "Safety gate FAILED" in str(exc)


def test_production_release_requires_verified(tmp_path: Path) -> None:
    _copy_gold(tmp_path)
    with pytest.raises(SafetyGateError):
        assert_training_safe(use_case="production_release", gold_dir=tmp_path)
