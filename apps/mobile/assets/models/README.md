# On-device model assets

This directory must contain two files before an EAS Android build will
produce a usable APK. Both files come from Phase 3.

## 1. Vision classifier

**File:** `venomwise-vision.tflite`
**Source:** `runs/vision/export/ishvenom_snakes_fp32.tflite` (FP32 export)
**Expected input:** 224x224 RGB float32 tensor, values in [0,1] (pixel/255).
  Normalization is baked into the model's first layer during ONNX→TF→TFLite export.
**Expected output:** 21-element float32 logits vector (20 species + unknown class).
**Class order:** must match `src/lib/vision.ts` → `VISION_CLASS_ORDER`.

Current export: **FP32 (~13 MB)**. INT8 export is still pending; re-quantize
before shipping if we need smaller CPU memory.

## 2. Gemma 4 E2B (quantized)

**File:** `ishvenom-gemma-e2b-merged-q3_k_m.gguf`
**Source:** Trained on Kaggle (T4 x2) via `ml/kaggle/02-gemma-lora.ipynb`
using Unsloth LoRA. Merged model pushed to HuggingFace
(`CalyxIsh/ishvenom-gemma-e2b-merged`), then quantized to Q3_K_M via
the `ggml-org/gguf-my-repo` HF Space.
**HuggingFace repo:** `CalyxIsh/ishvenom-gemma-e2b-merged-Q3_K_M-GGUF`
**Actual size:** ~3.0 GB
**Loaded by:** `src/lib/gemmaLearn.ts` via `llama.rn`, CPU-only
(`n_gpu_layers: 0`), `n_ctx: 2048`.

### Inference prompt format
Model was fine-tuned on **user → model pairs only** (no system turn).
Inference prompt must match training format exactly:
```
<start_of_turn>user
{instruction}<end_of_turn>
<start_of_turn>model
```
Do NOT inject a `<start_of_turn>system` block — it was not seen during training
and will cause the model to ignore formatting instructions.

### Training notes
- Base model: `google/gemma-4-e2b-it`
- LoRA: rank 16, alpha 32, dropout 0.05
- Corpus: 5,000 first-aid SFT examples (EN + FR)
- Final training loss: 0.0224
- Batch size 2, grad accum 16 (to fit T4 16GB VRAM)
- GGUF export done via HF Spaces (Kaggle 20GB disk limit prevents local export)

## Bundling

In `apps/mobile/app.json`, both files are registered as extra assets so
they are copied into `android/app/src/main/assets/models/` at build
time. A full EAS build of the mobile app will therefore weigh in at
roughly 3.8 GB — that's the cost of full offline operation, and is
expected.

## Download-at-first-launch alternative (optional)

If you don't want a 3.8 GB APK on the Play Store:
1. Publish the two model files on HuggingFace (the `CalyxIsh/ishvenom-*`
   repos already exist from Phase 3).
2. Set `useModelDownloadFlow = true` in `src/lib/gemma.ts` (TODO).
3. The app ships with a 50 MB shell and downloads the models on first
   launch, cached in `FileSystem.documentDirectory + 'models/'`.

For the hackathon demo the simpler full-APK path is strongly preferred:
judges want to see genuine offline operation, and downloading 3.4 GB of
models the first time you open the demo is not a good first impression.

## DO NOT commit models to git

Both file patterns are in `.gitignore`. Models live in HuggingFace.
