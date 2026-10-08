/**
 * @multiversal-ventures/lux-core — Veritas SDK primitives.
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

/** A paged slice of a party/portal thread */
export type ThreadPage = components["schemas"]["ThreadPage"];

/** A single checklist item in a portal session */
export type ChecklistItem = components["schemas"]["ChecklistItem"];

/** Borrower consent state */
export type ConsentState = components["schemas"]["ConsentState"];

/** A typed intent to submit to Veritas */
export type Intent = components["schemas"]["Intent"];

/** One create-time input the applicant still has to answer, as advertised on
 * `PortalSessionResponse.pending_inputs`.
 *
 * Deliberately NOT the operator-facing `UserInputFieldResponse`: it carries no
 * `required_at_create`, no `derive_options_from` and no `spec_name`, and its
 * `required_when` is already RESOLVED — the server only advertises a field once
 * that field's predicate holds, so a client never evaluates one. The two types
 * are scoped differently on purpose; widen neither to match the other.
 *
 * Bounds arrive as `minimum` / `maximum`. Spec YAML authors them as `min` /
 * `max`, but `policy/user_inputs_schema.py` normalises before serialising, so
 * the short spellings never cross the wire. */
export type PortalInputField = components["schemas"]["PortalInputField"];

/** One row of the product's borrower-facing document ask list. Every string
 * (`label`, `note`) is authored in `policy/specs/loan_products.yaml`; a client
 * renders them verbatim and composes none of its own. An `any_of` group is ONE
 * row — one upload satisfies it. */
export type PortalDocumentRequirement = components["schemas"]["PortalDocumentRequirement"];

/** Request body for POST /cases/{id}/portal-token.
 *
 * Every field is optional AND nullable server-side, TTL in HOURS. The borrower
 * is resolved from the case, so there is no `identity_id` input.
 * `borrower_email` becomes the party's address, which is what lets the borrower
 * have their access code re-sent. */
export type CreatePortalTokenRequest = components["schemas"]["PortalTokenRequest"];

/** Response from POST /cases/{id}/portal-token. */
export type CreatePortalTokenResponse = components["schemas"]["PortalTokenResponse"];

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
	RelationshipInfo,
	SampleFileInfo,
	SampleInfo,
	SampleListResponse,
	CreateSampleCaseResponse,
	PosPortal,
	CreatePosPortalRequest,
	PosPortalCase,
	PosPortalCaseParty,
	ResendCodeResult,
	// Borrower dashboard, officer decisions and the server-side form preview.
	// Every one is an alias onto `components["schemas"][…]`; `client.ts` owns
	// the single definition so the two cannot drift.
	BorrowerLoanRow,
	LinkAccountResponse,
	DecisionDraftResponse,
	PublishDecisionRequest,
	DecisionResponse,
	DecisionHistoryResponse,
	FormPreviewResponse,
	LoanStatusInfo,
	LoanSummaryInfo,
	LoanSummaryField,
	LoanDecisionInfo,
	PreviewPortalFormResult,
	// Re-exported rather than re-declared here: `client.ts` owns the one
	// definition. Two aliases would drift.
	PortalSession,
	PortalClientConfig,
	PortalClientError,
	FetchSessionResult,
	SubmitIntentsResult,
	IntentResult,
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
	CaseEventData,
	AgentEventMeta,
	EventDisplay,
	EventDisplayField,
	EventDisplayOp,
	EventDisplayDoc,
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
	ClassifiedTransaction,
	ClassifiedTransactionsResponse,
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
	BillingCheckoutRequest,
	BillingCheckoutResponse,
	RecordUsageRequest,
	RecordUsageResponse,
	BillingStatusResponse,
} from "./operator-client.js";

export {
	uploadToSignedUrl,
	uploadFilesDirectToGCS,
	addFilesToCase,
	uploadFilesToCase,
} from "./operator-uploads.js";

export {
	normalizeQualifyResult,
	parseStringArray,
	normalizeVeritasStatus,
	normalizeRefinement,
	isNonQmBankStatementByProducts,
	NON_QM_BANK_STATEMENT_PRODUCT_IDS,
} from "./normalize.js";
export type { QualifyResult, NormalizedQualifyResult, NormalizedRefinement } from "./normalize.js";

/** Server-resolved rendering decisions for a scenario. */
export type VeritasRenderingHints = import("./generated.js").components["schemas"]["RenderingHints"];

/** Reports API — list / generate / download generated workbooks */
export type ReportListItem = components["schemas"]["ReportListItem"];
export type ReportGenerateRequest = components["schemas"]["ReportGenerateRequest"];
export type ReportGenerateResponse = components["schemas"]["ReportGenerateResponse"];

export type VeritasProductSpecGroup = components["schemas"]["ProductSpecGroup"];
export type VeritasScenarioAdviceItem = components["schemas"]["ScenarioAdviceItem"];
export type VeritasScenarioAdviceResponse = components["schemas"]["ScenarioAdviceResponse"];
export type VeritasRefinementError = components["schemas"]["RefinementError"];

/** Structured narrative summary types for scenario income analysis. */
export * from "./extractions.js";

export type VeritasSummaryItem = components["schemas"]["SummaryItemResponse"];
export type VeritasSummarySection = components["schemas"]["SummarySectionResponse"];
export type VeritasScenarioSummaryResponse = components["schemas"]["ScenarioSummaryResponse"];
export type VeritasSummaryEvalResponse = components["schemas"]["SummaryEvalResponse"];
