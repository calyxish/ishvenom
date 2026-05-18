"""Push IshVenom Phase 3 artifacts to HuggingFace Hub.

Two repos:
  - calyxish/ishvenom-gemma4-e2b-gguf       (Gemma fine-tune, PRIVATE
                                             until clinical review lands)
  - calyxish/ishvenom-snake-classifier-tflite (vision classifier, PUBLIC)

The GGUF repo stays private by default because it generates medical advice
and has not been clinically signed off. The vision classifier is just a
species identifier and can ship public with an MIT-style notice.
"""
from __future__ import annotations

from pathlib import Path

import typer

app = typer.Typer(add_completion=False, help="Push Phase 3 models to HF Hub")


DEFAULT_GEMMA_REPO = "calyxish/ishvenom-gemma4-e2b-gguf"
DEFAULT_VISION_REPO = "calyxish/ishvenom-snake-classifier-tflite"


@app.command("gemma")
def push_gemma(
    gguf_dir: Path = typer.Option(..., "--dir"),
    repo: str = typer.Option(DEFAULT_GEMMA_REPO, "--repo"),
    private: bool = typer.Option(
        True,
        "--private/--public",
        help="GGUF defaults to PRIVATE until clinical review completes",
    ),
) -> None:
    from huggingface_hub import HfApi  # type: ignore

    api = HfApi()
    api.create_repo(repo_id=repo, private=private, exist_ok=True)
    api.upload_folder(
        folder_path=str(gguf_dir),
        repo_id=repo,
        commit_message="Phase 3: fine-tuned Gemma 4 E2B (Q4_K_M)",
        allow_patterns=["*.gguf", "*.json", "*.md"],
    )
    typer.echo(
        f"Pushed {gguf_dir} → {repo} (private={private}). "
        "Remember: do NOT flip to public until `verify-gold --use-case "
        "production_release` passes."
    )


@app.command("vision")
def push_vision(
    export_dir: Path = typer.Option(..., "--dir"),
    repo: str = typer.Option(DEFAULT_VISION_REPO, "--repo"),
    private: bool = typer.Option(False, "--private/--public"),
) -> None:
    from huggingface_hub import HfApi  # type: ignore

    api = HfApi()
    api.create_repo(repo_id=repo, private=private, exist_ok=True)
    api.upload_folder(
        folder_path=str(export_dir),
        repo_id=repo,
        commit_message="Phase 3: snake species classifier (TFLite INT8)",
        allow_patterns=["*.tflite", "*.json", "*.md"],
    )
    typer.echo(f"Pushed {export_dir} → {repo} (private={private})")


if __name__ == "__main__":
    app()
