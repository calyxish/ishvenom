# IshVenom cloud inference service

Gemma 4 31B (dense) behind a RunPod serverless worker, used by the
Phase 5 backend to generate district-level situation reports for health
officers on the dashboard.

## Why serverless, not a persistent GPU box

We tried a persistent Vertex AI hosted endpoint for MedGemma earlier in
the project. It was ~$3–7/hour just for the privilege of having one GPU
replica sitting idle 23 hours a day. For a hackathon submission where
situation reports are generated at most a few dozen times per day, RunPod
serverless costs **$0/hour when idle and ~$1.50/hour only during active
inference**. That arithmetic is the whole reason this service exists.

## Architecture

```
┌─────────────────────┐     HTTPS POST /v2/<id>/run      ┌────────────┐
│  Phase 5 backend    │ ─────────────────────────────▶  │  RunPod    │
│  /api/v1/sit-reports│ ◀───────────────────────────── │  serverless│
└─────────────────────┘       { output: {...} }         │  worker    │
                                                         │   (vLLM)   │
                                                         │   Gemma 4  │
                                                         │    31B     │
                                                         └────────────┘
```

## Files

| File | Purpose |
|---|---|
| `handler.py` | RunPod serverless entrypoint. Loads vLLM once, reuses across calls. |
| `Dockerfile` | CUDA 12.1 + vLLM + handler. Model weights mounted from a network volume. |
| `requirements.txt` | Pinned vllm/runpod/transformers versions. |

## One-time setup

1. **Create a RunPod network volume** (e.g. 80 GB, NY region) and upload
   the Gemma 4 31B weights to `/runpod-volume/models/gemma-4-31b`.
   The easiest way:
   ```bash
   # from a throwaway RunPod pod attached to the volume
   huggingface-cli download google/gemma-4-31b \
     --local-dir /runpod-volume/models/gemma-4-31b \
     --local-dir-use-symlinks False
   ```

2. **Build and push the image** (any container registry works —
   Docker Hub, GHCR, RunPod's private registry):
   ```bash
   docker build -t ghcr.io/calyxish/ishvenom-cloud-inference:latest .
   docker push ghcr.io/calyxish/ishvenom-cloud-inference:latest
   ```

3. **Create a RunPod serverless endpoint** pointing at the image, with:
   - GPU type: A100 40 GB (minimum for 31B dense in bf16)
   - Network volume attached at `/runpod-volume`
   - Environment variables:
     - `GEMMA_MODEL_PATH=/runpod-volume/models/gemma-4-31b`
     - `MAX_MODEL_LEN=8192`
     - `GPU_MEMORY_UTILIZATION=0.90`
   - Scale: min 0, max 1 for the hackathon (bump max=3 if you get hammered)
   - Idle timeout: 30 s (so we stop billing quickly after each burst)

4. **Copy the endpoint ID and API key** into the backend's env file:
   ```
   RUNPOD_ENDPOINT_ID=xxxxxxxxxxxxxx
   RUNPOD_API_KEY=yyyyyyyyyyyyyyyy
   ```

## Local smoke test (no GPU)

You can import `handler.handler` in a unit test as long as you mock
`vllm.LLM`. The backend's `sitReportClient.test.ts` already does this —
you do not need to run the container to iterate on the prompt.

## Cost ceiling

A single situation report is roughly 2–4 k prompt tokens + 800–1500
completion tokens, which on an A100 runs in ~6–12 s. At RunPod's
typical $1.50/hr for A100 serverless, that is **~$0.003 per report**.
Even at 1000 reports/day for the full hackathon period we are under $60.

## Degraded mode

If RunPod is down or the API key is missing, the backend returns
HTTP 503 with `error.code = "cloud_unavailable"`. The dashboard renders
a friendly fallback that still shows the district's raw statistics
table, just without the generated narrative. **Nothing on the CHW
mobile app depends on this service** — the offline triage path works
completely without it.
