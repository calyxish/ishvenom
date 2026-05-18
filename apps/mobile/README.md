# @ishvenom/mobile

Expo + React Native app. The core triage flow works **online via Gemma 4 26B cloud** (default) and **offline via Gemma 4 E2B Q4_K_M GGUF** through `llama.rn`.

## Quick start

```bash
pnpm install
pnpm start
```

Press `a` for Android emulator. The app boots to a home screen with a CTA and disclaimer in 6 languages.

## Get the on-device model

The Q4_K_M GGUF and the TFLite vision classifier aren't checked into git (3 GB and 17 MB respectively). Pull them straight from HuggingFace:

```bash
pip install huggingface-hub

# Vision (TFLite + labels.json + PyTorch ckpt)
huggingface-cli download CalyxIsh/ishvenom-vision-classifier \
  --include "venomwise-vision.tflite" "labels.json" \
  --local-dir apps/mobile/assets/models

# Gemma 4 E2B fine-tuned + quantized for llama.rn
huggingface-cli download CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF \
  --include "*.gguf" \
  --local-dir apps/mobile/assets/models
```

The merged FP16 base (for further LoRA work) lives at [`CalyxIsh/ishvenom-gemma-e2b-merged`](https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged). Training data is on Kaggle: [`ishvenom-corpus`](https://www.kaggle.com/datasets/kwakyeishmael/ishvenom-corpus) and [`snakes-africa`](https://www.kaggle.com/datasets/kwakyeishmael/snakes-africa).

## Structure

- `app/` — expo-router file-based routes
- `src/i18n/` — i18next + RTL for Arabic
- `src/lib/` — local utilities, SQLite bindings, llama.rn wrapper, Google AI Gemma 4 cloud client

## Hardware target

Entry-level Android, 4 GB RAM, CPU-only. See `.claude/skills/llama-cpp-mobile.md` for the hard budget. The Q4_K_M variant loads cleanly on 4 GB devices; the older Q3_K_M ran into OOM on tight-memory phones and was retired.

## Languages

English · French · Arabic (MSA, RTL) · Hausa · Swahili · Twi.

Twi is the canary — if output quality drops, Twi will show it first because the maintainer can verify it personally.
