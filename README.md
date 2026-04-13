# Lux

Composable frontend SDK and component library for Veritas. Truth, rendered.

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
Composable APIs        →       @fenero/lux-core     (API client, session, types)
SDUI display_hints     →       @fenero/lux-react    (component registry, pre-built UI)
Design tokens          →       @fenero/lux-themes   (CSS custom properties)
                               apps/portal          (reference borrower portal)
```

## Structure

```
lux/
├── packages/
│   ├── core/                  API client, session management, TypeScript types
│   │   └── src/
│   │       ├── client.ts        Veritas HTTP client (envelope-aware)
│   │       ├── session.ts       VeritasSession (token → composed state)
│   │       ├── types.ts         Generated from Veritas OpenAPI spec
│   │       ├── events.ts        SSE / polling for live updates
│   │       └── index.ts
│   │
│   ├── react/                 React component library
│   │   └── src/
│   │       ├── SessionProvider.tsx   React context for VeritasSession
│   │       ├── Checklist.tsx         Renders findings as actionable items
│   │       ├── FileUpload.tsx        Secure document upload (portal-token auth)
│   │       ├── ConsentForm.tsx       TCPA/GLBA consent toggles
│   │       ├── StatusCard.tsx        Case state + progress
│   │       ├── DocumentViewer.tsx    PDF with extraction highlights
│   │       ├── registry.ts          display_hints.component → React component
│   │       └── index.ts
│   │
│   └── themes/                Design tokens and CSS
│       ├── default.css
│       ├── dark.css
│       └── tokens.ts
│
├── apps/
│   └── portal/                Reference borrower portal (Next.js)
│       └── src/
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

## How It Works

### 1. Session-first API

One call returns everything the UI needs:

```typescript
import { VeritasSession } from '@fenero/lux-core'

const session = await VeritasSession.create({ token: 'portal_token_uuid' })
// session.entity       → { name, role, identity_id }
// session.checklist    → [{ title, detail, action, display_hints }]
// session.consent      → { sms_opt_in, doc_sharing }
// session.uploadConfig → { endpoint, maxSize, acceptedTypes }
```

### 2. Server-driven component registry

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

### 3. Intents

User operations flow through `session.intent()` — a single method for
all interactions. One intent or many in a batch, same method:

```typescript
// Single intent
await session.intent({ type: 'consent', params: { consent_type: 'doc_sharing', granted: true } })

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
pnpm install
pnpm dev          # Start portal dev server
pnpm build        # Build all packages
pnpm test         # Run tests across workspace
```

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
