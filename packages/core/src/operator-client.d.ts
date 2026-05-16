/**
 * Operator client — bearer-token authenticated access to Veritas.
 *
 * Covers the full case lifecycle: spec generation, case creation,
 * file upload, event streaming, audit retrieval. All paths include
 * the /api prefix used by the Veritas API router.
 *
 * Implementation is split by domain:
 *   operator-types.ts  — shared type definitions
 *   operator-spec.ts   — spec management + AI generation
 *   operator-cases.ts  — case lifecycle, events, docs, banking
 */
export type { CaseResponse, SpecAuditResponse, CalculationStepResponse, SpecResponse, DocumentResponse, ExtractionResponse, ExtractionSourceResponse, BboxResponse, BankingAccount, BankingBorrowerRollup, BankingResponse, TransactionRow, TransactionRegion, TransactionsResponse, CaseEvent, CaseEventType, GenerateSpecResult, OperatorClientConfig, OperatorClientError, Result, PrepareUploadFile, UploadUrlInfo, PrepareUploadResponse, StartCaseRequest, StartCaseResponse, StartAddFilesFileInfo, StartAddFilesResponse, DirectUploadPhase, DirectUploadProgress, DirectUploadOptions, AddFilesProgress, } from "./operator-types.js";
import type { OperatorClientConfig, Result } from "./operator-types.js";
export declare function createOperatorClient(config: OperatorClientConfig): {
    prepareUpload: (files: import("./operator-types.js").PrepareUploadFile[]) => Promise<Result<import("./operator-types.js").PrepareUploadResponse>>;
    startCase: (caseId: string, body: import("./operator-types.js").StartCaseRequest) => Promise<Result<import("./operator-types.js").StartCaseResponse>>;
    prepareAddFiles: (caseId: string, files: import("./operator-types.js").PrepareUploadFile[]) => Promise<Result<import("./operator-types.js").PrepareUploadResponse>>;
    startAddFiles: (caseId: string, files: import("./operator-types.js").StartAddFilesFileInfo[]) => Promise<Result<import("./operator-types.js").StartAddFilesResponse>>;
    listCases: (specId?: string) => Promise<Result<import("./operator-types.js").CaseResponse[]>>;
    createCase: (specId?: string) => Promise<Result<import("./operator-types.js").CaseResponse>>;
    deleteCase: (caseId: string) => Promise<Result<null>>;
    getCase: (caseId: string) => Promise<Result<import("./operator-types.js").CaseResponse>>;
    getCaseStatus: (caseId: string) => Promise<Result<{
        state: string;
    }>>;
    qualifyCase: (caseId: string, specId?: string) => Promise<Result<{
        workflow_id: string;
    }>>;
    uploadFiles: (caseId: string, files: File[]) => Promise<Result<unknown>>;
    streamEventsParsed: (caseId: string, onEvent: (event: import("./operator-types.js").CaseEvent) => void, onError?: (err: import("./operator-types.js").OperatorClientError) => void) => {
        abort: () => void;
    };
    getEvents: (caseId: string, opts?: {
        eventType?: string;
    }) => Promise<Result<import("./operator-types.js").CaseEvent[]>>;
    getAudit: (caseId: string) => Promise<Result<import("./operator-types.js").SpecAuditResponse[]>>;
    listDocuments: (caseId: string) => Promise<Result<import("./operator-types.js").DocumentResponse[]>>;
    listExtractions: (caseId: string, opts?: {
        docId?: string;
    }) => Promise<Result<import("./operator-types.js").ExtractionResponse[]>>;
    getBanking: (caseId: string) => Promise<Result<import("./operator-types.js").BankingResponse>>;
    listTransactions: (caseId: string, docId: string) => Promise<Result<import("./operator-types.js").TransactionsResponse>>;
    pagePngUrl: (caseId: string, fileId: string, pageNumber: number) => string;
    createPortalToken: (caseId: string, body: Partial<{
        identity_id: string;
        role?: string;
        ttl_seconds?: number;
    }>) => Promise<Result<{
        token: string;
        expires_at: string;
    }>>;
    getCaseScenarioAdvice: (caseId: string, scenarioId: string) => Promise<Result<import("./generated.js").components["schemas"]["ScenarioAdviceResponse"]>>;
    generateSpec: (description: string) => Promise<Result<import("./operator-types.js").GenerateSpecResult>>;
    generateSpecStream: (description: string, onChunk: (chunk: string) => void) => Promise<Result<import("./operator-types.js").GenerateSpecResult>>;
    getSpecDetail: (specId: string) => Promise<Result<import("./operator-types.js").SpecResponse & {
        yaml_content?: string | null;
    }>>;
    listSpecs: (domain?: string) => Promise<Result<import("./operator-types.js").SpecResponse[]>>;
    createSpec: (payload: {
        name: string;
        domain: string;
        version: string;
        yaml_content: string;
        description?: string;
    }) => Promise<Result<{
        spec_id: string;
    }>>;
    submitSpec: (specId: string) => Promise<Result<unknown>>;
    approveSpec: (specId: string) => Promise<Result<unknown>>;
};
export type OperatorClient = ReturnType<typeof createOperatorClient>;
//# sourceMappingURL=operator-client.d.ts.map