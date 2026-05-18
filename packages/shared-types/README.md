# @ishvenom/shared-types

Canonical Zod schemas and TypeScript types shared across the IshVenom monorepo.

**Every** request body, response, and cross-package data shape lives here. If you're about to define a type in `apps/mobile` or `services/api` that will cross a boundary — stop and add it here first.

## Usage

```ts
import { EncounterCreateSchema, type EncounterCreate } from '@ishvenom/shared-types';

const body = EncounterCreateSchema.parse(req.body);
```

## Philosophy
- Zod schemas are the source of truth.
- TypeScript types are `z.infer<typeof Schema>`.
- Never hand-write a type that could be derived from a schema.
