"""
IshVenom cloud inference — RunPod serverless handler.

Runs Gemma 4 31B (dense) under vLLM and exposes a single JSON entrypoint
via RunPod's serverless SDK. The handler takes structured aggregate
encounter data from the backend, builds a situation-report prompt, runs
inference, and returns the generated markdown plus metadata.

Design notes
------------
* We use vLLM's ``LLM`` class loaded once at cold-start, then reused for
  the lifetime of the worker. RunPod's serverless workers scale to zero
  when idle, so cold starts are the expected worst case — we keep them
  tolerable by storing the model on a persistent network volume at
  ``/runpod-volume/models/gemma-4-31b``.
* Only ONE prompt template lives on the cloud side. All other prompt
  engineering is done by the backend (``services/api/src/lib/sitReportPrompt.ts``)
  and sent as a fully rendered string. Keeping the cloud dumb means we
  can redeploy the backend without touching RunPod, which matters for
  iteration speed during the hackathon.
* Output schema is enforced at parse-time in the backend, not here. The
  model is instructed to emit a JSON object wrapping the markdown, but
  the cloud handler does NOT fail on a malformed response — it returns
  the raw text with ``status="unstructured"`` and lets the backend fall
  back to a deterministic renderer.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import runpod  # type: ignore[import-not-found]
from vllm import LLM, SamplingParams  # type: ignore[import-not-found]


MODEL_PATH = os.environ.get(
    "GEMMA_MODEL_PATH", "/runpod-volume/models/gemma-4-31b"
)
MAX_MODEL_LEN = int(os.environ.get("MAX_MODEL_LEN", "8192"))
GPU_MEMORY_UTILIZATION = float(os.environ.get("GPU_MEMORY_UTILIZATION", "0.90"))

_llm: LLM | None = None


def _get_llm() -> LLM:
    """Lazy-load the model once per worker lifetime."""
    global _llm
    if _llm is None:
        print(f"[ishvenom] loading Gemma 4 31B from {MODEL_PATH}", flush=True)
        started = time.time()
        _llm = LLM(
            model=MODEL_PATH,
            dtype="bfloat16",
            max_model_len=MAX_MODEL_LEN,
            gpu_memory_utilization=GPU_MEMORY_UTILIZATION,
            trust_remote_code=False,
            enforce_eager=False,
        )
        print(
            f"[ishvenom] model loaded in {time.time() - started:.1f}s",
            flush=True,
        )
    return _llm


def _parse_output(raw: str) -> dict[str, Any]:
    """Best-effort JSON extraction. Never raises."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[-1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.rsplit("```", 1)[0]
    first = cleaned.find("{")
    last = cleaned.rfind("}")
    if first == -1 or last == -1 or last < first:
        return {"status": "unstructured", "raw": raw}
    try:
        obj = json.loads(cleaned[first : last + 1])
        if not isinstance(obj, dict):
            return {"status": "unstructured", "raw": raw}
        obj.setdefault("status", "structured")
        return obj
    except json.JSONDecodeError:
        return {"status": "unstructured", "raw": raw}


def handler(event: dict[str, Any]) -> dict[str, Any]:
    """RunPod serverless entrypoint.

    Input shape (validated by the backend, not here)::

        {
            "prompt":      "<fully rendered prompt string>",
            "max_tokens":  1024,
            "temperature": 0.3,
            "top_p":       0.9,
            "stop":        ["<end_of_turn>"]
        }

    Output shape::

        {
            "text":         "<raw model text>",
            "parsed":       { "status": "structured"|"unstructured", ... },
            "latency_ms":   1234,
            "model":        "gemma-4-31b",
            "tokens":       { "prompt": 512, "completion": 400 }
        }
    """
    inp = event.get("input") or {}
    prompt = inp.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return {"error": "prompt is required and must be a non-empty string"}

    max_tokens = int(inp.get("max_tokens", 1024))
    temperature = float(inp.get("temperature", 0.3))
    top_p = float(inp.get("top_p", 0.9))
    stop = inp.get("stop") or ["<end_of_turn>"]
    if not isinstance(stop, list) or not all(isinstance(s, str) for s in stop):
        return {"error": "stop must be a list of strings"}

    sampling = SamplingParams(
        temperature=temperature,
        top_p=top_p,
        max_tokens=max_tokens,
        stop=stop,
    )

    started = time.time()
    outputs = _get_llm().generate([prompt], sampling)
    latency_ms = int((time.time() - started) * 1000)

    if not outputs or not outputs[0].outputs:
        return {"error": "empty generation", "latency_ms": latency_ms}

    text = outputs[0].outputs[0].text
    prompt_token_count = len(outputs[0].prompt_token_ids or [])
    completion_token_count = len(outputs[0].outputs[0].token_ids or [])

    return {
        "text": text,
        "parsed": _parse_output(text),
        "latency_ms": latency_ms,
        "model": "gemma-4-31b",
        "tokens": {
            "prompt": prompt_token_count,
            "completion": completion_token_count,
        },
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
