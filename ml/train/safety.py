"""Safety gate enforced before any Phase 3 training run.

Phase 2 established the principle: the pipeline enforces the rule, not the
human. This module is a thin wrapper around Phase 2's `verify_for_use` that
turns a failure into a clean, human-readable error with recovery instructions.

Usage from any Phase 3 trainer that fine-tunes on gold medical content:

    from ml.train.safety import assert_training_safe
    assert_training_safe(use_case="fine_tuning")

If any gold file is below the required tier for the use case (or still has
NEEDS_TRANSLATION markers), this raises `SafetyGateError` and the training
process exits non-zero before any GPU cycles are wasted.
"""
from __future__ import annotations

from pathlib import Path

from ml.datasets.gold_loader import (
    GOLD_DIR,
    SAFETY_TIERS,
    GoldCorpusError,
    GoldFile,
    load_all,
    verify_for_use,
)


class SafetyGateError(RuntimeError):
    """Raised when training is attempted on insufficiently verified content."""


def assert_training_safe(
    use_case: str = "fine_tuning",
    gold_dir: Path = GOLD_DIR,
) -> dict[str, GoldFile]:
    """Load every gold language file and verify it meets the `use_case` tier.

    Returns the loaded {language -> GoldFile} map on success. Raises
    SafetyGateError with a recovery hint on any failure.
    """
    if use_case not in SAFETY_TIERS:
        raise SafetyGateError(
            f"Unknown use case {use_case!r}. Known: {sorted(SAFETY_TIERS)}"
        )

    try:
        corpus = load_all(gold_dir=gold_dir)
    except GoldCorpusError as exc:
        raise SafetyGateError(
            f"Gold corpus failed to load: {exc}\n"
            "Fix the gold files under ml/datasets/gold/ and retry."
        ) from exc

    try:
        verify_for_use(corpus, use_case=use_case)
    except GoldCorpusError as exc:
        raise SafetyGateError(
            f"Safety gate FAILED for use_case={use_case!r}:\n{exc}\n\n"
            "Recovery:\n"
            "  1. Run `python -m ml.cli data verify-gold --use-case "
            f"{use_case}` for the full report.\n"
            "  2. Have native speakers fill in NEEDS_TRANSLATION markers.\n"
            "  3. Have a clinician sign off and bump verification_status.\n"
            "  4. Retry this training run."
        ) from exc

    return corpus


__all__ = ["SafetyGateError", "assert_training_safe"]
