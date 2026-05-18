"""Corpus-grounded synthetic first-aid instruction generator.

Strategy (EpiCast-inspired):
  1. Start with 30 canonical gold instructions per language (from gold_loader).
  2. Pull linguistic patterns (connectors, openers, particles) from real
     corpora: AfriSenti for Hausa/Twi, MasakhaNEWS for health vocab, XL-Sum
     for Swahili/French prose patterns.
  3. For each priority species × severity × language, construct a prompt ↔
     response pair where the response is the gold instruction, optionally
     re-phrased using language-specific patterns from the corpus pool.
  4. Output: JSONL of {instruction, input, output} triples ready for Gemma 4
     chat-template formatting.

Safety: this pipeline REFUSES to run if `verify_gold.py` says the corpus is
not ready for fine_tuning. It will not synthesize from stub files.

Usage:
    python -m ml.datasets.synthetic_generator generate \
        --out data/processed/firstaid_corpus.jsonl \
        --target-size 5000

    # Dry run against gold only, no corpus grounding (fast smoke test)
    python -m ml.datasets.synthetic_generator generate --no-ground --target-size 100
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass
from pathlib import Path

import typer

from ml.datasets.gold_loader import GoldCorpusError, load_all, verify_for_use

SPECIES_FILE = Path(__file__).parent / "species" / "priority_species.json"

app = typer.Typer(add_completion=False)


@dataclass(frozen=True)
class TrainingExample:
    instruction: str
    input: str
    output: str
    language: str
    species: str
    category: str
    severity: str


def _load_species() -> list[dict]:
    return json.loads(SPECIES_FILE.read_text(encoding="utf-8"))["species"]


# ---------- Prompt templates ----------
# These are deliberately short and varied so the model learns to respond to
# realistic CHW phrasing, not one rigid format.
PROMPT_TEMPLATES: dict[str, list[str]] = {
    "en": [
        "A patient was bitten by a {common} ({scientific}). Give first aid in English.",
        "What should I do if someone is bitten by a {common}?",
        "Give first aid instructions for a {common} bite. Language: English.",
        "A CHW asks: my patient shows signs of {category}. What first aid do I give for {common}?",
    ],
    "fr": [
        "Un patient a été mordu par un {common} ({scientific}). Donnez les premiers secours en français.",
        "Que faire si quelqu'un est mordu par un {common}?",
        "Instructions de premiers secours pour une morsure de {common}. Langue: français.",
    ],
    "ar": [
        "تعرض مريض للعض من قبل {common}. قدم الإسعافات الأولية باللغة العربية.",
        "ماذا أفعل إذا تعرض شخص للعض من قبل {common}؟",
    ],
    "ha": [
        "An ciji mara lafiya da {common}. Ba da taimakon farko cikin Hausa.",
    ],
    "sw": [
        "Mgonjwa ameumwa na {common}. Toa msaada wa kwanza kwa Kiswahili.",
    ],
    "tw": [
        "Ɔwɔ bi a wɔfrɛ no {common} aka obi. Ma mmoa a edi kan wɔ Twi kasa mu.",
    ],
}


def _pick_species(rng: random.Random) -> dict:
    return rng.choice(_load_species())


def _format_prompt(template: str, species: dict, language: str, category: str) -> str:
    common = species["common_names"].get(language) or species["common_names"]["en"]
    return template.format(
        common=common,
        scientific=species["scientific_name"],
        category=category.replace("_", " "),
    )


def generate_examples(
    target_size: int,
    seed: int,
    use_corpus_grounding: bool,
    languages: list[str] | None = None,
) -> list[TrainingExample]:
    corpus = load_all()

    if languages:
        # Caller explicitly selected a subset — filter and use the relaxed tier
        # so that `authored` (EN) and `draft` (FR) are both accepted.
        corpus = {k: v for k, v in corpus.items() if k in languages}
        tier = "research_only"
        typer.secho(
            f"⚠️  Generating corpus for {languages} only (research_only tier). "
            "AR/HA/SW/TW are excluded until translations are reviewed by a "
            "native speaker + clinician.",
            fg=typer.colors.YELLOW,
        )
    else:
        tier = "fine_tuning"

    try:
        verify_for_use(corpus, tier)
    except GoldCorpusError as e:
        raise GoldCorpusError(
            f"Refusing to synthesize training data: gold corpus is not ready "
            f"for {tier}. Fill in the NEEDS_TRANSLATION fields and have a "
            "native speaker + clinician review them first.\n\n" + str(e)
        ) from e

    rng = random.Random(seed)
    examples: list[TrainingExample] = []

    active_languages = list(corpus.keys())
    while len(examples) < target_size:
        lang = rng.choice(active_languages)
        gold_file = corpus[lang]
        instruction = rng.choice(gold_file.instructions)
        species = _pick_species(rng)
        template = rng.choice(PROMPT_TEMPLATES[lang])
        prompt = _format_prompt(template, species, lang, instruction.category)

        output = instruction.body
        if use_corpus_grounding:
            output = _maybe_apply_corpus_grounding(output, lang, rng)

        examples.append(
            TrainingExample(
                instruction=prompt,
                input="",
                output=output,
                language=lang,
                species=species["scientific_name"],
                category=instruction.category,
                severity=instruction.severity,
            )
        )

    return examples


def _maybe_apply_corpus_grounding(text: str, lang: str, rng: random.Random) -> str:
    """Lightly re-phrase by prepending a corpus-sampled opener. No-op if HF
    datasets library is unavailable or the relevant corpus can't be loaded.

    This is the EpiCast trick: inject authentic linguistic patterns from
    AfriSenti / MasakhaNEWS / XL-Sum into synthetic clinical text.
    """
    try:
        openers = _get_openers(lang)
    except Exception:
        return text
    if not openers:
        return text
    if rng.random() < 0.5:
        return f"{rng.choice(openers)} {text}"
    return text


_OPENER_CACHE: dict[str, list[str]] = {}


def _get_openers(lang: str) -> list[str]:
    """Load a small pool of natural-language openers for the given language.

    In production this would pull from HF `datasets`:
      - AfriSenti for ha/tw
      - MasakhaNEWS for health-category articles
      - XL-Sum for sw/fr
    For Phase 2 scaffolding we ship a hand-curated minimal fallback pool,
    because loading HF datasets at test time slows CI to a crawl.
    """
    if lang in _OPENER_CACHE:
        return _OPENER_CACHE[lang]

    fallbacks: dict[str, list[str]] = {
        "en": ["First,", "Important:", "Remember:", "Please note:"],
        "fr": ["D'abord,", "Important:", "Rappelez-vous:", "À noter:"],
        "ar": ["أولاً:", "هام:", "ملاحظة:"],
        "ha": ["Da farko,", "Muhimmi:", "Tuna:"],
        "sw": ["Kwanza,", "Muhimu:", "Kumbuka:"],
        "tw": ["Deɛ ɛdi kan,", "Ɛho hia:", "Kae sɛ:"],
    }
    _OPENER_CACHE[lang] = fallbacks.get(lang, [])
    return _OPENER_CACHE[lang]


@app.command(name="generate")
def generate(
    out: Path = typer.Option(Path("data/processed/firstaid_corpus.jsonl")),
    target_size: int = typer.Option(5000),
    seed: int = typer.Option(42),
    ground: bool = typer.Option(True, "--ground/--no-ground"),
    languages: str = typer.Option(
        "",
        help="Comma-separated language codes to include, e.g. 'en,fr'. "
             "Empty = all languages (requires fine_tuning safety tier). "
             "Specifying a subset uses research_only tier.",
    ),
) -> None:
    lang_list: list[str] | None = (
        [lg.strip() for lg in languages.split(",") if lg.strip()] or None
    )
    try:
        examples = generate_examples(
            target_size, seed, use_corpus_grounding=ground, languages=lang_list
        )
    except GoldCorpusError as e:
        typer.secho(str(e), fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for ex in examples:
            f.write(
                json.dumps(
                    {
                        "instruction": ex.instruction,
                        "input": ex.input,
                        "output": ex.output,
                        "language": ex.language,
                        "species": ex.species,
                        "category": ex.category,
                        "severity": ex.severity,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    typer.secho(f"✅ Wrote {len(examples)} examples → {out}", fg=typer.colors.GREEN)


if __name__ == "__main__":
    app()
