"""Train the snake species vision classifier.

Phase 3 item: EfficientNet-Lite0 fine-tuned on the Phase 2 snake dataset,
target >= 85% top-3 accuracy across the 20 priority species.

Depends on Phase 2 outputs:
  - data/processed/splits/{train,val,test}.jsonl  (from ml.datasets.split)
  - ml/datasets/augment.py                         (shared transforms)
  - ml/datasets/species/priority_species.json      (class list)

Usage:
    python -m ml.cli train vision --config ml/train/configs/vision.yaml
"""
from __future__ import annotations

import sys
from types import ModuleType


class MockLzmaModule(ModuleType):
    LZMAFile: object = object
    LZMAError: type[Exception] = Exception

    def open(self, *args, **kwargs):
        return None


if "_lzma" not in sys.modules:
    mock_lzma = MockLzmaModule("_lzma")
    sys.modules["_lzma"] = mock_lzma
    sys.modules["lzma"] = mock_lzma

import json
from dataclasses import dataclass
from pathlib import Path

import typer
import yaml

app = typer.Typer(add_completion=False, help="Vision classifier training")


@dataclass(frozen=True)
class VisionConfig:
    backbone: str
    image_size: int
    batch_size: int
    epochs: int
    lr: float
    weight_decay: float
    label_smoothing: float
    num_workers: int
    seed: int
    splits_dir: Path
    species_json: Path
    out_dir: Path
    use_wandb: bool


def load_config(path: Path) -> VisionConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return VisionConfig(
        backbone=raw["backbone"],
        image_size=int(raw["image_size"]),
        batch_size=int(raw["batch_size"]),
        epochs=int(raw["epochs"]),
        lr=float(raw["lr"]),
        weight_decay=float(raw["weight_decay"]),
        label_smoothing=float(raw["label_smoothing"]),
        num_workers=int(raw["num_workers"]),
        seed=int(raw["seed"]),
        splits_dir=Path(raw["splits_dir"]),
        species_json=Path(raw["species_json"]),
        out_dir=Path(raw["out_dir"]),
        use_wandb=bool(raw.get("use_wandb", False)),
    )


def load_species(species_json: Path) -> list[str]:
    """Return the stable, sorted list of scientific names used as class labels."""
    data = json.loads(species_json.read_text(encoding="utf-8"))
    names = sorted(entry["scientific_name"] for entry in data["species"])
    return names


def load_split(splits_dir: Path, name: str) -> list[dict]:
    path = splits_dir / f"{name}.jsonl"
    if not path.exists():
        raise FileNotFoundError(
            f"Missing split file {path}. "
            "Run `python -m ml.cli data split` first (Phase 2 output)."
        )
    with path.open("r", encoding="utf-8") as f:
        return [json.loads(line) for line in f]


def compute_class_weights(
    rows: list[dict], class_to_idx: dict[str, int]
) -> list[float]:
    """Inverse-frequency weights per class for imbalanced training."""
    counts = [0] * len(class_to_idx)
    for r in rows:
        counts[class_to_idx[r["species"]]] += 1
    total = sum(counts)
    # Avoid division by zero; classes with 0 samples get weight 0.
    return [
        (total / (len(counts) * c)) if c > 0 else 0.0 for c in counts
    ]


def build_model(num_classes: int, backbone: str):
    """Lazy import of torch/timm so unit tests can import this module without them."""
    import timm  # type: ignore

    model = timm.create_model(
        backbone,
        pretrained=True,
        num_classes=num_classes,
    )
    return model


@app.command("run")
def run(
    config: Path = typer.Option(
        Path("ml/train/configs/vision.yaml"),
        "--config",
        "-c",
        help="Path to vision training config YAML",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Validate config + data availability without touching the GPU",
    ),
) -> None:
    cfg = load_config(config)
    species = load_species(cfg.species_json)
    class_to_idx = {name: i for i, name in enumerate(species)}

    train_rows = load_split(cfg.splits_dir, "train")
    val_rows = load_split(cfg.splits_dir, "val")
    test_rows = load_split(cfg.splits_dir, "test")

    typer.echo(
        f"Vision config: {cfg.backbone} | {len(species)} classes | "
        f"train={len(train_rows)} val={len(val_rows)} test={len(test_rows)}"
    )

    weights = compute_class_weights(train_rows, class_to_idx)
    typer.echo(
        f"Class weights: min={min(w for w in weights if w > 0):.3f} "
        f"max={max(weights):.3f}"
    )

    if dry_run:
        typer.echo("Dry run OK. Exiting before model build.")
        return

    # Heavy imports happen only on a real run.
    import torch  # type: ignore
    from torch.utils.data import DataLoader  # type: ignore

    from ml.train.vision_dataset import SnakeImageDataset

    torch.manual_seed(cfg.seed)

    train_ds = SnakeImageDataset(
        train_rows, class_to_idx, image_size=cfg.image_size, train=True
    )
    val_ds = SnakeImageDataset(
        val_rows, class_to_idx, image_size=cfg.image_size, train=False
    )

    train_loader = DataLoader(
        train_ds,
        batch_size=cfg.batch_size,
        shuffle=True,
        num_workers=cfg.num_workers,
        pin_memory=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=cfg.batch_size,
        shuffle=False,
        num_workers=cfg.num_workers,
        pin_memory=True,
    )

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(len(species), cfg.backbone).to(device)

    class_weights = torch.tensor(weights, dtype=torch.float32, device=device)
    criterion = torch.nn.CrossEntropyLoss(
        weight=class_weights, label_smoothing=cfg.label_smoothing
    )
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay
    )

    cfg.out_dir.mkdir(parents=True, exist_ok=True)
    best_top3 = 0.0

    for epoch in range(cfg.epochs):
        model.train()
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            logits = model(imgs)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

        model.eval()
        top1 = top3 = seen = 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(device), labels.to(device)
                logits = model(imgs)
                _, pred3 = logits.topk(3, dim=1)
                top1 += (pred3[:, 0] == labels).sum().item()
                top3 += (pred3 == labels.unsqueeze(1)).any(dim=1).sum().item()
                seen += labels.size(0)
        top1_acc = top1 / max(seen, 1)
        top3_acc = top3 / max(seen, 1)
        typer.echo(
            f"epoch {epoch + 1}/{cfg.epochs}  top1={top1_acc:.4f}  top3={top3_acc:.4f}"
        )

        if top3_acc > best_top3:
            best_top3 = top3_acc
            ckpt = cfg.out_dir / "best.pt"
            torch.save(
                {
                    "model": model.state_dict(),
                    "class_to_idx": class_to_idx,
                    "backbone": cfg.backbone,
                    "image_size": cfg.image_size,
                    "val_top3": top3_acc,
                },
                ckpt,
            )
            typer.echo(f"  ✓ new best top3={top3_acc:.4f} → {ckpt}")

    typer.echo(f"Training done. Best val top3={best_top3:.4f}")
    if best_top3 < 0.85:
        typer.echo(
            "WARNING: best top-3 below 0.85 target. Consider more data, "
            "stronger augmentation, or reducing the class set to species "
            "with sufficient samples."
        )


if __name__ == "__main__":
    app()
