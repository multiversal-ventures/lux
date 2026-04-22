# OpenAPI codegen (`@fenero/lux-core`)

## Source

- **Default input**: `./openapi.json` at the repo root (not committed; export from Veritas when available).
- **Alternatives** (see [scripts/codegen.mjs](../scripts/codegen.mjs)):
  - `pnpm codegen --url https://veritas-host/openapi.json`
  - `pnpm codegen /path/to/spec.json`
  - `VERITAS_OPENAPI=https://... pnpm codegen`

Output is always `packages/core/src/generated.ts`.

## Veritas vs Gunnr HTTP paths

The committed `generated.ts` describes the **Veritas** composable API (paths like `/cases/{case_id}/status`, `/portal/session`).

The **dashboard** (`apps/dashboard`) calls the **Gunnr** HTTP API with a **`/api/v1`** prefix and different path shapes (e.g. `/api/v1/case/{id}/status`). Those endpoints are **not** represented in the current OpenAPI file in this repo.

| Surface | Role |
|--------|------|
| `generated.ts` | Portal/session, composable Veritas types; use for portal and future alignment. |
| `gunnr-api.ts` + `VeritasClient` | Typed Gunnr REST client used by the LO dashboard today. |

When Veritas and Gunnr converge on one OpenAPI spec, regenerate and gradually replace hand-maintained Gunnr paths with `paths` / `operations` from `generated.ts`.

## Missing from spec (track with backend)

Hand-typed in Lux until the spec includes them (non-exhaustive):

- GCS direct upload (`prepare-upload`, signed URL upload, `start`)
- RFC 6902 `PATCH` case mutation
- Bank statement review / AI review (`/ai/review/...`)
- Income advisor status under `/api/...` (non-`/api/v1`)
- AUE (`apps/dashboard` [useAueApi.ts](../apps/dashboard/src/hooks/useAueApi.ts)) — separate base URL; stays app-level until documented.
