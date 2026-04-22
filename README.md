# Lux

Composable frontend SDK for Veritas. Truth, rendered.

## What It Does

Lux is the rendering SDK for the Veritas mortgage processing platform.
Loan officers, borrowers, partners, and agents interact with Veritas
through Lux — a typed API client, an auth-provider abstraction, a session
primitive, and (today) a thin React glue layer.

Lux is product-agnostic. Customer apps (e.g. Gunnr's LO dashboard, the
borrower portal) live in their own repos and consume `@fenero/lux-*` as
versioned packages.

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
Veritas (backend)              Lux (frontend SDK)
─────────────────              ──────────────────
Composable APIs        →       @fenero/lux-core     (HTTP client, auth, session, SSE, OpenAPI types)
SDUI display_hints     →       @fenero/lux-react    (SessionProvider + hooks; component registry planned)
Design tokens          →       @fenero/lux-themes   (CSS custom properties)

                               apps/dashboard       (minimal SDK sample — not a product)
                               apps/portal          (reference borrower portal)

Customer apps (live elsewhere)
──────────────────────────────
gunnr/ui                       LO dashboard — consumes @fenero/lux-* via npm/file:
```

## Structure

```
lux/
├── packages/
│   ├── core/                  @fenero/lux-core — Veritas SDK primitives
│   │   └── src/
│   │       ├── client.ts        VeritasClient (Bearer + Veritas-Version)
│   │       ├── auth.ts          AuthProvider abstraction (+ Firebase / portal-token helpers)
│   │       ├── runtime.ts       initLux / getDefaultClient / getLuxToken
│   │       ├── session.ts       VeritasSession (tenant, active case, SSE attach/detach)
│   │       ├── events.ts        CaseSseTransport for `/api/v1/stream/:caseId`
│   │       ├── generated.ts     Veritas OpenAPI types (`pnpm codegen`)
│   │       └── index.ts
│   │
│   ├── react/                 @fenero/lux-react — React glue (no feature widgets yet)
│   │   └── src/
│   │       ├── SessionProvider.tsx
│   │       ├── useSession.ts / useAuth.ts / useCase.ts / useEvents.ts
│   │       └── index.ts
│   │
│   └── themes/                Design tokens and CSS
│       ├── default.css
│       ├── dark.css
│       └── tokens.ts
│
├── apps/
│   ├── dashboard/             Minimal SDK sample (`@fenero/lux-sample-dashboard`)
│   └── portal/                Reference borrower portal (Vite)
│
├── dist-pack/                 Local tarballs for file: linking into customer repos
├── turbo.json
├── package.json               Workspace root (Turborepo + pnpm)
├── tsconfig.base.json
└── biome.json
```

Product-specific code (Gunnr REST methods, intent maps, phase configs) is
**not** in this repo. It lives in the consumer (`gunnr/ui`) and consumes
the SDK primitives below.

## Packages

| Package | What's in it | Who uses it |
|---------|--------------|-------------|
| `@fenero/lux-core` | `VeritasClient`, `initLux`, `VeritasSession`, `CaseSseTransport`, OpenAPI types | Everyone — React, Vue, vanilla JS, agents |
| `@fenero/lux-react` | `SessionProvider`, `useSession` / `useAuth` / `useCase` / `useEvents` | React frontends |
| `@fenero/lux-themes` | CSS custom properties, design tokens | Anyone who wants Fenero styling |

## How It Works

### 1. Bootstrap

```ts
import { initLux, createFirebaseAuthProvider } from '@fenero/lux-core'

initLux({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  auth: createFirebaseAuthProvider(() => getFirebaseAuth()),
  hooks: {
    onApiError: (info) => myErrorTracker(info),
  },
})
```

Static portal tokens use `PortalTokenAuthProvider` with the same
`VeritasClient` / `VeritasSession` pattern. Customers may implement any
`AuthProvider` they like.

### 2. React shell

```tsx
import { SessionProvider, useSession } from '@fenero/lux-react'

function App() {
  return (
    <SessionProvider firebaseAuth={() => getFirebaseAuth()}>
      <Header />
    </SessionProvider>
  )
}
```

`firebaseAuth` is optional — only required if your app calls `useAuth`.

### 3. HTTP calls

```ts
import { getDefaultClient } from '@fenero/lux-core'

const data = await getDefaultClient().requestJson<Foo>('/api/v1/some-endpoint')
```

Customer apps wrap this in their own typed API layer (e.g. `gunnr/ui` has
`src/lib/lux-gunnr/`). Lux itself ships **no** product-specific endpoint
methods.

## Quick Start

```bash
pnpm install
pnpm --filter @fenero/lux-core build
pnpm --filter @fenero/lux-react build
pnpm --filter @fenero/lux-sample-dashboard dev   # http://localhost:3332
```

## Linking into a customer repo (local dev)

```bash
# In lux/
pnpm --filter @fenero/lux-core pack --pack-destination ./dist-pack
pnpm --filter @fenero/lux-react pack --pack-destination ./dist-pack

# In customer/ui/package.json
"dependencies": {
  "@fenero/lux-core":  "file:../../lux/dist-pack/fenero-lux-core-0.0.1.tgz",
  "@fenero/lux-react": "file:../../lux/dist-pack/fenero-lux-react-0.0.1.tgz"
}
```

`pnpm pack` rewrites `workspace:*` deps to concrete versions, so plain
`npm install` in the consumer works.

## Related Repos

```
fenero/
├── veritas/        Backend: APIs, spec engine, extraction, Temporal orchestration
├── lux/            ← you are here (SDK)
└── gunnr/          Customer product (LO dashboard) — consumes lux/
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
  `@fenero/lux-core` types. When Veritas changes, Lux picks it up on next codegen.
- **API versioning**: Lux pins to a `Veritas-Version` header. Upgrading means bumping the
  version string and regenerating types.
