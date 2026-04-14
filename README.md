# Lux

Composable frontend SDK and component library for [Veritas](https://github.com/multiversal-ventures/veritas). Truth, rendered.

## What It Does

Lux is the rendering layer for the Veritas mortgage processing platform.
Loan officers, borrowers, partners, and agents all interact with Veritas
through Lux — a typed API client, pre-built React components, and a
server-driven component registry that renders what the spec engine decides.

When Veritas adds a new qualification finding, Lux renders it automatically.
No frontend deployment needed.

## Principles

- Veritas is the truth. Lux is the light. Lux never stores business state.
- Components render from server responses, not local logic.
- The spec drives the UI. Finding codes map to components. New spec → new UI.
- One SDK, many consumers. Borrower portal, LO dashboard, partner embed — same packages.
- Theming is CSS custom properties, not component forks.
- Every user action flows back to Veritas as a typed API call with audit trail.
- If Veritas is down, Lux shows a status page. It does not cache or guess.

## Architecture

```
Veritas (backend)              Lux (frontend)
─────────────────              ──────────────
Composable APIs        →       @fenero/lux-core     (generated types; client planned)
SDUI display_hints     →       @fenero/lux-react    (component registry; planned)
Design tokens          →       @fenero/lux-themes   (CSS custom properties)
                               apps/portal          (reference borrower portal, Vite)
                               apps/dashboard       (LO dashboard, Vite + Firebase)
```

## Structure

```
lux/
├── packages/
│   ├── core/                  TypeScript types generated from Veritas OpenAPI spec
│   │   └── src/
│   │       ├── generated.ts     Auto-generated types (pnpm codegen)
│   │       └── index.ts         Re-exports paths, components, operations
│   │                            [planned: client.ts, session.ts, events.ts]
│   │
│   ├── react/                 React component library (in progress)
│   │   └── src/
│   │       └── index.ts         Empty — components being built
│   │                            [planned: SessionProvider, Checklist, FileUpload,
│   │                             ConsentForm, StatusCard, registry]
│   │
│   └── themes/                Design tokens and CSS custom properties
│       ├── globals.css          Base reset and variables
│       ├── default.css          Light theme tokens
│       └── dark.css             Dark theme tokens
│
├── apps/
│   ├── portal/                Reference borrower portal (Vite + React)
│   ├── dashboard/             Loan officer dashboard (Vite + React + Firebase auth)
│   └── storybook/             Component showcase (Storybook 8)
│
├── turbo.json
├── package.json               Workspace root (Turborepo)
├── tsconfig.base.json
└── biome.json
```

## Packages

| Package | npm | Who uses it |
|---------|-----|-------------|
| `@fenero/lux-core` | API client, session, types | Everyone — React, Vue, vanilla JS, agents |
| `@fenero/lux-react` | Components, SessionProvider, registry | React frontends |
| `@fenero/lux-themes` | CSS custom properties, design tokens | Anyone who wants Fenero styling |

## How It Works (Target Architecture)

The SDK is under active development. The patterns below describe the
intended API once `@fenero/lux-core` and `@fenero/lux-react` are built out.
Current state: types are generated and exported from `@fenero/lux-core`;
React components are not yet implemented.

### 1. Session-first API (planned)

One call returns everything the UI needs:

```typescript
import { VeritasSession } from '@fenero/lux-core'

const session = await VeritasSession.create({ token: 'portal_token_uuid' })
// session.entity       → { name, role, identity_id }
// session.checklist    → [{ title, detail, action, display_hints }]
// session.consent      → { sms_opt_in, doc_sharing }
// session.uploadConfig → { endpoint, maxSize, acceptedTypes }
```

### 2. Server-driven component registry (planned)

Veritas returns `display_hints.component` on each checklist item.
Lux maps it to a React component:

```tsx
import { SessionProvider, Checklist, FileUpload } from '@fenero/lux-react'

function Portal({ token }) {
  return (
    <SessionProvider token={token}>
      <Checklist />   {/* Renders from session.checklist + display_hints */}
      <FileUpload />  {/* Configured from session.uploadConfig */}
    </SessionProvider>
  )
}
```

### 3. Intents (planned)

User operations flow through `session.intent()` — a single method for
all interactions. One intent or many in a batch, same method:

```typescript
// Batch — multiple intents in one round-trip
await session.intent([
  { type: 'consent', params: { consent_type: 'sms_opt_in', granted: true } },
  { type: 'upload', params: { files: [file] } },
])
// Returns refreshed session state
```

Intent types are **generated from the Veritas OpenAPI spec**, versioned
by `Veritas-Version` header. Lux doesn't define what intents exist —
Veritas does. When the backend adds a new intent type, `pnpm codegen`
updates the TypeScript union. The SDK never gates what the server accepts.

## Quick Start

```bash
git clone git@github.com:fenero/lux.git
cd lux && git checkout release/0.0.1

pnpm install
pnpm dev          # Start portal dev server
pnpm build        # Build all packages
pnpm test         # Run tests across workspace
```

## Dashboard (apps/dashboard)

The LO dashboard is the multi-tenant operator UI. It talks to a local
Veritas backend via a Vite proxy on `/api/v1/*`. Bring Veritas up first
(see [`../veritas/README.md`](../veritas/README.md)), then:

```bash
cp apps/dashboard/.env.example apps/dashboard/.env
# edit apps/dashboard/.env — fill in your VITE_FIREBASE_* values
pnpm --filter dashboard dev
```

Dashboard runs on `http://localhost:3332`. The Vite proxy forwards
`/api/v1/*` → `http://localhost:8000` and auto-injects Firebase JWKS,
audience, and issuer headers, so the backend does not need JWT env
vars for local development.

### Joining an organization (first sign-in)

New users don't self-register into a tenant — an admin issues them an
invite code. After signing in with magic link for the first time:

1. You'll see a **"Join an Organization"** screen.
2. Paste the invite code your admin sent (e.g. `lux-A7K2-QPMR`).
3. Click **Join**. The dashboard reloads into your tenant.

If the screen persists after a valid code, check that the backend is
running and that `VITE_FIREBASE_PROJECT_ID` is set — without it the
proxy can't verify your token and `/auth/me` returns 500.

Admins issue, list, and revoke codes via the Veritas CLI — see
[`../veritas/README.md`](../veritas/README.md).

## OpenAPI Codegen

Lux types are generated from the Veritas OpenAPI spec. The spec file
(`openapi.json`) is the contract between repos.

```bash
# Step 1: Export from Veritas (run in veritas repo)
veritas api export --openapi -o ../lux/openapi.json

# Step 2: Generate TypeScript types (run in lux repo)
pnpm codegen
# → writes packages/core/src/generated.ts from openapi.json
```

Generated types include all request/response shapes, intent types,
session fields, and checklist items. When Veritas adds a new endpoint
or intent type, re-run both steps to pick it up. No manual type
maintenance — the spec is the single source of truth.

## Related Repos

```
fenero/
├── veritas/        Backend: APIs, spec engine, extraction, Temporal orchestration
└── lux/            ← you are here (frontend SDK + components)
```

Lux is a **pure client** of the Veritas API. It has zero server-side
business logic. The boundary is absolute:

```
Veritas decides WHAT to show    →    Lux decides HOW to show it
Veritas owns data + audit       →    Lux owns rendering + interaction
Veritas returns display_hints   →    Lux resolves them to components
```

The dependency is one-directional: Lux depends on Veritas, never the reverse.

- **API contract**: `veritas/docs/superpowers/specs/2026-04-13-composable-api-surface-design.md`
- **Type generation**: Lux runs `pnpm codegen` against the Veritas OpenAPI spec to generate
  `@fenero/lux-core` types (session, intents, envelope). When Veritas adds a new intent type
  or finding code, Lux picks it up on next codegen — no manual type maintenance.
- **API versioning**: Lux pins to a `Veritas-Version` header. Upgrading means bumping the
  version string and regenerating types. Veritas guarantees backward compatibility within
  a version.
