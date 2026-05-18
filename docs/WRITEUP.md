# IshVenom — Kaggle Submission Writeup (draft)

_This file fills in progressively as phases complete. Phase 6 polishes it for
final submission._

## Title
IshVenom: Offline, CPU-Native, Multilingual Snakebite Triage for 700M Africans

## The gap
Every year ~30,000 people die and ~8,000 suffer amputations from snakebites in
sub-Saharan Africa. The WHO classified snakebite envenoming as a Neglected Tropical
Disease in 2017 specifically because the surveillance data is so bad. Existing
health AI tools assume iPhones with GPUs, cloud connectivity, and English input.
None of those match the reality of a subsistence farmer bitten at dusk.

## The solution
(Fill in as Phase 4 completes)

## Novel contribution
1. **CPU-only on-device inference** of Gemma 4 E2B on entry-level Android
   (differentiator vs. EpiCast-class iPhone-targeted submissions)
2. **Six-language support** (en/fr/ar/ha/sw/tw) covering ~700M Africans across
   the three highest snakebite-mortality regions
3. **Corpus-grounded synthetic data pipeline** for first-aid instruction
   generation where no labeled corpus exists
4. **Vision-first multimodal flow** with native Gemma 4 function calling
5. **UN NTD-aligned data schema** — every encounter becomes a data point WHO
   has never had

## Architecture
See `docs/ARCHITECTURE.md`.

## Results
(Phase 6 — benchmarks, eval scores, demo video)

## Limitations
- Initial model trained on synthetic data; real-world validation is a
  post-hackathon priority.
- 6 languages covers ~700M but leaves out many — community translation
  framework is scoped but not built.
- Snakebite first-aid is a high-stakes domain; this app supports but does not
  replace professional medical care.

## Future work
- iOS build
- Offline voice I/O (Whisper tiny)
- Integration with real WHO NTD reporting channels
- Expansion to other NTDs (scorpion sting, leishmaniasis, rabies)
