# IshVenom

> **Snakebite triage and prevention for sub-Saharan Africa — running on $80 phones, in 6 languages, with Gemma 4.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Built with Gemma 4](https://img.shields.io/badge/Built_with-Gemma_4-4285F4)](https://ai.google.dev/gemma)
[![Status: Submission ready](https://img.shields.io/badge/Status-Submission_ready-brightgreen)]()

Built by **Kwakye Ishmael Affum (Calyx Ish)** · [@calyxish](https://github.com/calyxish) · University of Ghana, Legon

Submission for the **Gemma 4 Good Hackathon** (Kaggle × Google DeepMind) · Health & Sciences track.

---

## The problem

Every year roughly **30,000 people die from snakebites in sub-Saharan Africa**, and an estimated **8,000 more suffer permanent disability**. Most deaths happen in villages, hours from the nearest clinic, and most victims receive incorrect first aid — tourniquets, wound incision, suction — that makes outcomes dramatically worse.

The WHO classified snakebite envenoming as a **Neglected Tropical Disease** in 2017 precisely because the data is absent: victims die before they are counted, antivenom stockouts go unreported, and species-distribution maps are decades out of date.

Every tool that exists assumes cloud connectivity, a GPU-class smartphone, English or French input, and a trained clinician. The people at risk have none of those things.

## The solution

IshVenom is a mobile-first triage and education app powered by Gemma 4. It works in two modes:

**Cloud mode** (default, requires internet)
- Photographs the snake → Gemma 4 26B A4B MoE identifies the species, classifies venomousness, and generates structured first-aid instructions via the Google AI REST API
- The same model powers the Learn chat tab for snake-safety education and Q&A

**On-device mode** (offline, no internet required)
- A custom TFLite vision classifier (EfficientNet, 20 African species) identifies the snake locally in ~50 ms
- A fine-tuned Gemma 4 E2B LoRA (Q3_K_M GGUF, ~3 GB) generates first-aid text via `llama.rn` — CPU-only, no GPU, no cloud

Both paths produce the same user experience: species name, venomousness, correct first-aid steps, and a passively-synced encounter record that feeds the WHO-facing surveillance dashboard.

## Why Gemma 4

| | Typical health AI app | IshVenom |
|---|---|---|
| Hardware target | iPhone 13+, Metal GPU | $80 Android, CPU-only, ARM NEON |
| Connectivity | Cloud-required | Cloud-first with offline fallback |
| Model | GPT-4 / Gemini API | Gemma 4 26B cloud + Gemma 4 E2B on-device |
| Languages | English | English, French, Arabic, Hausa, Swahili, Twi |
| Data scarcity | ignored | iNaturalist + GBIF + synthetic SFT pipeline |
| Cost to user | data plan required | zero after install (on-device mode) |

Gemma 4's combination of a capable 26B cloud model and a tiny-but-fine-tunable 2B model makes this dual-mode architecture possible. No other openly-licensed model family covers both ends of the capability–size spectrum.

## Languages

| Language | Primary regions | Speakers |
|---|---|---|
| English | Anglophone Africa, medical professionals | — |
| French | Senegal, Côte d'Ivoire, Mali, DRC, Cameroon | ~140 M |
| Arabic (MSA) | Sudan, Chad, Mauritania, Egypt | ~100 M in Africa |
| Hausa | Northern Nigeria, Niger, Ghana, Cameroon | ~80 M |
| Swahili | Kenya, Tanzania, Uganda, DRC, Rwanda | ~200 M |
| Twi | Ghana | ~9 M |

**Estimated reach: ~700 M Africans across the three highest snakebite-mortality regions.**

## Architecture

```
ishvenom/
├── apps/
│   ├── mobile/          # React Native (Expo) — Gemma 4 cloud + on-device
│   └── dashboard/       # Next.js — WHO-facing surveillance dashboard (Vercel)
├── services/
│   ├── api/             # Express + Prisma + Neon Postgres (Render)
│   └── cloud-inference/ # Gemma 4 sit-report generation on RunPod
├── ml/
│   ├── kaggle/          # Gemma 4 E2B LoRA fine-tuning (Unsloth, T4 x2)
│   ├── train/           # Vision classifier training (EfficientNet → TFLite)
│   └── datasets/        # iNaturalist + GBIF + first-aid SFT pipeline
├── packages/
│   └── shared-types/    # Zod schemas shared across mobile, API, dashboard
└── docs/                # Architecture, data pipeline, deployment guide
```

## Tech stack

**Mobile (React Native / Expo):**
`llama.rn` · Gemma 4 E2B Q3_K_M GGUF · `react-native-fast-tflite` · SQLite (expo-sqlite) · expo-camera · 6-language first-aid corpus

**Backend (Render):**
Node 20 · TypeScript · Express 5 · Prisma · Neon Postgres 16 + PostGIS 3 · Zod

**Dashboard (Vercel):**
Next.js 14 · Tailwind · shadcn/ui · MapLibre GL JS · Recharts

**ML:**
PyTorch · Hugging Face Transformers · Unsloth · PEFT · `ai-edge-litert` · Kaggle T4 x2

## Model training summary

| Model | Base | Method | Data | Loss |
|---|---|---|---|---|
| Vision classifier | EfficientNet-B0 | Fine-tune → ONNX → TFLite export | ~1,500 iNaturalist images, 20 species | — |
| IshVenom Gemma 4 E2B | `google/gemma-4-e2b-it` | LoRA rank 16, alpha 32 | 5,000 first-aid SFT examples (EN + FR) | 0.0224 |

Trained on Kaggle (T4 x2, 16 GB VRAM). LoRA merged and quantized to Q3_K_M via `ggml-org/gguf-my-repo` HuggingFace Space. Models hosted at `CalyxIsh/ishvenom-*` on HuggingFace.

## Deployment

| Service | Platform | URL |
|---|---|---|
| Backend API | Render | `https://ishvenom-api.onrender.com` |
| Dashboard | Vercel | `https://ishvenom.vercel.app` |
| Models | HuggingFace | `CalyxIsh/ishvenom-gemma-e2b-merged-Q3_K_M-GGUF` |

See [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) for the full setup guide.

## Running locally

```bash
git clone https://github.com/calyxish/ishvenom.git
cd ishvenom
pnpm install

# Backend
cp services/api/.env.example services/api/.env
# (fill in DATABASE_URL from Neon, SESSION_SECRET, etc.)
pnpm --filter @ishvenom/api prisma:generate
pnpm --filter @ishvenom/api dev

# Dashboard
cp apps/dashboard/.env.example apps/dashboard/.env.local
# (set NEXT_PUBLIC_API_BASE=http://localhost:4000/api/v1)
pnpm --filter @ishvenom/dashboard dev

# Mobile
cp apps/mobile/.env.example apps/mobile/.env
# (set EXPO_PUBLIC_GOOGLE_AI_KEY from https://aistudio.google.com)
pnpm --filter ishvenom dev
```

## License

Apache 2.0 — see [LICENSE](./LICENSE). Same license as Gemma 4 itself.

## Acknowledgements

- Google DeepMind for Gemma 4 and the Gemma 4 Good Hackathon
- WHO Neglected Tropical Diseases programme
- iNaturalist and GBIF for open biodiversity data
- The community health workers across West Africa whose work this is meant to support

---

**Gemma 4 Good Hackathon · Kaggle × Google DeepMind · Submitted May 18, 2026**
