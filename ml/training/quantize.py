"""HF → GGUF → Q4_K_M quantization pipeline. Phase 3.

Wraps:
  python llama.cpp/convert_hf_to_gguf.py merged/ --outfile out.gguf --outtype f16
  ./llama.cpp/llama-quantize out.gguf out-Q4_K_M.gguf Q4_K_M
"""
from __future__ import annotations

import typer

app = typer.Typer(add_completion=False)


@app.command()
def main() -> None:
    raise NotImplementedError("Phase 3")


if __name__ == "__main__":
    app()
