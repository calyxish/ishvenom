"""Tests for the mobile benchmark parser and Phase 3 threshold enforcement."""
from __future__ import annotations

from ml.train.bench_mobile import (
    MAX_SIZE_GB,
    MIN_PP_TPS,
    MIN_TG_TPS,
    evaluate,
)

# Representative llama-bench JSON rows (simplified):
#   n_prompt > 0, n_gen == 0 → prompt-processing row
#   n_prompt == 0, n_gen > 0 → text-generation row
_BENCH_PASS = [
    {"n_prompt": 128, "n_gen": 0, "avg_ts": 15.4},
    {"n_prompt": 0, "n_gen": 128, "avg_ts": 6.2},
]
_BENCH_SLOW_TG = [
    {"n_prompt": 128, "n_gen": 0, "avg_ts": 15.4},
    {"n_prompt": 0, "n_gen": 128, "avg_ts": 2.1},
]
_BENCH_SLOW_BOTH = [
    {"n_prompt": 128, "n_gen": 0, "avg_ts": 4.0},
    {"n_prompt": 0, "n_gen": 128, "avg_ts": 1.0},
]


def test_passing_bench_passes() -> None:
    size = int(1.4 * 1024**3)  # 1.4 GB < limit
    result = evaluate(_BENCH_PASS, size)
    assert result.passed
    assert result.reasons == []
    assert result.pp_tps == 15.4
    assert result.tg_tps == 6.2


def test_slow_text_generation_fails() -> None:
    size = int(1.4 * 1024**3)
    result = evaluate(_BENCH_SLOW_TG, size)
    assert not result.passed
    assert any("tg_tps" in r for r in result.reasons)


def test_oversize_model_fails() -> None:
    size = int(2.0 * 1024**3)  # 2 GB > 1.6 GB
    result = evaluate(_BENCH_PASS, size)
    assert not result.passed
    assert any("size=" in r for r in result.reasons)


def test_everything_wrong_reports_all_failures() -> None:
    size = int(3.0 * 1024**3)
    result = evaluate(_BENCH_SLOW_BOTH, size)
    assert not result.passed
    assert len(result.reasons) == 3  # pp, tg, size


def test_thresholds_are_documented_constants() -> None:
    # Sanity: the acceptance thresholds used in `evaluate` should match
    # the public constants so they show up in the runbook.
    assert MIN_PP_TPS > 0
    assert MIN_TG_TPS > 0
    assert MAX_SIZE_GB > 0
