# Code of Conduct

IshVenom is a project built for community health workers and snakebite victims
across sub-Saharan Africa.  The people this project serves are already in
vulnerable situations.  That context shapes how we expect everyone who
contributes — in any form — to behave.

---

## Our standards

We are committed to a welcoming, respectful, and harassment-free environment.
Expected behaviour includes:

- Using inclusive, patient, and precise language
- Respecting differing medical, technical, and cultural perspectives
- Giving and receiving constructive feedback gracefully
- Prioritising the safety and privacy of end-users above all else
- Acknowledging and correcting your own mistakes

Unacceptable behaviour includes:

- Harassment, discrimination, or personal attacks of any kind
- Publishing others' private information without explicit consent
- Dismissing or mocking the medical or linguistic needs of the communities
  this project serves
- Introducing code that degrades the safety, privacy, or accuracy of the
  triage flow — deliberately or negligently

---

## Patient data

All contributors must understand and respect these non-negotiable constraints:

- **Photos never leave the device without explicit user consent.**  The on-device pipeline is designed so identification can happen with zero network calls.
- **GPS is coarsened before transmission.**  Coordinates are truncated to district-centroid precision before any encounter record is uploaded.
- **Encounter uploads are anonymised.**  No user identity, email, name, or raw coordinates appear in any transmitted payload.
- **Model outputs are medical information.**  Do not alter, downgrade, or remove first-aid content without clinical review.

---

## Enforcement

Instances of unacceptable behaviour may be reported by:

1. Opening a **private security advisory** on this repository (GitHub → Security → Advisories) — this keeps the report confidential.
2. Contacting the maintainer directly via the email listed on the GitHub profile.

All reports will be reviewed and responded to within 7 days.  The maintainer
reserves the right to remove, edit, or reject contributions that violate this
Code of Conduct, and to ban contributors from the project.

---

## Scope

This Code of Conduct applies to all project spaces — GitHub issues, pull
requests, discussions, and any other forum where IshVenom is represented.
It also applies when an individual is representing the project in public spaces.

---

This project adopts the spirit and principles of the
[Contributor Covenant 2.1](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
and extends it with the patient-safety context specific to this project.
