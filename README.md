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
- The spec drives the UI. Finding codes map to components via `display_hints`. New spec → new UI.
- One SDK, many consumers. Borrower portal, LO dashboard, partner embed — same packages.
- Components are pure renderers. Server decides what, client decides how.
- Every user action becomes a typed API call with audit trail.
- Accessibility is not optional. Every component works with screen readers and keyboard.
- Theming is CSS custom properties, not component forks or prop overrides.
- If Veritas is down, Lux shows a status page. It does not cache or guess.
- The reference portal (`apps/portal`) must be buildable entirely from published packages.
  If it reaches around `@fenero/lux-react`, the SDK has a gap.

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

Lux is a **pure client** of the Veritas API. It has zero server-side
business logic. The boundary is absolute:

```
Veritas decides WHAT to show    →    Lux decides HOW to show it
Veritas owns data + audit       →    Lux owns rendering + interaction
Veritas returns display_hints   →    Lux resolves them to components
```

The dependency is one-directional: Lux depends on Veritas, never the reverse.

## Structure

```
lux/
├── packages/
│   ├── core/                  @fenero/lux-core — Veritas SDK primitives
│   │   └── src/
│   │       ├── client.ts        VeritasClient (Bearer + Veritas-Version)
│   │       ├── auth.ts          AuthProvider + PortalTokenAuthProvider
│   │       ├── runtime.ts       initLux / getDefaultClient / getLuxToken
│   │       ├── session.ts       VeritasSession (tenant, active case, SSE attach/detach)
│   │       ├── events.ts        CaseSseTransport for `/api/v1/stream/:caseId`
│   │       ├── generated.ts     Veritas OpenAPI types (`pnpm codegen`)
│   │       └── index.ts
│   │
│   ├── react/                 @fenero/lux-react — React glue (no feature widgets yet)
│   │   └── src/
│   │       ├── SessionProvider.tsx
│   │       ├── useSession.ts / useCase.ts / useEvents.ts
│   │       └── index.ts
│   │
│   └── themes/                Design tokens and CSS
│       ├── default.css
│       ├── globals.css
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
| `@fenero/lux-react` | `SessionProvider`, `useSession` / `useCase` / `useEvents` | React frontends |
| `@fenero/lux-themes` | CSS custom properties, design tokens, global styles | Anyone who wants Fenero styling |

## How It Works

### 1. Bootstrap

```ts
import { initLux, type AuthProvider } from '@fenero/lux-core'

const auth: AuthProvider = {
  async getToken(forceRefresh) {
    // Return an access token from your identity layer (OIDC, magic link, etc.)
    return getAccessTokenFromYourApp(forceRefresh)
  },
}

initLux({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  auth,
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
    <SessionProvider>
      <Header />
    </SessionProvider>
  )
}
```

End-user sign-in UI and token refresh live in your app; the SDK only needs
`AuthProvider` passed to `initLux`.

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

## Sample Dashboard (`apps/dashboard`)

A minimal app that demonstrates how to consume `@fenero/lux-core` and
`@fenero/lux-react` from a customer application. This is **a sample**, not
a product. It exists as an **interactive integration guide**: copyable
snippets for `initLux`, `SessionProvider` / hooks, a thin `getDefaultClient`
API layer, local `pnpm pack` linking, plus a live session demo and health
ping.

For the real Gunnr product, see the `gunnr` repo.

```bash
pnpm install                   # at repo root
pnpm --filter @fenero/lux-core build
pnpm --filter @fenero/lux-react build
pnpm --filter @fenero/lux-sample-dashboard dev
```

Then open `http://localhost:3332`.

By default `/api/*` is proxied to `http://localhost:8000`. Override with
`VITE_LUX_PROXY_TARGET` or set `VITE_LUX_BASE_URL` to use an absolute base
URL without proxying. The "Ping" button hits `GET /api/v1/health`; without
a backend it will fail (and that is fine — the rest of the SDK surface
still works).

What it does **not** include (on purpose):

- Auth (uses a hardcoded sample token; real apps plug in any
  `AuthProvider` implementation).
- Routing, Redux, React Query, Tailwind, Mixpanel.
- Any product-specific endpoints.

## OpenAPI Codegen (`@fenero/lux-core`)

### Source

- **Default input**: `./openapi.json` at the repo root (not committed; export from Veritas when available).
- **Alternatives** (see `scripts/codegen.mjs`):
  - `pnpm codegen --url https://veritas-host/openapi.json`
  - `pnpm codegen /path/to/spec.json`
  - `VERITAS_OPENAPI=https://... pnpm codegen`

Output is always `packages/core/src/generated.ts`.

### Veritas vs Gunnr HTTP paths

The committed `generated.ts` describes the **Veritas** composable API
(paths like `/cases/{case_id}/status`, `/portal/session`).

The **dashboard** (`apps/dashboard`) calls the **Gunnr** HTTP API with a
**`/api/v1`** prefix and different path shapes (e.g.
`/api/v1/case/{id}/status`). Those endpoints are **not** represented in
the current OpenAPI file in this repo.

| Surface | Role |
|--------|------|
| `generated.ts` | Portal/session, composable Veritas types; use for portal and future alignment. |
| `gunnr-api.ts` + `VeritasClient` | Typed Gunnr REST client used by the LO dashboard today. |

When Veritas and Gunnr converge on one OpenAPI spec, regenerate and
gradually replace hand-maintained Gunnr paths with `paths` / `operations`
from `generated.ts`.

### Missing from spec (track with backend)

Hand-typed in Lux until the spec includes them (non-exhaustive):

- GCS direct upload (`prepare-upload`, signed URL upload, `start`)
- RFC 6902 `PATCH` case mutation
- Bank statement review / AI review (`/ai/review/...`)
- Income advisor status under `/api/...` (non-`/api/v1`)
- AUE (`apps/dashboard/src/hooks/useAueApi.ts`) — separate base URL; stays app-level until documented.

### API contract & versioning

- **API contract**: `veritas/docs/superpowers/specs/2026-04-13-composable-api-surface-design.md`
- **Type generation**: Lux runs `pnpm codegen` against the Veritas OpenAPI spec to generate
  `@fenero/lux-core` types. When Veritas changes, Lux picks it up on next codegen.
- **API versioning**: Lux pins to a `Veritas-Version` header. Upgrading means bumping the
  version string and regenerating types.

## App Shells Design — Portal, Dashboard, Storybook

Three app shells in `lux/apps/` prove the monorepo wiring works. Each app
is a thin Vite+React shell importing `@fenero/lux-react` and
`@fenero/lux-themes`. End-user authentication and identity providers are
implemented in app code, not in the SDK.

### `packages/themes/` — Fenero design tokens

`default.css` holds the `@theme` block:

- Orange palette (50–900)
- Semantic colors (success, warning, error + light variants)
- CTA colors (cta, cta-hover, action, action-hover)
- Border radii (sm, md, lg, xl)

`globals.css` holds shared styles:

- Base body styles, font stack
- Scrollbar styling
- Animations (spin, pulse-dot, slide-in, slide-up, fade-in, shimmer)
- Component utility classes (spinner, loading-shimmer, drop-zone,
  progress-bar, status-dot, toast)

`package.json` exports include `default.css`, `globals.css`, and `dark.css`.

### `apps/portal/` — Borrower-facing reference shell

**Stack:** Vite, React 19, Tailwind v4, react-router-dom 7  
**Port:** 3001 (see `apps/portal/vite.config.ts` if overridden)  
**Auth:** App-level — wire `initLux` + `PortalTokenAuthProvider` or your own
`AuthProvider` in the shell; the SDK stays identity-agnostic.

### `apps/dashboard/` — Sample + integration guide

**Stack:** Vite, React 19  
**Port:** 3332  
**Role:** Interactive guide for `initLux`, `SessionProvider`, and
`getDefaultClient` (see `apps/dashboard/src/`). Proxies `/api` to
`http://localhost:8000` by default for optional health checks.

### `apps/storybook/` — Component showcase

**Stack:** Storybook 8, Vite builder  
**Port:** 6006  

**Files:**

- `.storybook/main.ts` — points at `../../packages/react/src/**/*.stories.tsx`
- `.storybook/preview.ts` — imports `@fenero/lux-themes/default.css` and `globals.css`
- `src/Welcome.stories.tsx` — placeholder story
- `package.json`

### Shared decisions

- **Auth is app-level, not SDK-level.** Tokens reach the HTTP client only via
  `AuthProvider` on `initLux`. `@fenero/lux-react` has no identity-provider
  hooks.
- **No Redux, Mixpanel, or analytics in the SDK.** Consumer apps add those as
  needed.
- **Tailwind v4** with `@tailwindcss/vite` plugin where an app shell uses
  Tailwind.
- **Biome** for linting/formatting (inherited from workspace root).

### Out of scope

- SDK component implementation (packages remain stubs)
- Landing page design
- Health check context
- Analytics integration
- Background images for login page

## Engineering Conventions

### Approach

- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- Keep solutions simple and direct. No over-engineering.
- If unsure: say so. Never guess or invent file paths.

### Modularity

- Packages are the modularity boundary: `core`, `react`, `themes`.
- Within a package, organize by feature (one file per component, one file per hook).
- Avoid barrel files beyond package root `index.ts`.

### Data-Oriented Design

- Components are renderers, not state owners. State lives in `VeritasSession`.
- `VeritasSession` is a class with methods: `session.getStatus()`, `session.intent()`.
- Hooks wrap session methods: `useSession()`, `useChecklist()`, `useIntent()`.
- Components take props from session data, not from local state.
- No business logic in components. If a component needs to decide what to
  show, the decision should come from Veritas via `display_hints`.

### TypeScript

- pnpm for package management, Turborepo for orchestration.
- Strict TypeScript (`strict: true`, no `any` unless interfacing with external untyped API).
- Biome for linting and formatting (not ESLint/Prettier).
- Types generated from Veritas OpenAPI spec via codegen (`pnpm codegen`),
  hand-written only when generated types are insufficient.
- Intent types, envelope types, and session response types are ALWAYS
  generated, never hand-maintained.
- Generated types are versioned by `Veritas-Version` header — the SDK pins
  to an API version.
- No file should exceed 400 lines. If it grows past that, split by feature.
- Prefer named exports over default exports.
- Use `type` imports for type-only imports: `import type { Foo } from './foo'`.

### React

- Function components only, no class components.
- Hooks for all state and side effects.
- Props interfaces named `{ComponentName}Props`.
- No prop drilling beyond 2 levels — use `SessionProvider` context.
- Components render from server data + `display_hints`, not from local business logic.
- Accessible by default: semantic HTML, ARIA attributes, keyboard navigation.
- No CSS-in-JS. Use CSS custom properties from `@fenero/lux-themes`.
- Test with Vitest + Testing Library, not Enzyme or shallow rendering.

### Documentation

All documentation lives in this README plus JSDoc on exported functions
and TypeScript types. No standalone markdown files.

### Git

- Keep commit messages short and descriptive.
- Commit regularly at natural boundaries.
- Do not add any attributes to anyone in commit messages.

## Related Repos

```
fenero/
├── veritas/        Backend: APIs, spec engine, extraction, Temporal orchestration
├── lux/            ← you are here (SDK)
└── gunnr/          Customer product (LO dashboard) — consumes lux/
```
