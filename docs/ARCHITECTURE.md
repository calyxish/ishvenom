# IshVenom Architecture

## System diagram

```
┌─────────────────────────────────────────────────────────┐
│                  ANDROID PHONE (offline)                │
│  ┌────────────────────────────────────────────────┐     │
│  │  React Native UI (en/fr/ar/ha/sw/tw, RTL-safe) │     │
│  └──────────────────────┬─────────────────────────┘     │
│                         │                               │
│  ┌──────────────────────▼─────────────────────────┐     │
│  │  Gemma 4 E2B (Q4_K_M, llama.cpp + NEON)        │◄──── DIFFERENTIATOR
│  │  ↕ native function calling                     │     │
│  └──┬────────────┬─────────────┬──────────────────┘     │
│     │            │             │                       │
│  ┌──▼────┐  ┌────▼─────┐  ┌────▼────┐                   │
│  │Vision │  │ SQLite   │  │First-aid│                   │
│  │Classif│  │ species +│  │ corpus  │                   │
│  │(TFLite│  │ antivenom│  │ 6 langs │                   │
│  └───────┘  └──────────┘  └─────────┘                   │
│                                                         │
│  ┌────────────────────────────────────────────────┐     │
│  │   Encounter queue (AsyncStorage)               │     │
│  └──────────────────────┬─────────────────────────┘     │
└─────────────────────────┼───────────────────────────────┘
                          │ (sync when online)
                          ▼
┌─────────────────────────────────────────────────────────┐
│     NEON (PostgreSQL 16 + PostGIS 3, free tier)         │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐            │
│  │encounters│  │ species  │  │ antivenom   │            │
│  │  (geo)   │  │ catalog  │  │  centers    │            │
│  └──────────┘  └──────────┘  └─────────────┘            │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Next.js Dashboard    │   │ Gemma 4 31B on RunPod    │
│ (Vercel, WHO-facing) │   │ (situation reports only) │
│ - district maps      │   │ never in critical path   │
│ - species distrib    │   └──────────────────────────┘
│ - outbreak alerts    │
└──────────────────────┘
```

## Component responsibilities

### apps/mobile (React Native + Expo)
The core product. Runs on entry-level Android with no internet dependency for the
triage flow. Loads Gemma 4 E2B and the snake vision classifier on-device.

### apps/dashboard (Next.js)
WHO/NTD-facing surveillance dashboard. Read-only view into encounter data with
geospatial aggregation, species distribution, and outbreak alerts.

### services/api (Node + Express + Prisma)
Thin sync + aggregation API. Accepts batched encounter uploads from mobile,
serves catalog data and spatial queries for the dashboard.

### services/cloud-inference (Gemma 4 31B on RunPod)
Optional situation-report generator. Only invoked on demand. Mobile app never
depends on it.

### ml/
Training pipelines, dataset builders, and evaluation. Produces the fine-tuned
Gemma 4 E2B GGUF and the TFLite vision classifier that ship inside the mobile app.

### packages/shared-types
Zod schemas shared across mobile, API, and dashboard. Single source of truth for
all request/response shapes.

## Non-negotiables
1. Offline-first core flow (airplane mode test required before any mobile PR).
2. CPU-only on-device inference (no Metal, no CUDA on the phone).
3. 6 supported languages: English, French, Arabic, Hausa, Swahili, Twi.
4. Apache 2.0 license.
5. Neon for Postgres. Not Supabase. Not self-hosted.
