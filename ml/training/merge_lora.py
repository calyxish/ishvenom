"""Merge LoRA adapter into base Gemma 4 E2B weights. Phase 3."""
from __future__ import annotations

import typer

app = typer.Typer(add_completion=False)


@app.command()
def main() -> None:
    raise NotImplementedError("Phase 3")


if __name__ == "__main__":
    app()
