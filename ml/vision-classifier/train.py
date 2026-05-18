"""EfficientNet-Lite snake species classifier. Phase 3.

Target: top-3 accuracy ≥ 85% across 20 priority species, exported to TFLite INT8
under 20 MB for on-device inference on entry-level Android.
"""
from __future__ import annotations

import typer

app = typer.Typer(add_completion=False)


@app.command()
def main() -> None:
    raise NotImplementedError("Phase 3 — PyTorch + timm")


if __name__ == "__main__":
    app()
