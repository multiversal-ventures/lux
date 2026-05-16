# Lux Agent Guidance

## Commit Rules

- **NEVER add `Co-authored-by: Cursor` or any AI attribution trailer to commits.** Do not add it. Do not allow it. Strip it if it appears.

## Project

Lux is the shared React component library and TypeScript client for Veritas. It consists of:
- `packages/core` — TypeScript HTTP client (`@multiversal-ventures/lux-core`)
- `packages/react` — React components (`@multiversal-ventures/lux-react`)
- `packages/themes` — CSS variables and themes
- `apps/portal` — Borrower portal app (consumes lux-react)
