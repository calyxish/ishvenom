"""CLI: verify the gold first-aid corpus for a given use case.

Exits non-zero if the corpus is unsafe for the requested use. Intended to be
called from CI before any fine-tuning job.

Usage:
    python -m ml.datasets.verify_gold --use-case fine_tuning
    python -m ml.datasets.verify_gold --use-case research_only
"""
from __future__ import annotations

import sys

import typer

from ml.datasets.gold_loader import GoldCorpusError, load_all, verify_for_use

app = typer.Typer(add_completion=False)


@app.command()
def main(
    use_case: str = typer.Option(
        "research_only",
        "--use-case",
        help="research_only | fine_tuning | production_release",
    ),
) -> None:
    try:
        corpus = load_all()
    except GoldCorpusError as e:
        typer.secho(f"❌ Failed to load gold corpus: {e}", fg=typer.colors.RED, err=True)
        sys.exit(2)

    try:
        verify_for_use(corpus, use_case)
    except GoldCorpusError as e:
        typer.secho(str(e), fg=typer.colors.RED, err=True)
        typer.secho(
            f"\n❌ Gold corpus is NOT safe for use_case={use_case!r}.",
            fg=typer.colors.RED,
            err=True,
        )
        sys.exit(1)

    typer.secho(
        f"✅ Gold corpus passes verification for use_case={use_case!r}",
        fg=typer.colors.GREEN,
    )
    for lang, gf in corpus.items():
        typer.echo(
            f"  {lang}: {len(gf.instructions)} instructions, "
            f"status={gf.verification_status.value}"
        )


if __name__ == "__main__":
    app()
