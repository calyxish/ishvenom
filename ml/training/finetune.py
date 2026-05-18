"""Gemma 4 E2B LoRA fine-tuning on the IshVenom first-aid corpus.

Phase 3. This is a scaffold showing the canonical recipe from
.claude/skills/gemma4-finetuning.md. Do not run until Phase 2 produces
the corpus at data/processed/firstaid_corpus.jsonl.
"""
from __future__ import annotations

from pathlib import Path

import typer

app = typer.Typer(add_completion=False)


@app.command()
def main(
    corpus: Path = typer.Option(Path("data/processed/firstaid_corpus.jsonl")),
    output: Path = typer.Option(Path("checkpoints")),
    epochs: int = typer.Option(3),
    lr: float = typer.Option(2e-4),
    rank: int = typer.Option(16),
    alpha: int = typer.Option(32),
) -> None:
    """Fine-tune Gemma 4 E2B with LoRA. Phase 3 implements this."""
    typer.echo(f"[stub] Would fine-tune Gemma 4 E2B on {corpus} → {output}")
    typer.echo(f"[stub] epochs={epochs} lr={lr} LoRA rank={rank} alpha={alpha}")
    raise NotImplementedError("Phase 3")


if __name__ == "__main__":
    app()
