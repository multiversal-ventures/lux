/**
 * @fenero/lux-core — Veritas SDK primitives.
 *
 * Includes: generated OpenAPI types, {@link AuthProvider} abstraction,
 * VeritasClient (HTTP, Bearer-based — dashboard apps),
 * createPortalClient (X-Portal-Token — borrower portal apps),
 * runtime singleton (initLux/getDefaultClient),
 * VeritasSession (tenant + SSE), and CaseSseTransport.
 *
 * Product-specific layers (Gunnr, etc.) live in consumer apps, not here.
 *
 * Types are generated from the Veritas OpenAPI spec. To regenerate:
 *
 *   # In Veritas (CI or manual):
 *   veritas api export --openapi -o ../lux/openapi.json
 *
 *   # In Lux:
 *   pnpm codegen
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

/** Request body for POST /cases/{id}/portal-tokens */
export type CreatePortalTokenRequest = components["schemas"]["CreatePortalTokenRequest"];

/** Response from POST /cases/{id}/portal-tokens */
export type CreatePortalTokenResponse = components["schemas"]["CreatePortalTokenResponse"];

export * from "./auth.js";

export {
	createVeritasClient,
	VeritasClient,
	APIError,
	resolveApiPath,
	createPortalClient,
} from "./client.js";
export type {
	VeritasClientConfig,
	ClientHooks,
	MeResponse,
	CreateTenantResponse,
	VeritasCaseDetail,
	VeritasCaseEvent,
	VeritasCaseFile,
	VeritasCaseDocument,
	VeritasEntityGroup,
	SampleFileInfo,
	SampleInfo,
	SampleListResponse,
	CreateSampleCaseResponse,
	PortalClientConfig,
	PortalClientError,
	FetchSessionResult,
	SubmitIntentsResult,
} from "./client.js";

export {
	initLux,
	getDefaultClient,
	getAuthProvider,
	isLuxInitialized,
	getLuxToken,
	type LuxInitConfig,
} from "./runtime.js";

export { CaseSseTransport } from "./events.js";
export type {
	CaseSseTransportOptions,
	CaseSseMessageHandler,
	StreamStatus,
} from "./events.js";

export { VeritasSession } from "./session.js";

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
	PrepareUploadFile,
	UploadUrlInfo,
	PrepareUploadResponse,
	StartCaseRequest,
	StartCaseResponse,
	StartAddFilesFileInfo,
	StartAddFilesResponse,
	DirectUploadPhase,
	DirectUploadProgress,
	DirectUploadOptions,
	AddFilesProgress,
} from "./operator-client.js";

export {
	uploadToSignedUrl,
	uploadFilesDirectToGCS,
	addFilesToCase,
	uploadFilesToCase,
} from "./operator-uploads.js";

export { normalizeQualifyResult } from "./normalize.js";
export type { QualifyResult, NormalizedQualifyResult } from "./normalize.js";
