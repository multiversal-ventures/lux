# MUL-80 Capability-by-Capability Spec Review

This document converts MUL-78 inventory output into concrete Veritas API decisions.

Primary input: `lux/docs/gunnr-endpoint-inventory.md`

## Review Goals

- Confirm canonical path conventions (Veritas composition under `/api/cases/{id}/...`).
- Confirm canonical request/response DTOs by capability.
- Confirm sync vs async behavior, including signed URL and workflow/status patterns.
- Confirm sequencing and dependencies for fastest Gunnr unblock.

## Canonical Cross-Capability Rules

### Path conventions

- Canonical routes are unversioned and composable under `/api/...`.
- Use plural resources and nested scoping:
  - `/api/cases/{id}/scenarios/{sid}`
  - `/api/cases/{id}/scenarios/{sid}/refinements/{rid}/start`
- Keep `/api/v1/*` and `/api/v1/case/*` as temporary legacy aliases during migration only.
- Keep `/api/aue/*` as separate namespace (do not merge into Veritas case surface).

### Payload conventions

- All mutating operations use named DTOs.
- Command responses use one async envelope:
  - `WorkflowCommandResponse { workflow_id: string, status: WorkflowStatus }`
- Workflow polling uses one status envelope:
  - `WorkflowStatusResponse { workflow_id, status, progress_pct?, error_code?, error_message? }`
- Paginated lists use:
  - `PageResponse<T> { items: T[], total: number, limit: number, offset: number }`
- Standard API error:
  - `ApiError { code: string, message: string, details?: object }`

### Sync vs async semantics

- `GET` read endpoints are sync.
- Long-running commands (`start`, `pull`, `reextract`, `review`) are async and return `WorkflowCommandResponse`.
- Streams are SSE and optional UX enhancement over polling.
- Signed URL flows always use `prepare -> upload (client) -> finalize/start`.

## Capability Decisions (Filled)

| Capability | Path decision | Payload decision | Sync/Async decision | Conclusion |
|---|---|---|---|---|
| Auth, tenant & platform | Normalize to `/api/auth/*`, `/api/tenants/*`, `/api/platform/*` | `UserProfileResponse`, `TenantProfileResponse`, `AppConfigResponse`, `HealthResponse`, `VersionResponse` | Sync reads, sync registration submit | Low-risk rename/cleanup; keep legacy aliases for login bootstrap paths |
| Case lifecycle | Move all `/api/v1/case/*` to `/api/cases/{id}/*` and `/api/cases/*` | `CaseStatus`, `CaseResult`, `CaseGraphResponse`, `CaseTablesResponse`, `DeleteCaseResponse` | Reads sync; `cancel/start` async command envelope | Highest unblock impact because all downstream capabilities depend on case identity and status |
| Events & streaming | Canonical `/api/cases/{id}/events` and `/api/cases/{id}/events/stream` | `CaseEventsResponse`, `StreamEvent`, cursor params (`last_id`, `limit`) | Polling + SSE both supported; SSE optional but first-class | Needed early so all async capabilities have one progress model |
| Extraction editing & enrichment | `/api/cases/{id}/documents/*` or `/api/cases/{id}/extractions/*` for classify/reextract; `/api/places/*` stays global | `PatchCaseRequest/Response`, `ReextractRequest/Response`, `ReclassifyPageRequest`, `BorrowerSelectionRequest` | Patch can be sync; reextract/classify are async command + workflow status | Important for quality loops, but after base case/status/events |
| Income & credit | `/api/cases/{id}/income/*` and `/api/cases/{id}/credit/*` | `StartIncomeVerificationRequest`, `StartCreditVerificationRequest`, `CreditPullStatusResponse`, `IncomeAdvisorResult`, `IncomeAdvisorStatusResponse` | Start/pull async; readiness/summary/status sync; advisor can be async + optional stream | Medium-high priority after scenarios since underwriting relies on it |
| Review, reports & statements | `/api/cases/{id}/review/*`, `/api/cases/{id}/banking/*`, `/api/cases/{id}/reports/*` | `ReviewDecisionsResponse`, `AIReviewStartResponse`, `BankTransactionsResponse`, `StageExcelUrlResponse`, `ReportCatalogResponse` | AI review async; reports/Excel URL sync signed URL responses; statement reads sync | Depends on normalized case, workflow, and report URL contracts |
| Scenarios & refinements | Canonical keep: `/api/cases/{id}/scenarios/{sid}/refinements/{rid}` patterns | `CreateScenarioRequest/Response`, `ScenarioDetail`, `CreateRefinementRequest/Response`, `RefinementDetail` | CRUD sync; `start` async command envelope | Best-aligned capability already; make it the template for other migrations |
| Specs & products | `/api/specs/*`, `/api/products/*`, `/api/samples/*` | `SpecListResponse`, `SpecContentResponse`, `SpecEvaluateRequest/Response`, `GenerateSampleRequest/Response` | List/get sync; evaluate/generate can be async if runtime exceeds SLA | Product tooling can follow core underwriting unblock |
| Upload & files | Canonical `/api/cases/uploads:prepare`, `/api/cases/{id}/files`, `/api/cases/{id}/files/{file_id}/download-url` | `PrepareUploadRequest/Response`, `StartCaseRequest`, `StartAddFilesRequest`, `FileDownloadResponse`, `DownloadZipResponse` | Signed URL 3-step required; start/finalize async; URL fetch sync | Must be implemented in phase 1 with case lifecycle/events |

## Concrete DTO Definitions (Canonical)

```ts
type WorkflowStatus = 'queued' | 'running' | 'failed' | 'completed' | 'cancelled';

interface WorkflowCommandResponse {
  workflow_id: string;
  status: WorkflowStatus;
}

interface WorkflowStatusResponse {
  workflow_id: string;
  status: WorkflowStatus;
  progress_pct?: number;
  error_code?: string;
  error_message?: string;
}

interface PrepareUploadRequest {
  files: Array<{ filename: string; size: number; content_type?: string }>;
}

interface PrepareUploadResponse {
  case_id: string;
  upload_urls: Array<{
    file_id: string;
    filename: string;
    upload_url: string;
    gcs_path: string;
    content_type: string;
    expires_in_seconds: number;
  }>;
}

interface StartAddFilesRequest {
  files: Array<{ file_id: string; filename: string; gcs_path: string }>;
}

interface DeleteCaseResponse {
  message: string;
  case_id: string;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

## Endpoint Decision Matrix (Complete by Endpoint Pattern)

Action legend:

- `KEEP`: canonical and unchanged
- `RENAME`: path migration only
- `RESHAPE`: payload schema normalization
- `RESEMANTIC`: sync/async behavior normalization
- `DEPRECATE`: remove endpoint from canonical surface

| Current endpoint | Action | Target endpoint | Request DTO | Response DTO | Semantics | Alias |
|---|---|---|---|---|---|---|
| `/api/v1/auth/complete-registration` | RENAME | `/api/auth/complete-registration` | `CompleteRegistrationRequest` | `CompleteRegistrationResponse` | Sync | Yes |
| `/api/v1/auth/me` | RENAME | `/api/auth/me` | None | `UserProfileResponse` | Sync | Yes |
| `/api/v1/tenants/me` | RENAME+RESHAPE | `/api/tenants/me` | None | `TenantProfileResponse` | Sync | Yes |
| `/api/v1/tenants/cases` | RENAME+RESHAPE | `/api/tenants/cases` | `TenantCasesQuery` | `PageResponse<TenantCaseMetadata>` | Sync | Yes |
| `/api/v1/config` | RENAME | `/api/platform/config` | None | `AppConfigResponse` | Sync | Yes |
| `/api/v1/health` | RENAME | `/api/platform/health` | None | `HealthResponse` | Sync | Yes |
| `/api/v1/version` | RENAME | `/api/platform/version` | None | `VersionResponse` | Sync | Yes |
| `/api/v1/case/upload` | RENAME+RESEMANTIC | `/api/cases/uploads:prepare` | `PrepareUploadRequest` | `PrepareUploadResponse` | Signed URL prep | Yes |
| `/api/v1/case/prepare-upload` | RENAME | `/api/cases/uploads:prepare` | `PrepareUploadRequest` | `PrepareUploadResponse` | Signed URL prep | Yes |
| `/api/v1/case/{id}/start` | RENAME+RESEMANTIC | `/api/cases/{id}/start` | `StartCaseRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/files/prepare` | RENAME | `/api/cases/{id}/files/uploads:prepare` | `PrepareUploadRequest` | `PrepareUploadResponse` | Signed URL prep | Yes |
| `/api/v1/case/{id}/files/start` | RENAME+RESHAPE | `/api/cases/{id}/files:start` | `StartAddFilesRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/files/download-zip` | RENAME+RESHAPE | `/api/cases/{id}/files:download-zip-url` | None | `DownloadZipResponse` | Sync signed URL | Yes |
| `/api/v1/case/{id}/file/{file_id}/download-url` | RENAME | `/api/cases/{id}/files/{file_id}/download-url` | None | `FileDownloadResponse` | Sync signed URL | Yes |
| `/api/v1/case/{id}` (DELETE) | RENAME | `/api/cases/{id}` (DELETE) | None | `DeleteCaseResponse` | Sync | Yes |
| `/api/v1/case/{id}/status` | RENAME | `/api/cases/{id}/status` | None | `CaseStatus` | Sync | Yes |
| `/api/v1/cases/status` | RENAME+RESHAPE | `/api/cases:batch-status` | `BatchCaseStatusRequest` | `BatchStatusResponse` | Sync | Yes |
| `/api/v1/case/{id}/result` | RENAME | `/api/cases/{id}/result` | None | `CaseResult` | Sync | Yes |
| `/api/v1/case/{id}/progress` | DEPRECATE | n/a (use status/result/events) | n/a | n/a | n/a | No |
| `/api/v1/case/{id}/graph` | RENAME | `/api/cases/{id}/graph` | `CaseGraphQuery` | `CaseGraphResponse` | Sync | Yes |
| `/api/v1/case/{id}/tables` | RENAME | `/api/cases/{id}/tables` | `CaseTablesQuery` | `CaseTablesResponse` | Sync | Yes |
| `/api/v1/case/{id}/cancel` | RENAME+RESEMANTIC | `/api/cases/{id}:cancel` | None | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/tax-year` | RENAME | `/api/cases/{id}/tax-year` | None | `TaxYearResolution` | Sync | Yes |
| `/api/v1/case/{id}/tax-year/confirm` | RENAME | `/api/cases/{id}/tax-year:confirm` | `ConfirmTaxYearRequest` | `ConfirmTaxYearResponse` | Sync | Yes |
| `/api/v1/case/{id}/workflows` | RENAME+RESHAPE | `/api/cases/{id}/workflows` | `WorkflowsQuery` | `WorkflowStatusListResponse` | Sync | Yes |
| `/api/v1/case/{id}/workflows/cancel` | RENAME+RESEMANTIC | `/api/cases/{id}/workflows:cancel` | `CancelWorkflowsRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/cases/{id}/events` | RENAME | `/api/cases/{id}/events` | `EventsQuery` | `CaseEventsResponse` | Sync poll | Yes |
| `/api/v1/stream/{id}` | RENAME | `/api/cases/{id}/events/stream` | `EventsStreamQuery` | `text/event-stream` | SSE | Yes |
| `/api/v1/case/{id}/patch` | RENAME | `/api/cases/{id}/patch` | `PatchCaseRequest` | `PatchCaseResponse` | Sync | Yes |
| `/api/v1/case/{id}/reextract` | RENAME+RESEMANTIC | `/api/cases/{id}/reextract` | `ReextractRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/page/{file_id}/{page}/classify` | RENAME+RESEMANTIC | `/api/cases/{id}/pages/{file_id}/{page}:classify` | `ReclassifyPageRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/document-classes` | RENAME | `/api/document-classes` | None | `DocumentClassesResponse` | Sync | Yes |
| `/api/v1/case/{id}/borrower-selection` | RENAME+RESHAPE | `/api/cases/{id}/borrower-selection` | `BorrowerSelectionRequest` | `BorrowerSelectionResponse` | Sync | Yes |
| `/api/v1/places/autocomplete` | KEEP | `/api/places/autocomplete` | `PlacesAutocompleteQuery` | `PlacesAutocompleteResponse` | Sync | Yes |
| `/api/v1/places/details/{place_id}` | KEEP | `/api/places/details/{place_id}` | None | `PlaceDetailsResponse` | Sync | Yes |
| `/api/v1/case/{id}/income/ready` | RENAME | `/api/cases/{id}/income/readiness` | `IncomeReadinessQuery` | `IncomeReadinessResponse` | Sync | Yes |
| `/api/v1/income/loan-products` | RENAME | `/api/income/loan-products` | None | `LoanProductsResponse` | Sync | Yes |
| `/api/v1/case/{id}/income/start` | RENAME+RESEMANTIC | `/api/cases/{id}/income:start` | `StartIncomeVerificationRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/income/advisor` | RENAME+RESEMANTIC | `/api/cases/{id}/income/advisor:run` | `IncomeAdvisorRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/case/{id}/income/advisor/status` | RENAME | `/api/cases/{id}/income/advisor/status` | None | `IncomeAdvisorStatusResponse` | Sync | Yes |
| `/api/v1/case/{id}/refinement/{rid}/income` | RENAME | `/api/cases/{id}/refinements/{rid}/income` | None | `GetIncomeVerificationResponse` | Sync | Yes |
| `/api/v1/case/{id}/credit/start` | RENAME+RESEMANTIC | `/api/cases/{id}/credit:start` | `StartCreditVerificationRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/credit` | RENAME | `/api/cases/{id}/credit` | None | `GetCreditVerificationResponse` | Sync | Yes |
| `/api/v1/case/{id}/credit/pull` | RENAME+RESEMANTIC | `/api/cases/{id}/credit/pull:start` | `CreditPullStartRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/credit/pull/{wid}/status` | RENAME | `/api/cases/{id}/credit/pull/{wid}/status` | None | `CreditPullStatusResponse` | Sync | Yes |
| `/api/v1/case/{id}/credit/pull/{wid}/cancel` | RENAME+RESEMANTIC | `/api/cases/{id}/credit/pull/{wid}:cancel` | None | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/credit-report/summary` | RENAME | `/api/cases/{id}/credit-report/summary` | None | `CreditReportSummary` | Sync | Yes |
| `/api/v1/ai/review/{id}/start` | RENAME+RESEMANTIC | `/api/cases/{id}/review/ai:start` | `AIReviewStartRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/ai/review/{id}/status` | RENAME | `/api/cases/{id}/review/ai/status` | `ReviewStatusQuery` | `AIReviewStatusResponse` | Sync | Yes |
| `/api/v1/ai/review/{id}/decisions` (GET/POST) | RENAME | `/api/cases/{id}/review/decisions` | `ReviewDecisionsUpsertRequest` | `ReviewDecisionsResponse` | Sync | Yes |
| `/api/v1/ai/review/{id}/reunify` | RENAME+RESEMANTIC | `/api/cases/{id}/review:reunify` | None | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/bank-statements/summary` | RENAME | `/api/cases/{id}/banking/summary` | None | `BankStatementSummary` | Sync | Yes |
| `/api/v1/case/{id}/bank-statements/transactions` | RENAME | `/api/cases/{id}/banking/transactions` | `BankTransactionsQuery` | `BankTransactionsResponse` | Sync | Yes |
| `/api/v1/case/{id}/bank-statements/review` | RENAME | `/api/cases/{id}/banking/review` | `ReviewTransactionsQuery` | `ReviewTransactionsResponse` | Sync | Yes |
| `/api/v1/case/{id}/bank-statements/page-stats` | RENAME | `/api/cases/{id}/banking/page-stats` | None | `PageStatsResponse` | Sync | Yes |
| `/api/v1/case/{id}/bank-statements/reclassify` | RENAME+RESEMANTIC | `/api/cases/{id}/banking:reclassify` | `ReclassifyTransactionsRequest` | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/cases/{id}/stages/{stage}/excel-url` | RENAME | `/api/cases/{id}/reports/stages/{stage}/excel-url` | `StageExcelQuery` | `StageExcelUrlResponse` | Sync signed URL | Yes |
| `/api/v1/cases/{id}/reports` | RENAME | `/api/cases/{id}/reports` | None | `ReportCatalogResponse` | Sync | Yes |
| `/api/v1/cases/{id}/reports/{type}/excel-url` | RENAME | `/api/cases/{id}/reports/{type}/excel-url` | `ReportExcelQuery` | `StageExcelUrlResponse` | Sync signed URL | Yes |
| `/api/v1/case/{id}/scenarios` (GET/POST) | RENAME | `/api/cases/{id}/scenarios` | `CreateScenarioRequest` | `ScenariosResponse` or `CreateScenarioResponse` | Sync | Yes |
| `/api/v1/case/{id}/scenarios/{sid}` (GET/DELETE) | RENAME | `/api/cases/{id}/scenarios/{sid}` | None | `ScenarioDetail`/`DeleteResponse` | Sync | Yes |
| `/api/v1/case/{id}/scenarios/{sid}/start` | RENAME+RESEMANTIC | `/api/cases/{id}/scenarios/{sid}/start` | None | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/case/{id}/scenarios/{sid}/refinements` (GET/POST) | RENAME | `/api/cases/{id}/scenarios/{sid}/refinements` | `CreateRefinementRequest` | `ListRefinementsResponse`/`CreateRefinementResponse` | Sync | Yes |
| `/api/v1/case/{id}/scenarios/{sid}/refinements/{rid}` | RENAME | `/api/cases/{id}/scenarios/{sid}/refinements/{rid}` | None | `RefinementDetail` | Sync | Yes |
| `/api/v1/case/{id}/scenarios/{sid}/refinements/{rid}/start` | RENAME+RESEMANTIC | `/api/cases/{id}/scenarios/{sid}/refinements/{rid}/start` | None | `WorkflowCommandResponse` | Async command | Yes |
| `/api/v1/specs` | RENAME | `/api/specs` | None | `SpecListResponse` | Sync | Yes |
| `/api/v1/specs/{spec_id}` | RENAME | `/api/specs/{spec_id}` | None | `SpecContentResponse` | Sync | Yes |
| `/api/v1/specs/evaluate` | RENAME+RESEMANTIC | `/api/specs/{spec_id}:evaluate` | `SpecEvaluateRequest` | `SpecEvaluateResponse` or `WorkflowCommandResponse` | Async if slow | Yes |
| `/api/v1/specs/generate-sample` | RENAME+RESEMANTIC | `/api/specs/{spec_id}:generate-sample` | `GenerateSampleRequest` | `GenerateSampleResponse` or `WorkflowCommandResponse` | Async if slow | Yes |
| `/api/v1/products/demo-loans*` | RESHAPE | `/api/products/{product_id}/test` family | product test DTOs | product test DTOs | Sync | Temporary |
| `/api/v1/samples`, `/api/v1/samples/create` | RENAME | `/api/samples`, `/api/samples:create-case` | sample DTOs | sample DTOs | Sync | Yes |
| `/api/aue/cases/{id}/start` | KEEP | `/api/aue/cases/{id}/start` | AUE-specific | AUE-specific | Async | n/a |

## Sync vs Async Classification (Confirmed)

### Canonical async workflow pattern

1. Client calls command endpoint (`...:start`, `...:cancel`, `...:reextract`, etc.).
2. API returns `WorkflowCommandResponse`.
3. Client polls status endpoint and/or subscribes to `/api/cases/{id}/events/stream`.
4. Terminal status emits event and final result is fetched from stable read endpoint.

### Capability classification summary

- **Async required**:
  - Case start/cancel
  - Income start/advisor run
  - Credit start/pull/cancel
  - Scenario start, refinement start
  - Reextract, reclassify, AI review start/reunify
- **Sync required**:
  - Read endpoints (status, result, summaries, lists, get-by-id)
  - Signed URL fetch endpoints (download/report/excel URL issuance)
- **Signed URL flow required**:
  - Upload prepare/upload/start
  - Download zip/file/report URL endpoints

## Capability-Level Conclusions

- **Auth/platform**: mostly rename and envelope cleanup; low migration risk.
- **Case lifecycle**: primary migration surface; must normalize first because every downstream capability keys on case identity and workflow status.
- **Events/streaming**: must be canonicalized early to avoid per-capability ad hoc polling logic.
- **Extraction editing**: requires workflow semantics alignment for reextract/classify; medium dependency on case/events.
- **Income/credit**: heavy async semantics; depends on canonical workflow/status/events patterns.
- **Review/reports**: depends on both workflow semantics and standardized signed URL contracts.
- **Scenarios/refinements**: closest to target architecture; use as reference implementation.
- **Specs/products**: important but less blocking than case/scenario/income flows.
- **Upload/files**: phase-1 critical path with lifecycle/events.

## Sequencing and Dependencies (Implementation Plan)

1. **Foundation: Case lifecycle + Upload/files + Events**
   - Dependency: none
   - Unblocks: all other async UX and progress handling
2. **Scenarios & refinements**
   - Depends on: canonical case routing and workflow envelopes
   - Unblocks: underwriting scenario operations
3. **Income & credit**
   - Depends on: workflow/status/events consistency
   - Unblocks: borrower income and credit workflows
4. **Review, reports & statements**
   - Depends on: income/credit outputs + signed URL conventions
   - Unblocks: analyst decisioning and exports
5. **Extraction editing & enrichment**
   - Depends on: document/case canonical routes + workflow envelopes
   - Unblocks: correction loops and data enrichment
6. **Specs & products**
   - Depends on: stable spec and sample DTO baseline
   - Unblocks: product testing tooling
7. **Auth, tenant & platform cleanup**
   - Depends on: none, but lowest unblock value
   - Unblocks: final consistency and operational hygiene

## Definition of Done for MUL-80

- Every audited endpoint pattern has an explicit action (`KEEP`/`RENAME`/`RESHAPE`/`RESEMANTIC`/`DEPRECATE`).
- Every target endpoint has canonical path, DTO, and semantic classification.
- Async endpoints follow one workflow/status/event contract.
- Sequencing includes dependency rationale and unblock impact.
- Legacy alias and deprecation strategy is explicitly defined per pattern.
