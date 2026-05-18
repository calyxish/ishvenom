"""Merge the trained LoRA adapter into the Gemma 4 base and quantize to GGUF.

Pipeline:
  1. peft: base + adapter → merged HF model (FP16)
  2. llama.cpp/convert_hf_to_gguf.py → F16 GGUF
  3. llama.cpp/llama-quantize → Q4_K_M GGUF (target < 1.6 GB)
  4. Write a model card sidecar JSON

llama.cpp must already be cloned and built locally — see docs/DEPLOYMENT.md.
This script does not build llama.cpp for you because hackathon machines vary.

Usage:
    python -m ml.cli train quantize \\
        --adapter runs/gemma_lora/final \\
        --llama-cpp /opt/llama.cpp \\
        --out runs/gguf
"""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import typer

app = typer.Typer(add_completion=False, help="Merge LoRA + quantize to GGUF")

TARGET_SIZE_GB = 1.6


def _run(cmd: list[str], cwd: Path | None = None) -> None:
    typer.echo(f"$ {' '.join(str(c) for c in cmd)}")
    subprocess.run(cmd, check=True, cwd=cwd)


@app.command("run")
def run(
    adapter: Path = typer.Option(..., "--adapter", "-a", help="Trained LoRA dir"),
    base_model: str = typer.Option(
        "google/gemma-4-e2b",
        "--base",
        "-b",
        help="HF id of the base model",
    ),
    llama_cpp: Path = typer.Option(
        ...,
        "--llama-cpp",
        help="Path to a cloned + built llama.cpp repo",
    ),
    out: Path = typer.Option(Path("runs/gguf"), "--out"),
    quant: str = typer.Option("Q4_K_M", "--quant"),
) -> None:
    import torch  # type: ignore
    from peft import PeftModel  # type: ignore
    from transformers import AutoModelForCausalLM, AutoTokenizer  # type: ignore

    out.mkdir(parents=True, exist_ok=True)
    merged_dir = out / "merged_fp16"
    if merged_dir.exists():
        shutil.rmtree(merged_dir)
    merged_dir.mkdir(parents=True)

    # 1. Merge
    typer.echo(f"Loading base {base_model} ...")
    base = AutoModelForCausalLM.from_pretrained(
        base_model, torch_dtype=torch.float16
    )
    typer.echo(f"Attaching adapter from {adapter} ...")
    merged = PeftModel.from_pretrained(base, str(adapter))
    merged = merged.merge_and_unload()
    merged.save_pretrained(str(merged_dir), safe_serialization=True)
    AutoTokenizer.from_pretrained(str(adapter)).save_pretrained(str(merged_dir))
    typer.echo(f"Merged model → {merged_dir}")

    # 2. HF → GGUF F16
    convert = llama_cpp / "convert_hf_to_gguf.py"
    if not convert.exists():
        raise typer.BadParameter(
            f"convert_hf_to_gguf.py not found at {convert}. "
            "Update --llama-cpp to point at a cloned llama.cpp repo."
        )
    f16_gguf = out / "ishvenom-gemma4-e2b.F16.gguf"
    _run(
        [
            "python",
            str(convert),
            str(merged_dir),
            "--outfile",
            str(f16_gguf),
            "--outtype",
            "f16",
        ]
    )
    typer.echo(f"F16 GGUF → {f16_gguf}")

    # 3. Quantize
    llama_quantize = llama_cpp / "build" / "bin" / "llama-quantize"
    if not llama_quantize.exists():
        llama_quantize = llama_cpp / "llama-quantize"
    if not llama_quantize.exists():
        raise typer.BadParameter(
            f"llama-quantize not found under {llama_cpp}. Build llama.cpp first."
        )
    quant_gguf = out / f"ishvenom-gemma4-e2b.{quant}.gguf"
    _run([str(llama_quantize), str(f16_gguf), str(quant_gguf), quant])

    size_gb = quant_gguf.stat().st_size / (1024**3)
    typer.echo(f"{quant} GGUF → {quant_gguf} ({size_gb:.2f} GB)")
    if size_gb > TARGET_SIZE_GB:
        typer.echo(
            f"WARNING: quantized size {size_gb:.2f} GB exceeds target "
            f"{TARGET_SIZE_GB} GB. Try Q4_0 or a smaller LoRA merge."
        )

    # 4. Sidecar card
    (out / "model_card.json").write_text(
        json.dumps(
            {
                "base_model": base_model,
                "adapter_source": str(adapter),
                "quantization": quant,
                "file": quant_gguf.name,
                "size_bytes": quant_gguf.stat().st_size,
                "target_size_gb": TARGET_SIZE_GB,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    app()
