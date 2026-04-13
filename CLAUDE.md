# CLAUDE.md

## Project

Lux is the composable frontend SDK and component library for Veritas (mortgage
document processing platform). TypeScript monorepo, Turborepo-managed, three
published packages. See README.md for architecture.

## Modular Preferred
- Packages are the modularity boundary: core, react, themes
- Within a package, organize by feature (one file per component, one file per hook)
- Avoid barrel files beyond package root index.ts

## Data-Oriented Design

- Components are renderers, not state owners. State lives in VeritasSession.
- VeritasSession is a class with methods: `session.getStatus()`, `session.intent()`
- Hooks wrap session methods: `useSession()`, `useChecklist()`, `useIntent()`
- Components take props from session data, not from local state
- No business logic in components. If a component needs to decide what to show,
  the decision should come from Veritas via display_hints

## Git

- Keep commit messages short and descriptive
- Commit regularly at natural boundaries
- Do not add any attributes to anyone in commit messages

## Approach

- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct. No over-engineering.
- If unsure: say so. Never guess or invent file paths.
- User instructions always override this file.

## Efficiency

- Read before writing. Understand the problem before coding.
- No redundant file reads. Read each file once.
- One focused coding pass. Avoid iterate-delete-rewrite cycles.
- Test once, fix if needed, verify once. No unnecessary iterations.

## Documentation

All documentation lives in code: JSDoc on exported functions, TypeScript types
as the primary documentation, inline comments at decision points. No standalone
markdown files beyond README.md in each package and this file.

## TypeScript

- pnpm for package management, Turborepo for orchestration
- Strict TypeScript (`strict: true`, no `any` unless interfacing with external untyped API)
- Biome for linting and formatting (not ESLint/Prettier)
- Types generated from Veritas OpenAPI spec via codegen (`pnpm codegen`), hand-written only when generated types are insufficient
- Intent types, envelope types, and session response types are ALWAYS generated, never hand-maintained
- Generated types are versioned by `Veritas-Version` header — the SDK pins to an API version
- No file should exceed 400 lines. If it grows past that, split by feature.
- Prefer named exports over default exports
- Use `type` imports for type-only imports: `import type { Foo } from './foo'`

## React

- Function components only, no class components
- Hooks for all state and side effects
- Props interfaces named `{ComponentName}Props`
- No prop drilling beyond 2 levels — use SessionProvider context
- Components render from server data + display_hints, not from local business logic
- Accessible by default: semantic HTML, ARIA attributes, keyboard navigation
- No CSS-in-JS. Use CSS custom properties from @fenero/lux-themes
- Test with Vitest + Testing Library, not Enzyme or shallow rendering

## Layout

- `packages/core/` → `@fenero/lux-core` — API client, session, types, events. No React dependency.
- `packages/react/` → `@fenero/lux-react` — Components, hooks, SessionProvider, component registry. Depends on core.
- `packages/themes/` → `@fenero/lux-themes` — CSS custom properties, design tokens. No JS runtime dependency.
- `apps/portal/` → Reference borrower portal. Built entirely on @fenero/lux-react. Proves the SDK.

## Principles

- Veritas is the truth. Lux is the light. Lux never stores business state.
- The spec drives the UI. Finding codes map to components via display_hints.
- One SDK, many consumers. Borrower portal, LO dashboard, partner embed — same packages.
- Components are pure renderers. Server decides what, client decides how.
- Every user action becomes a typed API call with audit trail.
- Accessibility is not optional. Every component works with screen readers and keyboard.
- Theming is CSS custom properties, not component forks or prop overrides.
- The reference portal (apps/portal) must be buildable entirely from published packages.
  If it reaches around @fenero/lux-react, the SDK has a gap.
