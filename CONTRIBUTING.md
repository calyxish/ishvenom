# Contributing to IshVenom

During the active hackathon period this repo is a solo submission.  After
submission, issues and PRs are open and welcome.  Either way the same
version-control workflow applies.

---

## Table of contents

1. [Development setup](#development-setup)
2. [Version-control workflow](#version-control-workflow)
3. [Branch naming](#branch-naming)
4. [Commit messages](#commit-messages)
5. [Pull requests](#pull-requests)
6. [Merge strategy](#merge-strategy)
7. [Rules](#rules)

---

## Development setup

```bash
git clone https://github.com/calyxish/ishvenom.git
cd ishvenom

# Install all workspace dependencies (Node 20 + pnpm 9 required)
pnpm install

# Backend — copy env, generate Prisma client, run migrations, start dev server
cp services/api/.env.example services/api/.env
# Fill in DATABASE_URL and DIRECT_URL from Neon, SESSION_SECRET (32+ chars)
pnpm --filter @ishvenom/api prisma:generate
pnpm --filter @ishvenom/api prisma:migrate
pnpm --filter @ishvenom/api dev          # listens on :4000

# Dashboard — copy env, start dev server
cp apps/dashboard/.env.example apps/dashboard/.env.local
# Set NEXT_PUBLIC_API_BASE=http://localhost:4000/api/v1
pnpm --filter @ishvenom/dashboard dev    # listens on :3000

# Mobile — copy env, start Expo dev server
cp apps/mobile/.env.example apps/mobile/.env
# Set EXPO_PUBLIC_GOOGLE_AI_KEY from https://aistudio.google.com/app/apikey
pnpm --filter ishvenom dev
```

Type-check everything: `pnpm run check`

---

## Version-control workflow

Every change follows this loop, no exceptions — even solo work.

```
open issue → branch → commits → push → PR → review → merge → delete branch
```

### Step-by-step

1. **Open an issue** for the unit of work before writing any code.

   ```bash
   gh issue create --title "feat: short description" --body "..."
   # Returns: https://github.com/calyxish/ishvenom/issues/N
   ```

2. **Create a branch** from `main` using the semantic naming rules below.

   ```bash
   git checkout main && git pull
   git checkout -b feat/short-description
   ```

3. **Make logical commits** inside the branch — one commit per coherent
   sub-change.  Stage only the files that belong to that commit.

   ```bash
   git add src/lib/gemma.ts src/lib/gemmaLearn.ts
   git commit -m "feat(gemma): add extractText helper for thought-token skipping" \
              -m "Gemma 4 returns an empty thought part before the real answer.
   Always grab the last non-thought part with content." \
              -m "Refs #N"
   ```

4. **Push** and open a PR.

   ```bash
   git push -u origin feat/short-description
   gh pr create --base main --head feat/short-description \
     --title "feat: short description" \
     --body "Closes #N ..."
   ```

5. **Review the PR** on GitHub before merging.

6. **Merge** with `--merge` (preserves commit history) or `--squash`
   (for trivial single-fix PRs).  Always `--delete-branch`.

   ```bash
   gh pr merge N --merge --delete-branch
   git checkout main && git pull
   git branch -D feat/short-description
   ```

7. **Verify** the issue auto-closed:

   ```bash
   gh issue view N --json state -q .state
   # → "CLOSED"
   ```

---

## Branch naming

Branch names **must not contain the issue number**.  Use semantic prefixes:

| Prefix | When to use |
|---|---|
| `feat/` | New feature or capability |
| `fix/` | Bug fix |
| `chore/` | Build, config, dependency, or tooling change |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring with no behaviour change |
| `test/` | Adding or fixing tests |
| `polish/` | UI/UX polish, accessibility, minor visual tweaks |
| `ml/` | Model training, data pipeline, or evaluation changes |
| `data/` | Dataset or corpus changes |

Examples: `feat/on-device-gemma`, `fix/oom-crash-handler`, `chore/render-deploy`, `docs/deployment-guide`

---

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): imperative summary under 72 chars

Optional body — explain WHY, not what. Wrap at 72 chars.
Non-obvious mechanics go here.

Refs #N
```

**Types:** `feat` · `fix` · `chore` · `refactor` · `docs` · `test` · `ml` · `data`

**Scopes:** `api` · `dashboard` · `mobile` · `gemma` · `vision` · `shared-types` · `ml` · `env` · `gitignore` · `deps`

Rules:
- Summary is **imperative mood**, lowercase after the colon (`add`, not `adds` / `added`)
- No period at the end of the summary line
- Body explains **why**, not what (the diff already shows what)
- `Refs #N` in commits, `Closes #N` in PR body (not in commits)

---

## Pull requests

Every PR body must contain:

```markdown
Closes #N

## What changed
Brief description of the change.

## Commits
| Commit | What |
|---|---|
| `abc1234` | `feat(scope): summary` |

## Test plan
- [ ] Checkbox item 1
- [ ] Checkbox item 2
```

Keep the PR scoped to one issue.  Do not bundle unrelated changes.

---

## Merge strategy

| Scenario | Strategy |
|---|---|
| Branch has multiple meaningful commits | `gh pr merge N --merge --delete-branch` |
| Trivial single-fix PR | `gh pr merge N --squash --delete-branch` |
| Experimental / needs rebase | Rebase locally, then merge |

Default to `--merge`.  Never force-push to `main`.

---

## Rules

1. **No direct commits to `main`** — everything goes through a PR.
2. **No `git add -A` or `git add .`** — stage only the files for each logical commit.
3. **No `--no-verify`** — fix the hook failure instead of skipping it.
4. **No force-push** to `main` or any branch shared with others.
5. **Shared types** live in `packages/shared-types` — never duplicate a Zod schema.
6. **Offline-first** — the mobile triage flow must work with airplane mode on.
7. **Tests required** for new API routes, services, and ML pipelines.
8. **One active PR at a time** per contributor — finish before opening another.

---

## Reporting vulnerabilities

See [`SECURITY.md`](./SECURITY.md) — do not open public issues for security reports.
