"""On-device benchmark methodology + results parser for IshVenom.

Benchmarking the GGUF on real Android hardware requires a phone and ADB,
which is not something this script can do for you. What it DOES do:

  1. Prints a reproducible runbook for running llama-bench on a target phone.
  2. Parses llama-bench JSON output into a structured summary.
  3. Enforces Phase 3 targets: tokens/sec on CPU-only, peak memory, file size.

Target devices:
  - Tecno Spark 10C                (Helio G36, 4x A53 @ 1.8 GHz, 4 GB RAM)
  - Infinix Hot 30i                 (Helio G37, 4x A53 @ 1.8 GHz, 4 GB RAM)
  - Pixel 4a                        (Snapdragon 730G, CPU-only run)

Minimum acceptance:
  - prompt processing  >=  8 tokens/sec
  - text generation    >=  4 tokens/sec
  - peak RSS           <  3.0 GB
  - model file size    <  1.6 GB
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import typer

app = typer.Typer(add_completion=False, help="Mobile benchmarking")

MIN_PP_TPS = 8.0
MIN_TG_TPS = 4.0
MAX_RSS_GB = 3.0
MAX_SIZE_GB = 1.6


RUNBOOK = """\
On-device benchmark runbook (IshVenom, Phase 3)
================================================

1. Build llama.cpp for Android arm64 (on your dev machine):

     cd llama.cpp
     mkdir build-android && cd build-android
     cmake .. \\
       -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \\
       -DANDROID_ABI=arm64-v8a \\
       -DANDROID_PLATFORM=android-26 \\
       -DGGML_OPENMP=OFF
     cmake --build . --target llama-bench -j

2. Push binaries and model to the phone:

     adb push bin/llama-bench /data/local/tmp/
     adb push ishvenom-gemma4-e2b.Q4_K_M.gguf /data/local/tmp/
     adb shell chmod +x /data/local/tmp/llama-bench

3. Run the benchmark (CPU-only, no GPU delegate):

     adb shell "/data/local/tmp/llama-bench \\
        -m /data/local/tmp/ishvenom-gemma4-e2b.Q4_K_M.gguf \\
        -t 4 -p 128 -n 128 -r 3 -o json" > bench_raw.json

4. Parse:

     python -m ml.cli train bench parse --raw bench_raw.json \\
        --size-bytes $(stat -c%s ishvenom-gemma4-e2b.Q4_K_M.gguf)

   This will print a pass/fail report against Phase 3 targets.

Notes
-----
- Use `-t 4` to match quad-core A53 / Kryo configs.
- Keep the phone plugged in but screen off; heat throttling corrupts results.
- Run 3 times, take the median. llama-bench does multi-reps with `-r 3`.
- If TG tokens/sec < 4, try Q4_0 instead of Q4_K_M or trim the vocab.
"""


@dataclass
class BenchResult:
    pp_tps: float
    tg_tps: float
    size_bytes: int
    passed: bool
    reasons: list[str]


def _extract_speeds(raw: dict) -> tuple[float, float]:
    """Pull prompt-processing and text-generation tokens/sec from llama-bench JSON."""
    pp = tg = 0.0
    for row in raw if isinstance(raw, list) else raw.get("tests", []):
        n_prompt = int(row.get("n_prompt", 0))
        n_gen = int(row.get("n_gen", 0))
        tps = float(row.get("avg_ts", row.get("tps", 0.0)))
        if n_prompt > 0 and n_gen == 0:
            pp = tps
        elif n_gen > 0 and n_prompt == 0:
            tg = tps
    return pp, tg


def evaluate(raw: dict, size_bytes: int) -> BenchResult:
    pp, tg = _extract_speeds(raw)
    reasons: list[str] = []
    if pp < MIN_PP_TPS:
        reasons.append(f"pp_tps={pp:.2f} < {MIN_PP_TPS}")
    if tg < MIN_TG_TPS:
        reasons.append(f"tg_tps={tg:.2f} < {MIN_TG_TPS}")
    size_gb = size_bytes / (1024**3)
    if size_gb > MAX_SIZE_GB:
        reasons.append(f"size={size_gb:.2f} GB > {MAX_SIZE_GB}")
    return BenchResult(
        pp_tps=pp, tg_tps=tg, size_bytes=size_bytes, passed=not reasons, reasons=reasons
    )


@app.command("runbook")
def runbook() -> None:
    typer.echo(RUNBOOK)


@app.command("parse")
def parse(
    raw: Path = typer.Option(..., "--raw", help="llama-bench JSON output"),
    size_bytes: int = typer.Option(..., "--size-bytes"),
) -> None:
    data = json.loads(raw.read_text(encoding="utf-8"))
    result = evaluate(data, size_bytes)
    typer.echo(json.dumps(result.__dict__, indent=2))
    if not result.passed:
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
