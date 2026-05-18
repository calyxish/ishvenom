"""Stratified train/val/test split for the vision dataset.

Reads a clean manifest (from image_pipeline.py) and produces three JSONL files
where each species is proportionally represented. Target ratio: 70/15/15.

Usage:
    python -m ml.datasets.split run \
        --manifest data/processed/manifest.jsonl \
        --out data/processed/splits \
        --train 0.7 --val 0.15 --test 0.15 --seed 42
"""
from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path

import typer

app = typer.Typer(add_completion=False)


def load_kept(manifest: Path) -> list[dict]:
    rows: list[dict] = []
    with manifest.open("r", encoding="utf-8") as f:
        for line in f:
            rec = json.loads(line)
            if rec.get("keep"):
                rows.append(rec)
    return rows


def stratified_split(
    rows: list[dict],
    train: float,
    val: float,
    test: float,
    seed: int,
) -> tuple[list[dict], list[dict], list[dict]]:
    if not abs(train + val + test - 1.0) < 1e-9:
        raise ValueError("train + val + test must sum to 1.0")

    rng = random.Random(seed)
    by_species: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_species[r["species"]].append(r)

    train_out: list[dict] = []
    val_out: list[dict] = []
    test_out: list[dict] = []

    for species, items in by_species.items():
        rng.shuffle(items)
        n = len(items)
        n_train = int(n * train)
        n_val = int(n * val)
        train_out.extend(items[:n_train])
        val_out.extend(items[n_train : n_train + n_val])
        test_out.extend(items[n_train + n_val :])

    return train_out, val_out, test_out


def _write_split(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


@app.command(name="run")
def run(
    manifest: Path = typer.Option(Path("data/processed/manifest.jsonl")),
    out: Path = typer.Option(Path("data/processed/splits")),
    train: float = typer.Option(0.70),
    val: float = typer.Option(0.15),
    test: float = typer.Option(0.15),
    seed: int = typer.Option(42),
) -> None:
    rows = load_kept(manifest)
    typer.echo(f"Loaded {len(rows)} kept rows")
    tr, va, te = stratified_split(rows, train, val, test, seed)
    _write_split(tr, out / "train.jsonl")
    _write_split(va, out / "val.jsonl")
    _write_split(te, out / "test.jsonl")
    typer.echo(f"  train: {len(tr)}")
    typer.echo(f"  val:   {len(va)}")
    typer.echo(f"  test:  {len(te)}")


if __name__ == "__main__":
    app()
