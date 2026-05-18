"""Push processed datasets to Hugging Face Hub.

Two datasets:
  1. calyxish/ishvenom-snakes-africa       (vision)
  2. calyxish/ishvenom-firstaid-corpus     (text)

Usage:
    export HF_TOKEN=hf_xxx
    python -m ml.datasets.push_to_hub vision --splits data/processed/splits
    python -m ml.datasets.push_to_hub text --corpus data/processed/firstaid_corpus.jsonl
"""
from __future__ import annotations

import os
from pathlib import Path

import typer

app = typer.Typer(add_completion=False)

DEFAULT_OWNER = "calyxish"
VISION_REPO = f"{DEFAULT_OWNER}/ishvenom-snakes-africa"
TEXT_REPO = f"{DEFAULT_OWNER}/ishvenom-firstaid-corpus"


def _require_token() -> str:
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    if not token:
        raise typer.BadParameter("Set HF_TOKEN environment variable")
    return token


def _require_datasets():
    try:
        from datasets import Dataset, DatasetDict, Features, Value, Image
    except ImportError as e:
        raise RuntimeError("Install: pip install datasets huggingface-hub") from e
    return Dataset, DatasetDict, Features, Value, Image


@app.command(name="vision")
def push_vision(
    splits: Path = typer.Option(Path("data/processed/splits")),
    repo_id: str = typer.Option(VISION_REPO),
    private: bool = typer.Option(False),
) -> None:
    token = _require_token()
    Dataset, DatasetDict, Features, Value, Image = _require_datasets()

    def _load_split(path: Path):
        import json

        rows: list[dict] = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                rec = json.loads(line)
                rows.append(
                    {
                        "image": rec["path"],
                        "species": rec["species"],
                        "width": rec["width"],
                        "height": rec["height"],
                        "blur_score": rec["blur_score"],
                    }
                )
        features = Features(
            {
                "image": Image(),
                "species": Value("string"),
                "width": Value("int32"),
                "height": Value("int32"),
                "blur_score": Value("float32"),
            }
        )
        return Dataset.from_list(rows, features=features)

    ds = DatasetDict(
        {
            "train": _load_split(splits / "train.jsonl"),
            "val": _load_split(splits / "val.jsonl"),
            "test": _load_split(splits / "test.jsonl"),
        }
    )

    typer.echo(f"📤 Pushing vision dataset → {repo_id}")
    ds.push_to_hub(repo_id, token=token, private=private)
    typer.secho("✅ Done", fg=typer.colors.GREEN)


@app.command(name="text")
def push_text(
    corpus: Path = typer.Option(Path("data/processed/firstaid_corpus.jsonl")),
    repo_id: str = typer.Option(TEXT_REPO),
    private: bool = typer.Option(True, help="Keep private until safety review complete"),
) -> None:
    token = _require_token()
    Dataset, DatasetDict, _, _, _ = _require_datasets()

    import json

    rows: list[dict] = []
    with corpus.open("r", encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))

    ds = DatasetDict({"train": Dataset.from_list(rows)})
    typer.echo(f"📤 Pushing text dataset ({len(rows)} rows) → {repo_id}")
    ds.push_to_hub(repo_id, token=token, private=private)
    typer.secho("✅ Done", fg=typer.colors.GREEN)


if __name__ == "__main__":
    app()
