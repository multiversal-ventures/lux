# Lux

Composable frontend SDK for Veritas. Truth, rendered.

## What It Does

Lux is the rendering SDK for the Veritas mortgage processing platform.
Loan officers, borrowers, partners, and agents interact with Veritas
through Lux — a typed API client, an auth-provider abstraction, a session
primitive, and (today) a thin React glue layer.

Lux is product-agnostic. Customer apps (e.g. Gunnr's LO dashboard, the
borrower portal) live in their own repos and consume `@multiversal-ventures/lux-*` as
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
  If it reaches around `@multiversal-ventures/lux-react`, the SDK has a gap.

## Architecture

```
Veritas (backend)              Lux (frontend SDK)
─────────────────              ──────────────────
Composable APIs        →       @multiversal-ventures/lux-core     (HTTP client, auth, session, SSE, OpenAPI types)
SDUI display_hints     →       @multiversal-ventures/lux-react    (SessionProvider + hooks; component registry planned)
Design tokens          →       @multiversal-ventures/lux-themes   (CSS custom properties)

                               apps/dashboard       (minimal SDK sample — not a product)
                               apps/portal          (reference borrower portal)

Customer apps (live elsewhere)
──────────────────────────────
gunnr/ui                       LO dashboard — consumes @multiversal-ventures/lux-* via npm/file:
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
│   ├── core/                  @multiversal-ventures/lux-core — Veritas SDK primitives
│   │   └── src/
│   │       ├── client.ts        VeritasClient (Bearer + Veritas-Version)
│   │       ├── auth.ts          AuthProvider + PortalTokenAuthProvider
│   │       ├── runtime.ts       initLux / getDefaultClient / getLuxToken
│   │       ├── session.ts       VeritasSession (tenant, active case, SSE attach/detach)
│   │       ├── events.ts        CaseSseTransport for `/api/v1/stream/:caseId`
│   │       ├── generated.ts     Veritas OpenAPI types (`pnpm codegen`)
│   │       └── index.ts
│   │
│   ├── react/                 @multiversal-ventures/lux-react — React glue (no feature widgets yet)
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
│   ├── dashboard/             Minimal SDK sample (`@multiversal-ventures/lux-sample-dashboard`)
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
| `@multiversal-ventures/lux-core` | `VeritasClient`, `initLux`, `VeritasSession`, `CaseSseTransport`, OpenAPI types | Everyone — React, Vue, vanilla JS, agents |
| `@multiversal-ventures/lux-react` | `SessionProvider`, `useSession` / `useCase` / `useEvents` | React frontends |
| `@multiversal-ventures/lux-themes` | CSS custom properties, design tokens, global styles | Anyone who wants Fenero styling |

## How It Works

### 1. Bootstrap

```ts
import { initLux, type AuthProvider } from '@multiversal-ventures/lux-core'

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
import { SessionProvider, useSession } from '@multiversal-ventures/lux-react'

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
import { getDefaultClient } from '@multiversal-ventures/lux-core'

const data = await getDefaultClient().requestJson<Foo>('/api/v1/some-endpoint')
```

Customer apps wrap this in their own typed API layer (e.g. `gunnr/ui` has
`src/lib/lux-gunnr/`). Lux itself ships **no** product-specific endpoint
methods.

## Quick Start

```bash
pnpm install
pnpm --filter @multiversal-ventures/lux-core build
pnpm --filter @multiversal-ventures/lux-react build
pnpm --filter @multiversal-ventures/lux-sample-dashboard dev   # http://localhost:3332
```

## Linking into a customer repo (local dev)

```bash
# Local dev — symlink directly (no tarball needed)
# In customer/ui/package.json
"dependencies": {
  "@multiversal-ventures/lux-core":  "file:../../lux/packages/core",
  "@multiversal-ventures/lux-react": "file:../../lux/packages/react"
}

# Published packages (GitHub Packages — @multiversal-ventures scope)
# Requires NODE_AUTH_TOKEN with read:packages from multiversal-ventures org
"dependencies": {
  "@multiversal-ventures/lux-core":  "^0.1.2",
  "@multiversal-ventures/lux-react": "^0.1.2"
}
```

`pnpm pack` rewrites `workspace:*` deps to concrete versions, so plain
`npm install` in the consumer works.

## Sample Dashboard (`apps/dashboard`)

A minimal app that demonstrates how to consume `@multiversal-ventures/lux-core` and
`@multiversal-ventures/lux-react` from a customer application. This is **a sample**, not
a product. It exists as an **interactive integration guide**: copyable
snippets for `initLux`, `SessionProvider` / hooks, a thin `getDefaultClient`
API layer, local `pnpm pack` linking, plus a live session demo and health
ping.

For the real Gunnr product, see the `gunnr` repo.

```bash
pnpm install                   # at repo root
pnpm --filter @multiversal-ventures/lux-core build
pnpm --filter @multiversal-ventures/lux-react build
pnpm --filter @multiversal-ventures/lux-sample-dashboard dev
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

## OpenAPI Codegen (`@multiversal-ventures/lux-core`)

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

- RFC 6902 `PATCH` case mutation
- Bank statement review / AI review (`/ai/review/...`)
- Income advisor status under `/api/...` (non-`/api/v1`)
- AUE (`apps/dashboard/src/hooks/useAueApi.ts`) — separate base URL; stays app-level until documented.

### SDK-provided upload + portal methods

`@multiversal-ventures/lux-core` now includes:

- **Upload orchestration** (`operator-uploads.ts`): `uploadToSignedUrl`,
  `uploadFilesDirectToGCS`, `addFilesToCase`, `uploadFilesToCase` — pure
  async helpers that accept a `VeritasClient` (or anything with
  `requestJson`/`uploadMultipart`). The `OperatorClient` also exposes
  `prepareUpload`, `startCase`, `prepareAddFiles`, `startAddFiles` as
  low-level Result-returning methods.
- **Portal token issuance** (`operator-cases.ts`): `createPortalToken(caseId, body)`
  — calls `POST /api/cases/{id}/portal-tokens`. Body fields (`identity_id`,
  `role`, `ttl_hours`) are all optional on the SDK side; the Veritas schema
  applies defaults.

Consumer apps (e.g. Gunnr) that use Gunnr BFF routes (`/api/v1/case/...`)
can call `getDefaultClient().requestJson(...)` with those paths directly.
The SDK orchestration helpers use `/api/cases/...` (Veritas-native) by default.

### API contract & versioning

- **API contract**: `veritas/docs/superpowers/specs/2026-04-13-composable-api-surface-design.md`
- **Type generation**: Lux runs `pnpm codegen` against the Veritas OpenAPI spec to generate
  `@multiversal-ventures/lux-core` types. When Veritas changes, Lux picks it up on next codegen.
- **API versioning**: Lux pins to a `Veritas-Version` header. Upgrading means bumping the
  version string and regenerating types.

## App Shells Design — Portal, Dashboard, Storybook

Three app shells in `lux/apps/` prove the monorepo wiring works. Each app
is a thin Vite+React shell importing `@multiversal-ventures/lux-react` and
`@multiversal-ventures/lux-themes`. End-user authentication and identity providers are
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
- `.storybook/preview.ts` — imports `@multiversal-ventures/lux-themes/default.css` and `globals.css`
- `src/Welcome.stories.tsx` — placeholder story
- `package.json`

### Shared decisions

- **Auth is app-level, not SDK-level.** Tokens reach the HTTP client only via
  `AuthProvider` on `initLux`. `@multiversal-ventures/lux-react` has no identity-provider
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
- No CSS-in-JS. Use CSS custom properties from `@multiversal-ventures/lux-themes`.
- Test with Vitest + Testing Library, not Enzyme or shallow rendering.

### Documentation

All documentation lives in this README plus JSDoc on exported functions
and TypeScript types. No standalone markdown files.

### Git

- Keep commit messages short and descriptive.
- Commit regularly at natural boundaries.
- Do not add any attributes to anyone in commit messages.

## Refinement Overrides — Schema-Driven Form

The refine page renders a form for everything an operator can adjust on a
scenario. The form is **schema-driven** end-to-end: the legal fields,
their widget types, defaults, and validation come from the Veritas API,
not from hardcoded Lux/host logic.

### Contract

Veritas walks the policy specs that would run for the selected products,
extracts any input that carries an `override:` block in its YAML, and
returns the schema as `user_inputs_schema` on:

- `ScenarioDetailResponse.rendering_hints.user_inputs_schema`
- `RefinementResponse.user_inputs_schema`

Shape (see generated `components["schemas"]["UserInputsSchemaResponse"]`):

```ts
{
  products: [
    {
      product_id: "non_qm_bank_statement",
      display_name: "Non-QM Bank Statement",
      fields: [
        { name: "expense_factor", type: "percent", label: "Expense Factor",
          default: 0.9, minimum: 0.0, maximum: 1.0, step: 0.01, hint: "…", … },
        { name: "months_covered", type: "integer", label: "Statement Period",
          options: [{value:24,label:"24 months"}, …], unit: "months" },
      ],
    },
  ],
}
```

### Render with `<DynamicUserInputsForm>`

```tsx
import { DynamicUserInputsForm, applyContextChange, type RefinementContext }
  from '@multiversal-ventures/lux-react';

const [context, setContext] = useState<RefinementContext>(initial);

<DynamicUserInputsForm
  schema={refinement.user_inputs_schema}
  value={context}
  documentYears={availableYears}
  onContextChange={(productId, fieldName, value) =>
    setContext(prev => applyContextChange(prev, productId, fieldName, value))
  }
/>
```

The form picks the right widget per field automatically (select for
`options[]`, year picker for `derive_options_from: case.document_years`,
numeric for percent/currency/integer, checkbox for boolean, text fallback).
Hosts override individual widgets through `slots.renderers[fieldType]`
when they need a richer host-styled control.

### Persistence shape (`context`)

```ts
// POST /api/cases/{id}/scenarios/{sid}/refinements
{
  context: {
    non_qm_bank_statement: {
      inputs: { expense_factor: 0.5, months_covered: 12 },
    },
    fannie_mae: {
      inputs: { y1_override: "2024" },
    },
  },
}
```

The Veritas qualify activity merges `context[product_id].inputs` into the
spec's input dict before evaluation. Unknown keys are silently ignored —
operators can target a specific spec without polluting siblings.

### Adding a new override

No Lux change. Edit the spec YAML:

```yaml
inputs:
  my_new_knob:
    type: percent
    semantic: domain.path.my_new_knob
    override:
      label: "My New Knob"
      hint: "What it controls…"
      default: 0.5
      minimum: 0.0
      maximum: 1.0
      step: 0.05
      # optional — when present the form renders a <select> instead of <input>:
      options:
        - { value: 0.25, label: "Low" }
        - { value: 0.5,  label: "Medium" }
        - { value: 0.75, label: "High" }
```

Next refinement response carries the new field; the form renders it.

## Version Compatibility

| `@multiversal-ventures/lux-core` | Veritas API | Notes |
|---------------------|-------------|-------|
|  0.1.2+ | Current | Banking, transactions, portal tokens, upload orchestration, events/SSE, spec management |

When upgrading Veritas:

1. Export the new OpenAPI spec: `veritas api export --openapi -o ../lux/openapi.json`
2. Regenerate types: `pnpm codegen` (in Lux repo root)
3. Run `pnpm typecheck` in `packages/core` — fix any breaking changes
4. Bump `@multiversal-ventures/lux-core` version, rebuild, and update consumers

When Lux adds new SDK methods for endpoints that don't exist in Veritas yet,
document the requirement in the method's JSDoc. Consumers calling those methods
against a Veritas instance that lacks the endpoint will receive a 404 error.

## Related Repos

```
fenero/
├── veritas/        Backend: APIs, spec engine, extraction, Temporal orchestration
├── lux/            ← you are here (SDK)
└── gunnr/          Customer product (LO dashboard) — consumes lux/
```
