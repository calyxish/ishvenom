"""Top-level CLI for the IshVenom ML pipeline.

Phase 2 (data) and Phase 3 (train) subcommands share one entry point:

    # ── Phase 2: data ──────────────────────────────────────────────
    python -m ml.cli data fetch-inat --species "Bitis arietans"
    python -m ml.cli data fetch-gbif all
    python -m ml.cli data process-images --in data/raw/inat
    python -m ml.cli data split
    python -m ml.cli data verify-gold --use-case fine_tuning
    python -m ml.cli data generate-corpus --target-size 5000
    python -m ml.cli data push-vision
    python -m ml.cli data push-text

    # ── Phase 3: train ─────────────────────────────────────────────
    python -m ml.cli train vision --config ml/train/configs/vision.yaml
    python -m ml.cli train export-vision --checkpoint runs/vision/best.pt
    python -m ml.cli train gemma --config ml/train/configs/gemma_lora.yaml
    python -m ml.cli train quantize --adapter runs/gemma_lora/final \\
        --llama-cpp /opt/llama.cpp --out runs/gguf
    python -m ml.cli train eval generate --gguf runs/gguf/*.Q4_K_M.gguf
    python -m ml.cli train eval grade --grader calyx
    python -m ml.cli train eval report
    python -m ml.cli train bench runbook
    python -m ml.cli train bench parse --raw bench_raw.json --size-bytes ...
    python -m ml.cli train push gemma --dir runs/gguf
    python -m ml.cli train push vision --dir runs/vision/export
"""
from __future__ import annotations

import typer

from ml.datasets import (
    gbif_fetch,
    image_pipeline,
    inaturalist_fetch,
    push_to_hub,
    split,
    synthetic_generator,
    verify_gold,
)
from ml.train import (
    bench_mobile,
    eval_gemma,
    gemma_lora,
    merge_quantize,
    push_models,
    vision_export,
    vision_train,
)

app = typer.Typer(add_completion=False, help="IshVenom ML pipeline")

# ── Phase 2: data ──────────────────────────────────────────────────
data = typer.Typer(help="Data pipelines (Phase 2)")
app.add_typer(data, name="data")

data.add_typer(inaturalist_fetch.app, name="fetch-inat")
data.add_typer(gbif_fetch.app, name="fetch-gbif")
data.add_typer(image_pipeline.app, name="process-images")
data.add_typer(split.app, name="split")
data.add_typer(verify_gold.app, name="verify-gold")
data.add_typer(synthetic_generator.app, name="generate-corpus")
data.add_typer(push_to_hub.app, name="push")

# ── Phase 3: train ─────────────────────────────────────────────────
train = typer.Typer(help="Training, quantization, eval (Phase 3)")
app.add_typer(train, name="train")

train.add_typer(vision_train.app, name="vision")
train.add_typer(vision_export.app, name="export-vision")
train.add_typer(gemma_lora.app, name="gemma")
train.add_typer(merge_quantize.app, name="quantize")
train.add_typer(eval_gemma.app, name="eval")
train.add_typer(bench_mobile.app, name="bench")
train.add_typer(push_models.app, name="push")


if __name__ == "__main__":
    app()
