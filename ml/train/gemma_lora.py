"""Gemma 4 E2B LoRA fine-tuning on the IshVenom first-aid corpus.

Phase 3 spec (from tasks/todo.md):
  - rank 16, alpha 32, 3 epochs
  - multilingual eval on 20 held-out prompts per language

Safety gate (carried from Phase 2):
  This script REFUSES to start training if any gold file is below the
  `fine_tuning` safety tier or still contains NEEDS_TRANSLATION markers.
  See ml/train/safety.py.

Usage:
    python -m ml.cli train gemma --config ml/train/configs/gemma_lora.yaml
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import typer
import yaml

from ml.train.safety import SafetyGateError, assert_training_safe

app = typer.Typer(add_completion=False, help="Gemma 4 LoRA fine-tuning")


@dataclass(frozen=True)
class GemmaLoraConfig:
    base_model: str
    corpus_path: Path
    out_dir: Path
    lora_rank: int
    lora_alpha: int
    lora_dropout: float
    target_modules: list[str]
    epochs: int
    batch_size: int
    grad_accum: int
    lr: float
    warmup_ratio: float
    max_seq_len: int
    seed: int
    bf16: bool
    use_wandb: bool


def load_config(path: Path) -> GemmaLoraConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return GemmaLoraConfig(
        base_model=raw["base_model"],
        corpus_path=Path(raw["corpus_path"]),
        out_dir=Path(raw["out_dir"]),
        lora_rank=int(raw["lora_rank"]),
        lora_alpha=int(raw["lora_alpha"]),
        lora_dropout=float(raw["lora_dropout"]),
        target_modules=list(raw["target_modules"]),
        epochs=int(raw["epochs"]),
        batch_size=int(raw["batch_size"]),
        grad_accum=int(raw["grad_accum"]),
        lr=float(raw["lr"]),
        warmup_ratio=float(raw["warmup_ratio"]),
        max_seq_len=int(raw["max_seq_len"]),
        seed=int(raw["seed"]),
        bf16=bool(raw.get("bf16", True)),
        use_wandb=bool(raw.get("use_wandb", False)),
    )


def load_corpus(corpus_path: Path) -> list[dict]:
    """Load the synthetic corpus produced by Phase 2's synthetic_generator.

    Each row must have: {language, instruction, input, output}. We reject
    rows with empty outputs or the NEEDS_TRANSLATION marker, belt-and-braces
    even though the safety gate already checked upstream gold files.
    """
    if not corpus_path.exists():
        raise FileNotFoundError(
            f"Corpus file {corpus_path} not found. Run "
            "`python -m ml.cli data generate-corpus --target-size 5000` "
            "after translations land."
        )
    rows: list[dict] = []
    with corpus_path.open("r", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            out = (r.get("output") or "").strip()
            if not out or "NEEDS_TRANSLATION" in out:
                continue
            rows.append(r)
    if not rows:
        raise ValueError(f"Corpus {corpus_path} is empty after filtering.")
    return rows


def format_sft(row: dict) -> str:
    """Format a corpus row into a single SFT training string using the
    Gemma chat template tokens. Gemma 4 uses <start_of_turn> / <end_of_turn>.
    """
    user_parts = [row["instruction"]]
    if row.get("input"):
        user_parts.append(row["input"])
    user = "\n".join(user_parts)
    return (
        "<start_of_turn>user\n"
        f"{user}<end_of_turn>\n"
        "<start_of_turn>model\n"
        f"{row['output']}<end_of_turn>\n"
    )


@app.command("run")
def run(
    config: Path = typer.Option(
        Path("ml/train/configs/gemma_lora.yaml"), "--config", "-c"
    ),
    use_case: str = typer.Option(
        "fine_tuning",
        "--use-case",
        help="Safety tier to enforce. Keep as 'fine_tuning' for real runs.",
    ),
    dry_run: bool = typer.Option(False, "--dry-run"),
) -> None:
    # 1. Safety gate FIRST. No GPU cycles until this passes.
    try:
        gold = assert_training_safe(use_case=use_case)
        typer.echo(
            f"Safety gate passed: {len(gold)} languages at tier {use_case!r}"
        )
    except SafetyGateError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=2)

    cfg = load_config(config)
    corpus = load_corpus(cfg.corpus_path)
    typer.echo(
        f"Loaded corpus: {len(corpus)} rows from {cfg.corpus_path}. "
        f"Languages represented: "
        f"{sorted({r.get('language', '?') for r in corpus})}"
    )

    if dry_run:
        typer.echo("Dry run OK. Exiting before model load.")
        return

    # 2. Heavy imports only on real runs.
    import torch  # type: ignore
    from datasets import Dataset  # type: ignore
    from peft import LoraConfig, get_peft_model  # type: ignore
    from transformers import (  # type: ignore
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
    )
    from trl import SFTTrainer  # type: ignore

    torch.manual_seed(cfg.seed)

    tokenizer = AutoTokenizer.from_pretrained(cfg.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        cfg.base_model,
        torch_dtype=torch.bfloat16 if cfg.bf16 else torch.float16,
        device_map="auto",
    )

    peft_config = LoraConfig(
        r=cfg.lora_rank,
        lora_alpha=cfg.lora_alpha,
        lora_dropout=cfg.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=cfg.target_modules,
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    ds = Dataset.from_list(
        [{"text": format_sft(r), "language": r.get("language", "en")} for r in corpus]
    )
    ds = ds.train_test_split(test_size=0.05, seed=cfg.seed)

    cfg.out_dir.mkdir(parents=True, exist_ok=True)
    args = TrainingArguments(
        output_dir=str(cfg.out_dir),
        num_train_epochs=cfg.epochs,
        per_device_train_batch_size=cfg.batch_size,
        gradient_accumulation_steps=cfg.grad_accum,
        learning_rate=cfg.lr,
        warmup_ratio=cfg.warmup_ratio,
        bf16=cfg.bf16,
        logging_steps=20,
        save_strategy="epoch",
        eval_strategy="epoch",
        report_to=("wandb" if cfg.use_wandb else "none"),
        seed=cfg.seed,
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=ds["train"],
        eval_dataset=ds["test"],
        tokenizer=tokenizer,
        max_seq_length=cfg.max_seq_len,
        dataset_text_field="text",
    )
    trainer.train()
    trainer.save_model(str(cfg.out_dir / "final"))
    tokenizer.save_pretrained(str(cfg.out_dir / "final"))
    typer.echo(f"LoRA adapter saved → {cfg.out_dir / 'final'}")


if __name__ == "__main__":
    app()
