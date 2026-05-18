# Kaggle Training — IshVenom

Two notebooks. Run them in order. Total GPU usage: ~7 hours out of your 30/week free quota.

---

## Don't want to train? Use the pre-built artifacts

Judges and anyone reproducing the app can pull the trained weights and datasets directly — no Kaggle GPU time required:

### Pre-built models on HuggingFace

| Artifact | Repo |
|---|---|
| TFLite vision classifier (EfficientNet-B0, 20 species) + `labels.json` + PyTorch checkpoint | [`CalyxIsh/ishvenom-vision-classifier`](https://huggingface.co/CalyxIsh/ishvenom-vision-classifier) |
| Gemma 4 E2B + IshVenom LoRA, merged to FP16 (~5 GB) | [`CalyxIsh/ishvenom-gemma-e2b-merged`](https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged) |
| Same model quantized to Q4_K_M GGUF for `llama.rn` (~3 GB) | [`CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF`](https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF) |

### Open training data on Kaggle

| Dataset | Kaggle |
|---|---|
| First-aid SFT corpus (5,000 examples, EN + FR) | [`kwakyeishmael/ishvenom-corpus`](https://www.kaggle.com/datasets/kwakyeishmael/ishvenom-corpus) |
| Snake image splits (~1,500 images, 20 African species, train/val/test) | [`kwakyeishmael/snakes-africa`](https://www.kaggle.com/datasets/kwakyeishmael/snakes-africa) |

### One-shot download for the mobile app

```bash
pip install huggingface-hub
huggingface-cli download CalyxIsh/ishvenom-vision-classifier \
  --include "venomwise-vision.tflite" "labels.json" \
  --local-dir apps/mobile/assets/models

huggingface-cli download CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF \
  --include "*.gguf" \
  --local-dir apps/mobile/assets/models
```

That gives you everything the app needs to run on-device — no training required. If you want to retrain from scratch or change the recipe, keep reading.

---

## Prerequisites

### 1. Run the data pipeline on your Mac first

```bash
cd /Users/calyxish/Engineer/ishvenom

# Install deps (CPU build is fine for data collection)
pip install -e "ml/[training]"

# Download snake images for all 20 priority species (~1 hour)
python -m ml.cli data fetch-inat all
python -m ml.cli data fetch-gbif all

# Deduplicate, quality-filter, and resize
python -m ml.cli data process-images --in data/raw

# Stratified 70/15/15 split
python -m ml.cli data split

# Generate EN+FR training corpus (dry run first)
python -m ml.datasets.build_firstaid_corpus --languages en,fr --dry-run
python -m ml.datasets.build_firstaid_corpus --languages en,fr --target-size 5000

# Package for upload
zip -r snakes_africa_splits.zip data/processed/splits/
zip -r ishvenom_corpus.zip data/processed/corpus/
```

### 2. Install the Kaggle CLI

```bash
pip install kaggle
# Copy your API key from https://www.kaggle.com/settings → API → Create New Token
# Save to ~/.kaggle/kaggle.json
```

### 3. Upload datasets to Kaggle

(Skip this if you're using the already-published versions linked at the top —
[`kwakyeishmael/snakes-africa`](https://www.kaggle.com/datasets/kwakyeishmael/snakes-africa)
and [`kwakyeishmael/ishvenom-corpus`](https://www.kaggle.com/datasets/kwakyeishmael/ishvenom-corpus).)

```bash
# Vision images
kaggle datasets create \
  --name snakes-africa \
  --path snakes_africa_splits.zip \
  --license apache2

# Text corpus
kaggle datasets create \
  --name ishvenom-corpus \
  --path ishvenom_corpus.zip \
  --license apache2
```

Or upload through the Kaggle web UI: kaggle.com/datasets → New Dataset.

---

## Notebook 1 — Vision Classifier

**File:** `01_vision_classifier.py`

1. Go to [kaggle.com/code](https://www.kaggle.com/code) → **New Notebook**
2. **Settings** (right panel):
   - Accelerator: **GPU T4 × 2**
   - Internet: **ON**
3. **Add data** → search `snakes-africa` → attach it
4. Click **+ Code** → paste the entire contents of `01_vision_classifier.py`
5. Click **Save & Run All**
6. Runtime: ~2 hours

**Download from `/kaggle/working/`:**
- `venomwise-vision.tflite` → `apps/mobile/assets/models/`
- `labels.json` → `apps/mobile/assets/models/`
- `best_vision.pt` → `ml/runs/vision/` (keep for future fine-tuning)

**Success check:** Look for `val_top3 >= 85%` in the output.

---

## Notebook 2 — Gemma 4 E2B LoRA Fine-Tuning

**File:** `02_gemma_lora.py`

> ⚠️ This notebook needs your HuggingFace token to download `google/gemma-4-e2b-it`.
> Add it as a Kaggle Secret: Settings → Secrets → `HF_TOKEN`.

1. Go to [kaggle.com/code](https://www.kaggle.com/code) → **New Notebook**
2. **Settings**:
   - Accelerator: **GPU T4 × 2**
   - Internet: **ON**
3. **Add data** → attach `ishvenom-corpus`
4. Add a code cell at the top:
   ```python
   import os
   from kaggle_secrets import UserSecretsClient
   os.environ["HF_TOKEN"] = UserSecretsClient().get_secret("HF_TOKEN")
   ```
5. Paste `02_gemma_lora.py` in the next cell
6. Click **Save & Run All**
7. Runtime: ~4–6 hours

**Kaggle disk limit prevents local GGUF export.** Instead:
1. The notebook pushes the merged 16-bit model to HuggingFace via `model.push_to_hub_merged()`
2. Use [ggml-org/gguf-my-repo](https://huggingface.co/spaces/ggml-org/gguf-my-repo) HF Space to quantize to Q4_K_M
3. Download the `.gguf` from the resulting HF repo

**HuggingFace repos (already published):**
- Vision classifier: [`CalyxIsh/ishvenom-vision-classifier`](https://huggingface.co/CalyxIsh/ishvenom-vision-classifier)
- Merged FP16 LoRA: [`CalyxIsh/ishvenom-gemma-e2b-merged`](https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged)
- GGUF Q4_K_M: [`CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF`](https://huggingface.co/CalyxIsh/ishvenom-gemma-e2b-merged-Q4_K_M-GGUF)

**Success check:** GGUF file size should be ~3.4 GB.

---

## After Kaggle — Wire Models into the App

```bash
cp venomwise-vision.tflite apps/mobile/assets/models/
cp labels.json apps/mobile/assets/models/
cp ishvenom-gemma-e2b-merged-q4_k_m.gguf apps/mobile/assets/models/

# Rebuild the app
cd apps/mobile && npx expo start --clear
```

The app reads:
- `src/lib/vision.ts` — picks up `venomwise-vision.tflite` + `labels.json`
- `src/lib/gemmaLearn.ts` — on-device path: `file:///android_asset/models/ishvenom-gemma-e2b-merged-q4_k_m.gguf`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: onnx_tf` | The pip install cell handles this; re-run it first |
| Kaggle session timeout during Gemma training | Re-attach and resume from the saved epoch checkpoint |
| `val_top3 < 85%` on vision | Increase EPOCHS to 35 or lower LR to 2e-4 |
| CUDA OOM during Gemma training | Lower `BATCH_SIZE` to 2, increase `GRAD_ACCUM` to 16 |
| Kaggle disk full during GGUF export | Use `push_to_hub_merged()` + gguf-my-repo Space instead |
| HF gated model error | Accept the Gemma license at huggingface.co/google/gemma-4-e2b-it |
| HF 401 during upload | Use a Write token, not a Read token |

