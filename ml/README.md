# ml/

Training pipelines, dataset builders, and evaluation for IshVenom.

## Install
```bash
pip install -e .[training,dev]
```

## Layout
- `datasets/` — scrapers and builders for iNaturalist, GBIF, WHO first-aid corpus
- `training/` — Gemma 4 E2B LoRA fine-tuning + quantization pipeline
- `vision-classifier/` — EfficientNet-Lite snake species CNN
- `tests/` — pytest suite for data pipelines

## Canonical recipe
See `.claude/skills/gemma4-finetuning.md` for the LoRA config and training args.
Deviations from that recipe require a ML experiment before merging.

## Targets
| Artifact | Target metric |
|---|---|
| Snake vision classifier | Top-3 accuracy ≥ 85% on held-out val set |
| Gemma 4 E2B fine-tune (first-aid) | Safety pass rate = 100% on gold set × 6 languages |
| Final GGUF Q4_K_M | < 1.6 GB, tokens/sec ≥ 4 on Pixel 4a CPU |
