# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.**

Instead, use one of these private channels:

1. **GitHub private advisory** — repository → Security tab → Advisories → New draft security advisory.  Only you and the maintainer can see it.
2. **Direct email** — contact address listed on the GitHub profile.

I will acknowledge within **7 days** and provide a timeline for a fix.

---

## Scope — what we care about

### High priority
- Code that handles patient-derived data: photos, GPS coordinates, language preference, clinical notes
- Authentication and session management (cookie signing, session secret validation, invite-token enforcement)
- Cryptographic operations: argon2 password hashing, session secrets, token generation
- SQL injection or Prisma query injection via encounter payloads
- Leaked API keys or secrets in source files, env examples, or commit history
- Dependency CVEs with CVSS ≥ 7.0

### Medium priority
- Missing CORS restrictions that would allow a third-party site to hit the API with a victim's session
- Encounter payloads that include user-identifiable information (raw GPS, email, device fingerprint)
- Dashboard routes that leak encounter data without authentication

### Out of scope
- Missing security headers on `localhost` dev builds
- Self-XSS
- Reports without reproduction steps
- Rate-limiting gaps on non-sensitive public endpoints

---

## Data handling commitments

These are non-negotiable constraints baked into the architecture:

| Data | How it is handled |
|---|---|
| Snake photos | Processed on-device; only shared with Gemma 4 cloud API when user invokes cloud identify. Never stored on the backend. |
| GPS coordinates | Truncated to district centroid (~10 km precision) before inclusion in any synced encounter record. Raw coordinates never leave the device. |
| Encounter records | Anonymised at source — no user identity, no email, no name, no raw coordinates. Device ID is a random UUID generated at first launch. |
| API keys | `EXPO_PUBLIC_GOOGLE_AI_KEY` is embedded in the app bundle at EAS build time. It is scoped to the Gemma API only. Rotate at `https://aistudio.google.com/app/apikey` if compromised. |
| Session secrets | Validated at API boot — the process exits if `SESSION_SECRET` is the dev default in production. |
| Dashboard passwords | Hashed with argon2id (Argon2 memory-hard KDF). Never stored in plaintext. |

---

## Supported versions

Only the latest commit on `main` is actively maintained during the hackathon period.

---

## Disclosure timeline

| Day | What happens |
|---|---|
| 0 | Report received |
| 1–7 | Acknowledgement and severity assessment |
| 7–21 | Fix developed and tested |
| 21–30 | Fix shipped to production; reporter notified |
| 30+ | Public disclosure (coordinated with reporter) |
