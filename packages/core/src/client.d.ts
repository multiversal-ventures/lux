import type { AuthProvider } from "./auth.js";
import type { components } from "./generated.js";
import { type NormalizedRefinement } from "./normalize.js";
export interface MeResponse {
    user_id: string;
    email: string | null;
    display_name: string | null;
    caller_type: string;
    tenant_id: string | null;
    has_tenant: boolean;
    role: string | null;
    permissions: string[];
}
export interface CreateTenantResponse {
    tenant_id: string;
    tenant_name: string;
    role: string;
    has_tenant: boolean;
}
export interface VeritasCaseFile {
    file_id: string;
    original_filename: string | null;
    uploaded_at: string | null;
    total_pages: number;
}
export interface VeritasCaseDocument {
    doc_id: string;
    doc_type: string | null;
    original_filename: string | null;
    file_id: string;
    page_numbers: number[] | null;
    effective_period_start: string | null;
    effective_period_end: string | null;
    tax_year: number | null;
}
/** Entity group returned by GET /api/cases/{case_id}/entities */
export interface VeritasEntityGroup {
    entity_group_id: string;
    case_id: string;
    entity_type: string;
    identifier_type: string;
    identifier_value: string;
    label: string;
    resolution_method: string;
    status: string;
    doc_ids: string[];
    parent_entity_group_id: string | null;
    borrower_identity_id: string | null;
}
export interface VeritasCaseEvent {
    event_id: number;
    event_type: string;
    event_data: Record<string, unknown>;
    created_at: string | null;
}
export interface VeritasCaseDetail {
    case_id: string;
    tenant_id: string;
    spec_id: string | null;
    state: string;
    pool_version: number;
    created_at: string | null;
    file_count?: number;
    primary_borrower?: string | null;
}
export interface SampleFileInfo {
    filename: string;
}
export interface SampleInfo {
    id: string;
    name: string;
    description: string;
    category: string;
    files: SampleFileInfo[];
}
export interface SampleListResponse {
    samples: SampleInfo[];
}
export interface CreateSampleCaseResponse {
    case_id: string;
    state: string;
    file_count: number;
    sample_id: string;
}
export type ClientHooks = {
    onApiError?: (info: {
        error_type: string;
        error_message: string;
        error_code: string;
        page_url?: string;
        user_id?: string;
    }) => void;
};
export type VeritasClientConfig = {
    /** Optional API origin (no trailing slash). Empty = same-origin relative paths. */
    baseUrl: string;
    auth: AuthProvider;
    /** Sent as `Veritas-Version` when set. */
    veritasVersion?: string;
    hooks?: ClientHooks;
};
export declare class APIError extends Error {
    status: number;
    data?: unknown;
    constructor(message: string, status: number, data?: unknown);
}
export declare function resolveApiPath(baseUrl: string, path: string): string;
/**
 * Typed HTTP client for Veritas / Gunnr APIs (Bearer + optional Veritas-Version).
 */
export declare class VeritasClient {
    private readonly cfg;
    constructor(cfg: VeritasClientConfig);
    get baseUrl(): string;
    resolvePath(path: string): string;
    requestJson<T>(path: string, options?: RequestInit): Promise<T>;
    uploadMultipart<T>(path: string, formData: FormData, options?: RequestInit): Promise<T>;
    getMe(): Promise<MeResponse>;
    createTenant(name: string): Promise<CreateTenantResponse>;
    createCase(body?: {
        spec_id?: string | null;
        spec_filter?: string[];
    }): Promise<{
        case_id: string;
        spec_id: string | null;
    }>;
    getCase(caseId: string): Promise<VeritasCaseDetail>;
    listTenantProducts(options?: {
        includeDisabled?: boolean;
    }): Promise<components["schemas"]["ProductResponse"][]>;
    getSuggestedProducts(caseId: string): Promise<components["schemas"]["SuggestedProductsResponse"]>;
    getCaseFiles(caseId: string): Promise<VeritasCaseFile[]>;
    getCaseDocuments(caseId: string): Promise<VeritasCaseDocument[]>;
    getCaseEntities(caseId: string): Promise<VeritasEntityGroup[]>;
    getCaseExtractions(caseId: string, docId?: string): Promise<components["schemas"]["ExtractionResponse"][]>;
    getCaseExtractionsByDocType(caseId: string, docType: string, taxYear?: number | null): Promise<components["schemas"]["ExtractionResponse"][]>;
    uploadCasePdfs(caseId: string, files: File[] | FileList): Promise<{
        case_id: string;
        workflow_id: string;
        files_queued: number;
        status: string;
    }>;
    reprocessCase(caseId: string): Promise<{
        case_id: string;
        workflow_id: string;
        page_count: number;
        status: string;
    }>;
    getCaseBanking(caseId: string): Promise<import('./operator-types.js').BankingResponse>;
    getCaseBankingTransactions(caseId: string): Promise<import('./operator-types.js').ClassifiedTransactionsResponse>;
    getDocumentRegions(caseId: string, docId: string): Promise<import('./operator-types.js').TransactionsResponse>;
    pagePngPath(caseId: string, fileId: string, pageNumber: number): string;
    fetchBlob(path: string): Promise<Blob>;
    /** Authenticated GET returning a Blob plus filename from Content-Disposition. */
    fetchAuthorizedBinary(path: string): Promise<{
        blob: Blob;
        filename: string;
    }>;
    getCaseEvents(caseId: string): Promise<VeritasCaseEvent[]>;
    /**
     * Open an SSE stream for case events using fetch (supports Authorization header).
     * Returns an abort function. The stream closes automatically when the case reaches
     * a terminal state or the caller invokes abort.
     */
    streamCaseEvents(caseId: string, onEvent: (event: VeritasCaseEvent) => void, onError?: (err: Error) => void, options?: {
        cursor?: number;
    }): () => void;
    listSamples(): Promise<SampleListResponse>;
    createSampleCase(sampleId: string): Promise<CreateSampleCaseResponse>;
    getCaseScenarios(caseId: string): Promise<components["schemas"]["ScenarioComparisonResponse"][]>;
    /** GET /api/cases/{case_id}/reports — optional scenario_id scopes last_* metadata. */
    listReports(caseId: string, opts?: {
        scenarioId?: string;
    }): Promise<components["schemas"]["ReportListItem"][]>;
    /** POST /api/cases/{case_id}/reports/{report_name} — 201 with metadata; body optional. */
    generateReport(caseId: string, reportName: string, body?: components["schemas"]["ReportGenerateRequest"] | null): Promise<components["schemas"]["ReportGenerateResponse"]>;
    /** GET /api/cases/{case_id}/reports/{report_name}/latest — requires scenario_id. */
    getLatestReport(caseId: string, reportName: string, opts: {
        scenarioId: string;
        tenantSlug?: string | null;
    }): Promise<components["schemas"]["ReportGenerateResponse"]>;
    /** GET binary .xlsx for a persisted report row (report_id from generate or latest). */
    downloadReport(caseId: string, reportName: string, reportId: string): Promise<{
        blob: Blob;
        filename: string;
    }>;
    /** GET /api/cases/{case_id}/audit — full calculation audit (specs, steps, function_calls). */
    getCaseAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]>;
    getCaseScenario(caseId: string, scenarioId: string): Promise<components["schemas"]["ScenarioDetailResponse"]>;
    getCaseScenarioSummary(caseId: string, scenarioId: string, opts?: {
        refresh?: boolean;
    }): Promise<components["schemas"]["ScenarioSummaryResponse"]>;
    getCaseScenarioRefinementSummary(caseId: string, scenarioId: string, refinementId: string, opts?: {
        refresh?: boolean;
    }): Promise<components["schemas"]["ScenarioSummaryResponse"]>;
    createCaseScenario(caseId: string, body: components["schemas"]["CreateScenarioRequest"]): Promise<components["schemas"]["CreateScenarioResponse"]>;
    startCaseScenario(caseId: string, scenarioId: string): Promise<components["schemas"]["StartScenarioResponse"]>;
    deleteCaseScenario(caseId: string, scenarioId: string): Promise<components["schemas"]["DeleteScenarioResponse"]>;
    getCaseScenarioRefinements(caseId: string, scenarioId: string): Promise<NormalizedRefinement[]>;
    getCaseScenarioRefinement(caseId: string, scenarioId: string, refinementId: string): Promise<NormalizedRefinement>;
    createCaseScenarioRefinement(caseId: string, scenarioId: string, body: components["schemas"]["CreateRefinementRequest"]): Promise<components["schemas"]["CreateRefinementResponse"]>;
    startCaseScenarioRefinement(caseId: string, scenarioId: string, refinementId: string): Promise<components["schemas"]["StartRefinementResponse"]>;
    getAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]>;
    getSpecAudit(caseId: string, specName: string): Promise<components["schemas"]["SpecAuditResponse"]>;
    getCaseScenarioAdvice(caseId: string, scenarioId: string): Promise<components["schemas"]["ScenarioAdviceResponse"]>;
    /**
     * Build absolute URL for `EventSource` when `baseUrl` is empty (browser resolves against `location.origin`).
     */
    toAbsoluteUrl(path: string): string;
}
export declare function createVeritasClient(cfg: VeritasClientConfig): VeritasClient;
type PortalSession = components["schemas"]["PortalSessionResponse"];
type Intent = components["schemas"]["Intent"];
export interface PortalClientConfig {
    /** Base URL of the Veritas API (e.g. "" for same-origin, "https://api.example.com" for external). */
    baseUrl?: string;
}
export interface PortalClientError {
    code: "expired" | "no_token" | "network" | "server" | "not_ready";
    message: string;
    status?: number;
}
/** Discriminated union: exactly one of session or error is set. */
export type FetchSessionResult = {
    session: PortalSession;
    error: null;
} | {
    session: null;
    error: PortalClientError;
};
/** Discriminated union: exactly one of session or error is set. */
export type SubmitIntentsResult = {
    session: PortalSession;
    error: null;
} | {
    session: null;
    error: PortalClientError;
};
/**
 * Minimal portal session client.
 *
 * Wraps the two portal endpoints (/portal/session and /portal/session/{id}/intents)
 * with typed results so app code doesn't need to hand-roll fetch logic.
 */
export declare function createPortalClient(config?: PortalClientConfig): {
    fetchSession: (token: string) => Promise<FetchSessionResult>;
    submitIntents: (sessionId: string, token: string, intents: Intent[]) => Promise<SubmitIntentsResult>;
};
export {};
//# sourceMappingURL=client.d.ts.map