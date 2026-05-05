# Gunnr Endpoint Inventory

Comprehensive inventory of endpoints called by Gunnr UI, grouped by capability.

**Sources audited**: `gunnr/ui/src/hooks/useApi.ts`, `gunnr/ui/src/types/index.ts`, direct endpoint literals across `gunnr/ui/src/**`, and mapping against `lux/packages/core/src/generated.ts`.

`In generated.ts`: `Yes` = exact method+path match, `Partial` = semantic/path-normalized or method-mismatch match, `No` = no match found.

## Auth, tenant & platform

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/complete-registration` | `Inline object ({ organization_name: organizationName } as CompleteRegistrationRequest)` | `CompleteRegistrationResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/auth/me` | `None` | `UserProfileResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Versioned Gunnr path |
| `GET` | `/api/v1/config` | `None` | `AppConfigResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/health` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/contexts/HealthContext.tsx`) |
| `GET` | `/api/v1/tenants/cases?limit=${limit}&offset=${offset}` | `None` | `TenantCaseMetadata[]` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/tenants/me` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/shared/ProtectedRoute.tsx`) |
| `GET` | `/api/v1/version` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/layout/VersionBadge.tsx`) |

## Case lifecycle

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `POST` | `/api/aue/cases/${caseId}/start` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; AUE namespace (non-Veritas); Outside useApi.ts (`gunnr/ui/src/components/layout/CaseDetailSidebar.tsx`) |
| `DELETE` | `/api/v1/case/${caseId}` | `None` | `{ message: string; case_id: string }` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/file/${fileId}/download-url` | `None` | `FileDownloadResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/graph${query ? `?${query}` : ''}` | `None` | `CaseGraphResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `PUT` | `/api/v1/case/${caseId}/parties/${encodeURIComponent(partyId)}` | `UpdatePartyRequest` | `UpdatePartyResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/parties/merge` | `MergePartiesRequest` | `MergePartiesResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/progress` | `None` | `CaseResult` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/result` | `None` | `CaseResult` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/start` | `StartCaseRequest` | `UploadResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/status` | `None` | `CaseStatus` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/tables?page=${page}&page_size=${pageSize}` | `None` | `CaseTablesResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/tax-year` | `None` | `TaxYearResolution` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/tax-year/confirm` | `ConfirmTaxYearRequest` | `ConfirmTaxYearResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/workflows` | `None` | `WorkflowStatusResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/workflows/cancel${params}` | `None` | `{ cancelled: string[] }` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/prepare-upload` | `PrepareUploadFile[] wrapper ({ files })` | `PrepareUploadResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/cases/status` | `Batch case ids ({ case_ids: string[] })` | `BatchStatusResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |

## Events & streaming

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/cases/${caseId}/events?${params}` | `None` | `CaseEventsResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Versioned Gunnr path |
| `GET` | `/api/v1/stream/${caseId}` | `Unknown (outside useApi.ts)` | `EventSource stream` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Streaming endpoint; Outside useApi.ts (`gunnr/ui/src/hooks/useGunnr.ts`) |
| `GET` | `/api/v1/stream/${caseId}?Last-Event-ID=${encodeURIComponent(lastEventIdRef.current)}` | `Unknown (outside useApi.ts)` | `EventSource stream` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Streaming endpoint; Outside useApi.ts (`gunnr/ui/src/hooks/useGunnr.ts`) |
| `GET` | `/api/v1/stream/${caseId}{?params}` | `Unknown (outside useApi.ts)` | `EventSource stream` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Streaming endpoint; Outside useApi.ts (`gunnr/ui/src/hooks/useSSEConnection.ts`) |

## Extraction editing & enrichment

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `POST` | `/api/v1/case/${caseId}/borrower-selection` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/review/PartiesView/usePartiesViewState.ts`) |
| `PUT` | `/api/v1/case/${caseId}/page/${fileId}/${pageNumber}/classify` | `Inline object ({ new_document_class: newDocumentClass })` | `{ workflow_id?: string }` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/patch` | `PatchCaseRequest` | `PatchCaseResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/reextract` | `ReextractRequest` | `ReextractResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/{caseId}/page/{fileId}/{pageNumber}/image` | `None` | `string (URL)` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/document-classes` | `None` | `{ document_classes: DocumentClassOption[] }` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/places/autocomplete?query=${encodeURIComponent(input)}` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/shared/AddressAutocomplete.tsx`) |
| `GET` | `/api/v1/places/details/${suggestion.place_id}` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/shared/AddressAutocomplete.tsx`) |

## Income & credit

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/case/${caseId}/income/advisor/status` | `None` | `IncomeAdvisorStatusResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...` |
| `GET` | `/api/v1/case/${caseId}/credit` | `None` | `GetCreditVerificationResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/credit-report/summary` | `None` | `CreditReportSummary` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/credit/pull` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/results/PullCreditModal.tsx`) |
| `POST` | `/api/v1/case/${caseId}/credit/pull/${creditPullWorkflowId}/cancel` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/credit/CreditTab.tsx`) |
| `GET` | `/api/v1/case/${caseId}/credit/pull/${workflowId}/status` | `None` | `CreditPullStatusResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/credit/start` | `StartCreditVerificationRequest` | `StartCreditVerificationResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/income/advisor` | `Inline object ({ scenario_id: options?.scenarioId, current_approach: options?.currentApproach, current_income: options?.currentIncome, focus_areas: options?.focusAreas, })` | `IncomeAdvisorResult` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/income/ready?loan_product=${encodeURIComponent(loanProduct)}` | `None` | `IncomeReadinessResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/income/start` | `StartIncomeVerificationRequest` | `StartIncomeVerificationResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/refinement/${encodeURIComponent(refinementId)}/income` | `None` | `GetIncomeVerificationResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/cases/${caseId}/stages/credit/excel-url` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/credit/CreditTab.tsx`) |
| `GET` | `/api/v1/income/loan-products` | `None` | `LoanProductsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |

## Review, reports & statements

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/ai/review/${caseId}/decisions` | `None` | `ReviewDecisionsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/ai/review/${caseId}/decisions` | `ReviewDecision[] wrapper ({ decisions })` | `ReviewDecisionsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/ai/review/${caseId}/reunify` | `None` | `{ workflow_id: string; status: string }` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/ai/review/${caseId}/start` | `Inline object ({ exclude_targets: excludeTargets })` | `AIReviewStartResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/ai/review/${caseId}/status?workflow_id=${encodeURIComponent(workflowId)}` | `None` | `AIReviewStatusResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/bank-statements/page-stats` | `None` | `PageStatsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `PATCH` | `/api/v1/case/${caseId}/bank-statements/reclassify` | `Reclassify updates wrapper ({ updates })` | `ReclassifyResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/bank-statements/review` | `None` | `ReviewTransactionsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/bank-statements/summary` | `None` | `BankStatementSummary` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/bank-statements/transactions${query ? `?${query}` : ''}` | `None` | `BankTransactionsResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/cases/${caseData.case_id}/stages/${stage}/excel-url` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/CaseRow.tsx`) |
| `GET` | `/api/v1/cases/${caseId}/reports` | `Unknown (outside useApi.ts)` | `ReportCatalogResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/layout/DownloadAsExcelModal.tsx`) |
| `GET` | `/api/v1/cases/${caseId}/reports/${reportType}/excel-url${qs ? ` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/layout/DownloadAsExcelModal.tsx`) |
| `GET` | `/api/v1/cases/${caseId}/stages/${stage}/excel-url${query ? `?${query}` : ''}` | `None` | `StageExcelUrlResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/cases/${caseId}/stages/extraction/excel-url` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/layout/CaseDetailSidebar.tsx`) |

## Scenarios & refinements

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/case/${caseId}/scenarios` | `None` | `ScenariosResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/scenarios` | `CreateScenarioRequest` | `CreateScenarioResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `DELETE` | `/api/v1/case/${caseId}/scenarios/${scenarioId}` | `None` | `void` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/scenarios/${scenarioId}` | `None` | `ScenarioDetail` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/scenarios/${scenarioId}/refinements` | `None` | `ListRefinementsResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/scenarios/${scenarioId}/refinements` | `CreateRefinementRequest` | `CreateRefinementResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `GET` | `/api/v1/case/${caseId}/scenarios/${scenarioId}/refinements/${refinementId}` | `None` | `RefinementDetail` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/scenarios/${scenarioId}/refinements/${refinementId}/start` | `None` | `StartRefinementResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/scenarios/${scenarioId}/start` | `None` | `StartScenarioResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |

## Specs & products

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/products/demo-loans` | `None` | `DemoLoanListResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/products/demo-loans/evaluate` | `Inline object ({ demo_loan_id: demoLoanId, inputs })` | `DemoLoanEvaluateResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/products/demo-loans/generate-sample` | `Inline object ({ demo_loan_id: demoLoanId, ...options })` | `GenerateSampleResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/samples` | `None` | `SampleListResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/samples/create` | `Inline object ({ sample_id: sampleId, case_name: caseName })` | `CreateSampleCaseResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `GET` | `/api/v1/specs` | `None` | `SpecListResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Versioned Gunnr path |
| `GET` | `/api/v1/specs/${encodeURIComponent(specId)}` | `None` | `SpecContentResponse` | Partial | Gunnr-legacy | Semantic match after legacy->Veritas normalization; Versioned Gunnr path |
| `POST` | `/api/v1/specs/evaluate` | `SpecEvaluateRequest` | `SpecEvaluateResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |
| `POST` | `/api/v1/specs/generate-sample` | `GenerateSampleRequest` | `GenerateSampleResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Versioned Gunnr path |

## Upload & files

| Method | Path | Request payload shape (TypeScript type) | Response payload shape | In `generated.ts` | Path convention | Notes/Gaps |
|---|---|---|---|---|---|---|
| `GET` | `/api/v1/case/${caseId}/files/download-zip` | `Unknown (outside useApi.ts)` | `Unknown` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path; Outside useApi.ts (`gunnr/ui/src/components/layout/CaseActionBar.tsx`) |
| `POST` | `/api/v1/case/${caseId}/files/prepare` | `PrepareUploadFile[] wrapper ({ files })` | `PrepareUploadResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/${caseId}/files/start` | `PrepareUploadFile[] wrapper ({ files })` | `StartAddFilesResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |
| `POST` | `/api/v1/case/upload` | `FormData (files)` | `UploadResponse` | No | Gunnr-legacy | No matching operation in generated.ts; Uses singular `/case`; migrate candidate to `/api/cases/{id}/...`; Versioned Gunnr path |

