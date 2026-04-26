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
export type { paths, components, operations } from "./generated.js";

import type { components } from "./generated.js";

/** Portal session response as returned by GET /portal/session */
export type PortalSession = components["schemas"]["PortalSessionResponse"];

/** A single checklist item in a portal session */
export type ChecklistItem = components["schemas"]["ChecklistItem"];

/** Borrower consent state */
export type ConsentState = components["schemas"]["ConsentState"];

/** A typed intent to submit to Veritas */
export type Intent = components["schemas"]["Intent"];

export { createPortalClient } from "./client.js";
export type { PortalClientConfig, PortalClientError, FetchSessionResult, SubmitIntentsResult } from "./client.js";

export { createOperatorClient } from "./operator-client.js";
export type {
	OperatorClient,
	OperatorClientConfig,
	OperatorClientError,
	CaseEvent,
	CaseEventType,
	CaseResponse,
	SpecResponse,
	Result,
	SpecAuditResponse,
	CalculationStepResponse,
	GenerateSpecResult,
	DocumentResponse,
	ExtractionResponse,
	ExtractionSourceResponse,
	BankingResponse,
	BankingAccount,
	BankingBorrowerRollup,
	BboxResponse,
	TransactionsResponse,
	TransactionRegion,
	TransactionRow,
} from "./operator-client.js";

export { normalizeQualifyResult } from "./normalize.js";
export type { QualifyResult, NormalizedQualifyResult } from "./normalize.js";
