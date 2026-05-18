# @ishvenom/mobile

Expo + React Native app. The core triage flow runs 100% offline with Gemma 4 E2B via `llama.rn`.

## Quick start
```bash
pnpm install
pnpm start
```

Press `a` for Android emulator. The app boots to a home screen with a CTA and disclaimer in 6 languages.

## Structure
- `app/` — expo-router file-based routes
- `src/i18n/` — i18next + RTL for Arabic
- `src/lib/` — local utilities, SQLite bindings, llama.rn wrapper (Phase 4)

## Hardware target
Entry-level Android, 4GB RAM, CPU-only. See `.claude/skills/llama-cpp-mobile.md` for the hard budget.

## Languages
English · French · Arabic (MSA, RTL) · Hausa · Swahili · Twi.

Twi is the canary — if output quality drops, Twi will show it first because Calyx can verify it personally.
