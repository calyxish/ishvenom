"""Build the multilingual first-aid instruction corpus.

Strategy:
  1. Use the hand-authored gold instructions (en + fr for V1; ar/ha/sw/tw once translated).
  2. Generate 5 000 synthetic training examples via synthetic_generator.py.
  3. Write JSONL ready for Gemma 4 SFT: {instruction, input, output, language, species,
     category, severity}.

The output path (`data/processed/corpus/firstaid_sft.jsonl`) matches the `corpus_path`
field in ml/train/configs/gemma_lora.yaml so the training script picks it up unchanged.

Usage:
    # Dry run — prints stats and first 3 examples, no disk write
    python -m ml.datasets.build_firstaid_corpus --languages en,fr --dry-run

    # Full run
    python -m ml.datasets.build_firstaid_corpus --languages en,fr --target-size 5000
"""
from __future__ import annotations

import json
from pathlib import Path

import typer

from ml.datasets.gold_loader import GoldCorpusError
from ml.datasets.synthetic_generator import generate_examples

DEFAULT_OUT = Path("data/processed/corpus/firstaid_sft.jsonl")

app = typer.Typer(add_completion=False)


@app.command()
def main(
    languages: str = typer.Option(
        "en,fr",
        help="Comma-separated language codes. Default 'en,fr' (ar/ha/sw/tw are stubs).",
    ),
    target_size: int = typer.Option(5000, help="Number of training examples to generate."),
    seed: int = typer.Option(42, help="Random seed for reproducibility."),
    out: Path = typer.Option(DEFAULT_OUT, help="Output JSONL path."),
    dry_run: bool = typer.Option(
        False, "--dry-run", help="Print stats and sample rows — do not write to disk."
    ),
    ground: bool = typer.Option(
        True,
        "--ground/--no-ground",
        help="Apply corpus-grounding openers (EpiCast trick). Default on.",
    ),
) -> None:
    lang_list = [lg.strip() for lg in languages.split(",") if lg.strip()]
    if not lang_list:
        typer.secho("--languages must not be empty.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    typer.secho(
        f"Building corpus: {target_size} examples | languages={lang_list} | seed={seed}",
        fg=typer.colors.CYAN,
    )

    try:
        examples = generate_examples(
            target_size=target_size,
            seed=seed,
            use_corpus_grounding=ground,
            languages=lang_list,
        )
    except GoldCorpusError as e:
        typer.secho(str(e), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    # ── Stats ────────────────────────────────────────────────────────────────
    by_lang: dict[str, int] = {}
    by_cat: dict[str, int] = {}
    for ex in examples:
        by_lang[ex.language] = by_lang.get(ex.language, 0) + 1
        by_cat[ex.category] = by_cat.get(ex.category, 0) + 1

    typer.secho(f"\n📊 {len(examples)} examples generated", fg=typer.colors.GREEN)
    for lang, count in sorted(by_lang.items()):
        typer.echo(f"   {lang}: {count}")
    typer.echo("   Categories: " + ", ".join(f"{k}={v}" for k, v in sorted(by_cat.items())))

    if dry_run:
        typer.secho("\n--- First 3 examples (dry run) ---", fg=typer.colors.YELLOW)
        for ex in examples[:3]:
            typer.echo(json.dumps({
                "instruction": ex.instruction,
                "output": ex.output[:120] + ("…" if len(ex.output) > 120 else ""),
                "language": ex.language,
                "category": ex.category,
            }, ensure_ascii=False, indent=2))
        typer.secho("\nDry run complete — no files written.", fg=typer.colors.YELLOW)
        return

    # ── Write JSONL ──────────────────────────────────────────────────────────
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for ex in examples:
            f.write(
                json.dumps(
                    {
                        "instruction": ex.instruction,
                        "input": ex.input,
                        "output": ex.output,
                        "language": ex.language,
                        "species": ex.species,
                        "category": ex.category,
                        "severity": ex.severity,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    size_kb = out.stat().st_size / 1024
    typer.secho(
        f"\n✅ Wrote {len(examples)} examples → {out}  ({size_kb:.1f} KB)",
        fg=typer.colors.GREEN,
    )
    typer.secho(
        "Next: zip data/processed/corpus/ and upload to Kaggle as 'ishvenom-corpus'.",
        fg=typer.colors.CYAN,
    )


if __name__ == "__main__":
    app()
