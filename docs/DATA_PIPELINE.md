# Data Pipeline

## Problem
Labeled training data for African snake identification and multilingual first-aid
instruction generation does not exist in a ready-to-use form. Phase 2 builds it.

## Vision training data (snake species)

### Sources
1. **iNaturalist API** — research-grade observations with photos, filtered to
   African countries and the 20 priority species.
2. **GBIF** — additional specimen records and range polygons.
3. **CalPhotos (UC Berkeley)** — backup images for rare species.

### Pipeline
```
iNat/GBIF API → JSONL → image downloader → dedup + blur filter
  → stratified train/val/test split (70/15/15)
  → Albumentations augmentation (blur, rotation, occlusion, low light)
  → HF Datasets: calyxish/ishvenom-snakes-africa
```

### Target scale
- 20 species × ~200 images each = **~4,000 images minimum**
- Augmentation brings effective training set to ~20,000

## First-aid instruction corpus (text)

### Sources
1. **WHO snakebite guidelines** (English, authoritative)
2. **AfriSenti** — linguistic patterns for Hausa and Twi
3. **MasakhaNEWS** — health vocabulary in African languages
4. **XL-Sum** — natural prose patterns for Swahili and French

### Pipeline (EpiCast-inspired corpus grounding)
```
WHO guidelines → manual extraction of 30 canonical instructions (EN source)
  → human translation to fr/ar/ha/sw/tw = 180 gold examples
  → extract linguistic patterns from AfriSenti/MasakhaNEWS/XL-Sum
  → inject patterns into instruction templates per species × severity × language
  → ~5,000 synthetic training examples across 6 languages
  → validation against gold set (safety pass rate must = 100%)
  → HF Datasets: calyxish/ishvenom-firstaid-corpus
```

## Ethics and safety
- **All synthetic outputs must be validated** against human-authored gold examples
  before being used for fine-tuning.
- **Twi is the canary** — tested first on every new dataset version.
- **No user-generated content** in training data (pre-Phase 6). Community
  contributions are a post-hackathon backlog item.
- **License compliance** — iNaturalist photos have varying CC licenses; we filter
  to CC-BY, CC-BY-SA, and CC0 only.
