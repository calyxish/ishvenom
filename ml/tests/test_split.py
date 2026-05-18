"""Tests for the stratified split."""
from __future__ import annotations

import pytest

from ml.datasets.split import stratified_split


def _fake_rows(counts: dict[str, int]) -> list[dict]:
    rows: list[dict] = []
    for species, n in counts.items():
        for i in range(n):
            rows.append({"species": species, "path": f"{species}_{i}.jpg"})
    return rows


def test_ratios_roughly_respected() -> None:
    # Per species: 100 items → train=70, val=15, test=15 (remainder)
    rows = _fake_rows({"A": 100, "B": 100, "C": 100})
    tr, va, te = stratified_split(rows, 0.7, 0.15, 0.15, seed=0)
    assert len(tr) == 210  # 70 × 3
    assert len(va) == 45   # 15 × 3
    assert len(te) == 45   # 15 × 3
    assert len(tr) + len(va) + len(te) == 300


def test_every_species_appears_in_every_split() -> None:
    rows = _fake_rows({"A": 50, "B": 50, "C": 50})
    tr, va, te = stratified_split(rows, 0.6, 0.2, 0.2, seed=42)
    for split_ in (tr, va, te):
        species_in_split = {r["species"] for r in split_}
        assert species_in_split == {"A", "B", "C"}


def test_deterministic_with_seed() -> None:
    rows = _fake_rows({"A": 40, "B": 60})
    a = stratified_split(rows, 0.7, 0.15, 0.15, seed=7)
    b = stratified_split(rows, 0.7, 0.15, 0.15, seed=7)
    assert a == b


def test_ratio_sum_must_be_one() -> None:
    rows = _fake_rows({"A": 10})
    with pytest.raises(ValueError):
        stratified_split(rows, 0.5, 0.3, 0.3, seed=0)
