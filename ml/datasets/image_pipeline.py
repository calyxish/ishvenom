"""Image quality and dedup pipeline for the snake vision dataset.

Three stages:
  1. DEDUP        — perceptual hash (pHash) to drop near-duplicate photos
  2. QUALITY GATE — minimum resolution, blur detection via Laplacian variance
  3. WRITE        — write a clean manifest with per-image metadata

Usage:
    python -m ml.datasets.image_pipeline process \
        --in data/raw/inat \
        --out data/processed/images \
        --min-side 224 \
        --blur-threshold 100
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from pathlib import Path

import typer

app = typer.Typer(add_completion=False)


@dataclass
class ImageRecord:
    species: str
    path: str
    width: int
    height: int
    phash: str
    blur_score: float
    keep: bool
    reject_reason: str | None


def _phash(image_path: Path, hash_size: int = 16) -> str:
    """Perceptual hash via DCT. Requires Pillow + numpy."""
    try:
        from PIL import Image
        import numpy as np
    except ImportError as e:
        raise RuntimeError("Install Pillow and numpy: pip install pillow numpy") from e

    try:
        img = Image.open(image_path).convert("L").resize((hash_size * 4, hash_size * 4))
    except Exception:
        # Corrupt or unreadable — return a sentinel hash derived from the path
        return hashlib.sha256(image_path.name.encode()).hexdigest()[:32]

    pixels = np.asarray(img, dtype=np.float32)
    # Simple DCT via numpy (2D type-II)
    dct = np.fft.fft2(pixels).real[:hash_size, :hash_size]
    median = np.median(dct)
    bits = (dct > median).astype(np.uint8).flatten()
    # Pack into hex
    value = 0
    for b in bits:
        value = (value << 1) | int(b)
    return format(value, f"0{hash_size * hash_size // 4}x")


def _blur_score(image_path: Path) -> float:
    """Laplacian variance — higher is sharper. < 100 is usually blurry."""
    try:
        from PIL import Image
        import numpy as np
    except ImportError as e:
        raise RuntimeError("Install Pillow and numpy") from e

    try:
        img = Image.open(image_path).convert("L")
    except Exception:
        return 0.0

    arr = np.asarray(img, dtype=np.float32)
    # 3x3 Laplacian kernel
    kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    # Simple valid-mode convolution
    h, w = arr.shape
    if h < 3 or w < 3:
        return 0.0
    out = (
        arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:]
        - 4 * arr[1:-1, 1:-1]
    )
    return float(out.var())


def _image_size(image_path: Path) -> tuple[int, int] | None:
    try:
        from PIL import Image

        with Image.open(image_path) as img:
            return img.size
    except Exception:
        return None


def process_directory(
    in_dir: Path,
    out_manifest: Path,
    min_side: int = 224,
    blur_threshold: float = 100.0,
) -> list[ImageRecord]:
    """Scan in_dir recursively for images, dedupe, quality-filter, write manifest."""
    records: list[ImageRecord] = []
    seen_hashes: set[str] = set()

    exts = {".jpg", ".jpeg", ".png", ".webp"}
    for species_dir in sorted(p for p in in_dir.iterdir() if p.is_dir()):
        species = species_dir.name.replace("_", " ").title()
        for img_path in sorted(species_dir.iterdir()):
            if img_path.suffix.lower() not in exts:
                continue

            size = _image_size(img_path)
            if size is None:
                records.append(
                    ImageRecord(
                        species=species,
                        path=str(img_path),
                        width=0,
                        height=0,
                        phash="",
                        blur_score=0.0,
                        keep=False,
                        reject_reason="unreadable",
                    )
                )
                continue

            w, h = size
            if min(w, h) < min_side:
                records.append(
                    ImageRecord(
                        species=species,
                        path=str(img_path),
                        width=w,
                        height=h,
                        phash="",
                        blur_score=0.0,
                        keep=False,
                        reject_reason=f"resolution<{min_side}",
                    )
                )
                continue

            phash = _phash(img_path)
            if phash in seen_hashes:
                records.append(
                    ImageRecord(
                        species=species,
                        path=str(img_path),
                        width=w,
                        height=h,
                        phash=phash,
                        blur_score=0.0,
                        keep=False,
                        reject_reason="duplicate",
                    )
                )
                continue
            seen_hashes.add(phash)

            blur = _blur_score(img_path)
            if blur < blur_threshold:
                records.append(
                    ImageRecord(
                        species=species,
                        path=str(img_path),
                        width=w,
                        height=h,
                        phash=phash,
                        blur_score=blur,
                        keep=False,
                        reject_reason=f"blur<{blur_threshold}",
                    )
                )
                continue

            records.append(
                ImageRecord(
                    species=species,
                    path=str(img_path),
                    width=w,
                    height=h,
                    phash=phash,
                    blur_score=blur,
                    keep=True,
                    reject_reason=None,
                )
            )

    out_manifest.parent.mkdir(parents=True, exist_ok=True)
    with out_manifest.open("w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(asdict(r), ensure_ascii=False) + "\n")

    return records


@app.command(name="process")
def process(
    in_dir: Path = typer.Option(..., "--in", help="Input directory with species subdirs"),
    out_manifest: Path = typer.Option(Path("data/processed/manifest.jsonl"), "--out"),
    min_side: int = typer.Option(224),
    blur_threshold: float = typer.Option(100.0),
) -> None:
    records = process_directory(in_dir, out_manifest, min_side, blur_threshold)
    kept = sum(1 for r in records if r.keep)
    total = len(records)
    typer.echo(f"Processed {total} images, kept {kept} ({kept / max(total, 1):.1%})")

    from collections import Counter

    reasons = Counter(r.reject_reason for r in records if not r.keep)
    for reason, n in reasons.most_common():
        typer.echo(f"  rejected {n:5} — {reason}")


if __name__ == "__main__":
    app()
