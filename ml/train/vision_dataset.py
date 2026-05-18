"""PyTorch Dataset for the snake image splits.

Wraps the JSONL rows produced by Phase 2's `ml.datasets.split` and applies
the Phase 2 augmentation transforms from `ml.datasets.augment`.
"""
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import torch
    from torch.utils.data import Dataset
else:
    try:
        from torch.utils.data import Dataset
    except Exception:  # pragma: no cover — allow import in test envs w/o torch
        Dataset = object  # type: ignore


class SnakeImageDataset(Dataset):  # type: ignore[misc]
    """Reads image paths from a split row list and returns (tensor, label)."""

    def __init__(
        self,
        rows: list[dict],
        class_to_idx: dict[str, int],
        image_size: int = 224,
        train: bool = True,
    ) -> None:
        from ml.datasets.augment import eval_transform, train_transform

        self.rows = rows
        self.class_to_idx = class_to_idx
        self.transform = (
            train_transform(image_size) if train else eval_transform(image_size)
        )

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, idx: int):
        import numpy as np  # type: ignore
        from PIL import Image  # type: ignore

        row = self.rows[idx]
        path = Path(row["path"])
        img = Image.open(path).convert("RGB")
        arr = np.array(img)
        out = self.transform(image=arr)
        tensor = out["image"]
        label = self.class_to_idx[row["species"]]
        return tensor, label
