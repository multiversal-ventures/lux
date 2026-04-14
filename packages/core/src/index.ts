/**
 * @fenero/lux-core — Typed API client and generated types for Veritas.
 *
 * Types are generated from the Veritas OpenAPI spec. To regenerate:
 *
 *   # In Veritas (CI or manual):
 *   veritas api export --openapi -o ../lux/openapi.json
 *
 *   # In Lux:
 *   pnpm codegen
 *
 * `pnpm codegen` runs `openapi-typescript openapi.json -o packages/core/src/generated.ts`.
 */
export type { paths, components, operations } from "./generated";
