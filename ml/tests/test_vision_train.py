"""Tests for vision trainer pure-Python helpers.

Skips anything that needs torch/timm — the goal is to exercise config
parsing, class-weight math, and split loading without a GPU toolchain.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from ml.train.vision_train import (
    compute_class_weights,
    load_config,
    load_species,
    load_split,
)


def test_compute_class_weights_balanced_case() -> None:
    class_to_idx = {"a": 0, "b": 1}
    rows = [{"species": "a"}, {"species": "a"}, {"species": "b"}, {"species": "b"}]
    weights = compute_class_weights(rows, class_to_idx)
    assert pytest.approx(weights[0], rel=1e-6) == 1.0
    assert pytest.approx(weights[1], rel=1e-6) == 1.0


def test_compute_class_weights_imbalanced_case() -> None:
    class_to_idx = {"rare": 0, "common": 1}
    rows = [{"species": "common"}] * 9 + [{"species": "rare"}] * 1
    weights = compute_class_weights(rows, class_to_idx)
    # Rare class gets a much larger weight
    assert weights[0] > weights[1]
    # Sum formula: total / (num_classes * count)
    # rare:   10 / (2 * 1) = 5.0
    # common: 10 / (2 * 9) ≈ 0.5555
    assert pytest.approx(weights[0], rel=1e-6) == 5.0
    assert pytest.approx(weights[1], rel=1e-3) == 10 / (2 * 9)


def test_compute_class_weights_handles_empty_class() -> None:
    class_to_idx = {"a": 0, "b": 1, "c": 2}
    rows = [{"species": "a"}, {"species": "b"}]
    weights = compute_class_weights(rows, class_to_idx)
    assert weights[2] == 0.0
    assert weights[0] > 0 and weights[1] > 0


def test_load_species_sorts_stable(tmp_path: Path) -> None:
    species_json = tmp_path / "species.json"
    species_json.write_text(
        json.dumps(
            {
                "species": [
                    {"scientific_name": "Bitis arietans"},
                    {"scientific_name": "Naja haje"},
                    {"scientific_name": "Dendroaspis polylepis"},
                ]
            }
        ),
        encoding="utf-8",
    )
    names = load_species(species_json)
    assert names == [
        "Bitis arietans",
        "Dendroaspis polylepis",
        "Naja haje",
    ]


def test_load_split_missing_file_raises_helpful_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="Phase 2 output"):
        load_split(tmp_path, "train")


def test_load_split_reads_jsonl(tmp_path: Path) -> None:
    (tmp_path / "train.jsonl").write_text(
        '{"path": "a.jpg", "species": "Bitis arietans"}\n'
        '{"path": "b.jpg", "species": "Naja haje"}\n',
        encoding="utf-8",
    )
    rows = load_split(tmp_path, "train")
    assert len(rows) == 2
    assert rows[0]["species"] == "Bitis arietans"


def test_load_config_parses_yaml(tmp_path: Path) -> None:
    cfg_path = tmp_path / "vision.yaml"
    cfg_path.write_text(
        "backbone: efficientnet_lite0\n"
        "image_size: 224\n"
        "batch_size: 32\n"
        "epochs: 10\n"
        "lr: 0.001\n"
        "weight_decay: 0.01\n"
        "label_smoothing: 0.1\n"
        "num_workers: 2\n"
        "seed: 42\n"
        "splits_dir: data/splits\n"
        "species_json: species.json\n"
        "out_dir: runs/vision\n",
        encoding="utf-8",
    )
    cfg = load_config(cfg_path)
    assert cfg.backbone == "efficientnet_lite0"
    assert cfg.image_size == 224
    assert cfg.epochs == 10
    assert cfg.use_wandb is False  # default
