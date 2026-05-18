"""Tests for the synthetic first-aid generator.

The critical property: the generator MUST refuse to emit training data when
the gold corpus is not ready for fine-tuning.
"""
from __future__ import annotations

import pytest

from ml.datasets.gold_loader import GoldCorpusError
from ml.datasets.synthetic_generator import generate_examples


def test_refuses_to_generate_from_stubs() -> None:
    """With the Phase 2 corpus (4 stub languages), generation must refuse."""
    with pytest.raises(GoldCorpusError) as excinfo:
        generate_examples(target_size=10, seed=0, use_corpus_grounding=False)
    assert "fine_tuning" in str(excinfo.value)
    assert "NEEDS_TRANSLATION" in str(excinfo.value) or "unfilled" in str(excinfo.value)
