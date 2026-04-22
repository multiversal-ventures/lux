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
                               apps/dashboard       (LO dashboard — consumes core + react)
                               apps/portal          (reference borrower portal)
```

## Structure

```
lux/
├── packages/
│   ├── core/                  @fenero/lux-core — HTTP client, Gunnr API surface, session, intents, SSE transport
│   │   └── src/
│   │       ├── client.ts        VeritasClient (Bearer + Veritas-Version)
│   │       ├── auth.ts          AuthProvider + Firebase / portal token helpers
│   │       ├── runtime.ts       initLux / getDefaultClient / getLuxToken
│   │       ├── gunnr-api.ts     Typed Gunnr REST (dashboard today)
│   │       ├── gunnr-types.ts   Shared DTOs (+ re-export `@fenero/lux-core/gunnr-types`)
│   │       ├── session.ts       VeritasSession (tenant, active case name, intent, SSE attach)
│   │       ├── intents.ts       dispatchLuxIntent — maps to gunnr-api calls
│   │       ├── events.ts        CaseSseTransport for `/api/v1/stream/:caseId`
│   │       ├── generated.ts     Veritas OpenAPI types (`pnpm codegen`)
│   │       └── index.ts
│   │
│   ├── react/                 @fenero/lux-react — thin React glue (no feature widgets yet)
│   │   └── src/
│   │       ├── SessionProvider.tsx
│   │       ├── useSession.ts / useAuth.ts / useIntent.ts / useCase.ts / useEvents.ts
│   │       └── index.ts
│   │
│   └── themes/                Design tokens and CSS
│       ├── default.css
│       ├── dark.css
│       └── tokens.ts
│
├── apps/
│   ├── dashboard/             LO dashboard (Vite) — `initLux` + SessionProvider + `@fenero/lux-core` API
│   └── portal/                Reference borrower portal (Vite)
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
| `@fenero/lux-react` | SessionProvider, `useSession` / `useAuth` / `useIntent` / `useEvents` (display_hints UI planned) | React frontends |
| `@fenero/lux-themes` | CSS custom properties, design tokens | Anyone who wants Fenero styling |

## How It Works

### 1. Bootstrap the HTTP client (dashboard)

```typescript
import { initLux, createFirebaseAuthProvider, VeritasSession, getDefaultClient } from '@fenero/lux-core'

initLux({
  baseUrl: import.meta.env.VITE_GUNNR_API_URL ?? '',
  auth: createFirebaseAuthProvider(() => getFirebaseAuth()),
})
const session = new VeritasSession(getDefaultClient())
// session.tenantId / tenantName — hydrated after GET /api/v1/auth/me
// session.intent({ type: 'patch_case', caseId, request }) — typed Gunnr actions
```

Static portal tokens use `PortalTokenAuthProvider` with the same `VeritasClient` / `VeritasSession` pattern.

### 2. React shell

```tsx
import { SessionProvider, useAuth } from '@fenero/lux-react'

function App() {
  return (
    <SessionProvider firebaseAuth={() => getFirebaseAuth()}>
      <Header /> {/* useAuth() → Firebase user + session tenant */}
    </SessionProvider>
  )
}
```

Server-driven `display_hints` widgets (`Checklist`, `FileUpload`, …) are not in `@fenero/lux-react` yet; the LO dashboard ships feature UI in `apps/dashboard` and uses `gunnr-api` from `@fenero/lux-core`.

### 3. Intents

User operations flow through `session.intent()` on `VeritasSession`. The
dashboard maps each `LuxIntent` to Gunnr HTTP calls today; batch calls run
serially until a Veritas batch endpoint exists.

```typescript
await session.intent({ type: 'patch_case', caseId: '…', request: { patch: [...] } })

await session.intent([
  { type: 'cancel_case', caseId: '…' },
  { type: 'delete_case', caseId: '…' },
])
```

OpenAPI-generated `paths` / `operations` in `generated.ts` describe the
**Veritas** composable API; Gunnr-specific paths stay in `gunnr-api.ts` until
the specs converge. See [docs/openapi.md](docs/openapi.md).

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
