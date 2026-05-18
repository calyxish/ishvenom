"""Tests for image pipeline. Uses tiny synthetic images to avoid PIL dependency
in CI if optional extras aren't installed."""
from __future__ import annotations

import pytest


def test_build_eval_transform_requires_training_extras() -> None:
    from ml.datasets.augment import build_eval_transform

    with pytest.raises(RuntimeError, match="training extras"):
        build_eval_transform()


def test_image_pipeline_import() -> None:
    from ml.datasets import image_pipeline

    assert hasattr(image_pipeline, "process_directory")
    assert hasattr(image_pipeline, "app")
