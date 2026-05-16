import type { BankingResponse, CaseEvent, CaseResponse, DocumentResponse, ExtractionResponse, OperatorClientError, Result, SpecAuditResponse, TransactionsResponse } from "./operator-types.js";
import type { components } from "./generated.js";
type CreatePortalTokenRequest = {
    identity_id: string;
    role?: string;
    ttl_seconds?: number;
};
type CreatePortalTokenResponse = {
    token: string;
    expires_at: string;
};
/**
 * Create case-lifecycle, event-streaming, audit, and document methods
 * bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export declare function createCaseMethods(base: string, authHeaders: (extra?: Record<string, string>) => Record<string, string>, request: <T>(res: Response) => Promise<Result<T>>): {
    listCases: (specId?: string) => Promise<Result<CaseResponse[]>>;
    createCase: (specId?: string) => Promise<Result<CaseResponse>>;
    deleteCase: (caseId: string) => Promise<Result<null>>;
    getCase: (caseId: string) => Promise<Result<CaseResponse>>;
    getCaseStatus: (caseId: string) => Promise<Result<{
        state: string;
    }>>;
    qualifyCase: (caseId: string, specId?: string) => Promise<Result<{
        workflow_id: string;
    }>>;
    uploadFiles: (caseId: string, files: File[]) => Promise<Result<unknown>>;
    streamEventsParsed: (caseId: string, onEvent: (event: CaseEvent) => void, onError?: (err: OperatorClientError) => void) => {
        abort: () => void;
    };
    getEvents: (caseId: string, opts?: {
        eventType?: string;
    }) => Promise<Result<CaseEvent[]>>;
    getAudit: (caseId: string) => Promise<Result<SpecAuditResponse[]>>;
    listDocuments: (caseId: string) => Promise<Result<DocumentResponse[]>>;
    listExtractions: (caseId: string, opts?: {
        docId?: string;
    }) => Promise<Result<ExtractionResponse[]>>;
    getBanking: (caseId: string) => Promise<Result<BankingResponse>>;
    listTransactions: (caseId: string, docId: string) => Promise<Result<TransactionsResponse>>;
    pagePngUrl: (caseId: string, fileId: string, pageNumber: number) => string;
    createPortalToken: (caseId: string, body: Partial<CreatePortalTokenRequest>) => Promise<Result<CreatePortalTokenResponse>>;
    getCaseScenarioAdvice: (caseId: string, scenarioId: string) => Promise<Result<components["schemas"]["ScenarioAdviceResponse"]>>;
};
export {};
//# sourceMappingURL=operator-cases.d.ts.map