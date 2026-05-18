"""Tests for Gemma LoRA pure-Python helpers.

Verifies SFT formatting, corpus loading, and that the NEEDS_TRANSLATION
belt-and-braces filter actually filters.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from ml.train.gemma_lora import format_sft, load_corpus, load_config


def test_format_sft_uses_gemma_chat_template() -> None:
    row = {
        "language": "en",
        "instruction": "What is the first aid for a puff adder bite?",
        "input": "Adult, rural area, 2 hours from clinic",
        "output": "Keep the victim still, immobilize the limb, transport.",
    }
    text = format_sft(row)
    assert text.startswith("<start_of_turn>user\n")
    assert "<end_of_turn>\n<start_of_turn>model\n" in text
    assert text.rstrip().endswith("<end_of_turn>")
    assert "puff adder" in text
    assert "Keep the victim still" in text


def test_format_sft_without_input_field() -> None:
    row = {
        "instruction": "Identify this snake",
        "output": "Not enough context.",
    }
    text = format_sft(row)
    assert "Identify this snake" in text
    assert "Not enough context." in text


def test_load_corpus_missing_file_raises_helpful_error(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="generate-corpus"):
        load_corpus(tmp_path / "nope.jsonl")


def test_load_corpus_filters_empty_and_needs_translation(tmp_path: Path) -> None:
    corpus = tmp_path / "corpus.jsonl"
    corpus.write_text(
        "\n".join(
            [
                json.dumps({"instruction": "q1", "output": "good answer"}),
                json.dumps({"instruction": "q2", "output": ""}),
                json.dumps(
                    {"instruction": "q3", "output": "NEEDS_TRANSLATION"}
                ),
                json.dumps(
                    {"instruction": "q4", "output": "also good"}
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    rows = load_corpus(corpus)
    assert len(rows) == 2
    outputs = {r["output"] for r in rows}
    assert outputs == {"good answer", "also good"}


def test_load_corpus_empty_after_filtering_raises(tmp_path: Path) -> None:
    corpus = tmp_path / "empty.jsonl"
    corpus.write_text(
        json.dumps({"instruction": "q", "output": "NEEDS_TRANSLATION"}) + "\n",
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="empty after filtering"):
        load_corpus(corpus)


def test_load_config_parses_lora_yaml(tmp_path: Path) -> None:
    cfg_path = tmp_path / "lora.yaml"
    cfg_path.write_text(
        "base_model: google/gemma-4-e2b\n"
        "corpus_path: data/corpus.jsonl\n"
        "out_dir: runs/gemma\n"
        "lora_rank: 16\n"
        "lora_alpha: 32\n"
        "lora_dropout: 0.05\n"
        "target_modules: [q_proj, k_proj, v_proj, o_proj]\n"
        "epochs: 3\n"
        "batch_size: 4\n"
        "grad_accum: 8\n"
        "lr: 0.0002\n"
        "warmup_ratio: 0.03\n"
        "max_seq_len: 1024\n"
        "seed: 42\n",
        encoding="utf-8",
    )
    cfg = load_config(cfg_path)
    assert cfg.lora_rank == 16
    assert cfg.lora_alpha == 32
    assert cfg.epochs == 3
    assert cfg.target_modules == ["q_proj", "k_proj", "v_proj", "o_proj"]
    assert cfg.bf16 is True  # default
