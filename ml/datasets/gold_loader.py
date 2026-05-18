"""Gold first-aid corpus loader and verifier.

Loads the 6 per-language instruction files from ml/datasets/gold/ and validates
that every instruction is fully translated and every file has a verification
status compatible with the caller's safety requirements.

This is the gate that prevents fine-tuning on unverified medical content.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

GOLD_DIR = Path(__file__).parent / "gold"
LANGUAGES: tuple[str, ...] = ("en", "fr", "ar", "ha", "sw", "tw")
REQUIRED_INSTRUCTION_COUNT = 30
NEEDS_TRANSLATION_MARKER = "NEEDS_TRANSLATION"


class VerificationStatus(str, Enum):
    STUB = "stub_needs_full_human_translation"
    DRAFT = "draft_needs_native_speaker_and_clinical_review"
    AUTHORED = "authored_by_project_lead_needs_clinical_review"
    NATIVE_REVIEWED = "native_speaker_reviewed_needs_clinical_review"
    VERIFIED = "fully_verified"


# Minimum verification tier acceptable for a given use case.
SAFETY_TIERS: dict[str, set[VerificationStatus]] = {
    "research_only": {
        VerificationStatus.AUTHORED,
        VerificationStatus.DRAFT,
        VerificationStatus.NATIVE_REVIEWED,
        VerificationStatus.VERIFIED,
    },
    "fine_tuning": {
        VerificationStatus.NATIVE_REVIEWED,
        VerificationStatus.VERIFIED,
    },
    "production_release": {
        VerificationStatus.VERIFIED,
    },
}


@dataclass(frozen=True)
class Instruction:
    id: str
    category: str
    severity: str
    title: str
    body: str


@dataclass(frozen=True)
class GoldFile:
    language: str
    version: str
    verification_status: VerificationStatus
    instructions: tuple[Instruction, ...]

    @property
    def unfilled_count(self) -> int:
        return sum(
            1
            for ins in self.instructions
            if ins.title == NEEDS_TRANSLATION_MARKER or ins.body == NEEDS_TRANSLATION_MARKER
        )

    @property
    def is_fully_translated(self) -> bool:
        return self.unfilled_count == 0


class GoldCorpusError(Exception):
    """Raised when the gold corpus fails validation."""


def load_gold_file(path: Path) -> GoldFile:
    data = json.loads(path.read_text(encoding="utf-8"))

    if len(data.get("instructions", [])) != REQUIRED_INSTRUCTION_COUNT:
        raise GoldCorpusError(
            f"{path.name}: expected {REQUIRED_INSTRUCTION_COUNT} instructions, "
            f"got {len(data.get('instructions', []))}"
        )

    try:
        status = VerificationStatus(data["verification_status"])
    except (KeyError, ValueError) as exc:
        raise GoldCorpusError(f"{path.name}: invalid verification_status") from exc

    instructions = tuple(
        Instruction(
            id=item["id"],
            category=item["category"],
            severity=item["severity"],
            title=item["title"],
            body=item["body"],
        )
        for item in data["instructions"]
    )

    return GoldFile(
        language=data["language"],
        version=data["version"],
        verification_status=status,
        instructions=instructions,
    )


def load_all(gold_dir: Path = GOLD_DIR) -> dict[str, GoldFile]:
    result: dict[str, GoldFile] = {}
    for lang in LANGUAGES:
        path = gold_dir / f"instructions.{lang}.json"
        if not path.exists():
            raise GoldCorpusError(f"Missing gold file for language '{lang}': {path}")
        result[lang] = load_gold_file(path)
    return result


def verify_for_use(
    corpus: dict[str, GoldFile],
    use_case: str,
) -> None:
    """Raise GoldCorpusError if corpus is not safe for the given use case.

    use_case in {'research_only', 'fine_tuning', 'production_release'}.
    """
    if use_case not in SAFETY_TIERS:
        raise ValueError(f"Unknown use_case: {use_case}")

    acceptable = SAFETY_TIERS[use_case]
    failures: list[str] = []

    for lang, gf in corpus.items():
        if not gf.is_fully_translated:
            failures.append(
                f"  - [{lang}] {gf.unfilled_count}/{REQUIRED_INSTRUCTION_COUNT} instructions still unfilled"
            )
            continue
        if gf.verification_status not in acceptable:
            failures.append(
                f"  - [{lang}] verification_status={gf.verification_status.value} "
                f"not acceptable for use_case={use_case!r}"
            )

    if failures:
        raise GoldCorpusError(
            f"Gold corpus is NOT safe for {use_case!r}:\n" + "\n".join(failures)
        )
