# Gunnr UI → Lux `apps/dashboard` — screen map

**Source of truth walked:** `gunnr/ui/src/` tree (`pages`, `components`, `contexts`, `stores`, `hooks`, `types`, `utils`) — same modules now live under `apps/dashboard/src/` (see repo history for excludes: Lux `App.tsx`, `main.tsx`, `LoginPage`, `useAuth`, `lib/firebase`).

**Target:** `apps/dashboard` routes in `src/App.tsx` + nested routes in `src/pages/CasePage.tsx`.

**T3 note:** All API traffic goes through `lib/api.ts` (`apiRequest`, Bearer from `getAuth()`). That is the **same Firebase app** as `useAuth`. Replace any remaining **Gunnr-only route guards** (`ProtectedRoute`) with Lux **`TenantProtectedRoute`** + `useAuth` where still referenced.

---

## Global state & infrastructure (not a single “screen”)

| Area | Location | Role |
|------|----------|------|
| **Redux** | `store/appSlice.ts` | UI: sidebars, `currentCaseId` / `currentCaseName`, `pendingEdits`, `tenantId` / `tenantName`, `selectedLoanProduct`. |
| **React Query** | `queryClient.ts` + hooks | Server cache; keys in `hooks/useCaseQueries.ts`. |
| **SSE / events** | `stores/caseEventStore.ts`, `stores/reviewAgentStore.ts`, `hooks/useSSEConnection.ts`, `hooks/useGunnrCase.ts` | Stream events → Zustand → query invalidation (`hooks/useEventInvalidation.ts`). |
| **Case history** | `contexts/CaseHistoryContext.tsx` | `localStorage` (`gunnr_case_history`), tenant case list via React Query (`useTenantCases`, batch status), `deleteCase` API. |
| **Health** | `contexts/HealthContext.tsx` | `GET /api/v1/health` polling (bypass: `VITE_DEV_UI_ONLY`). |
| **Analytics** | `lib/analytics.ts`, `lib/mixpanel.ts`, `components/analytics/RouteObserver.tsx` | Events / page views. |

---

## Screen → route → API (summary) → state

**API column:** Representative only; full surface is `hooks/useApi.ts` + `useCaseQueries` + per-component `fetch`/`api.*` calls.

| Screen | Gunnr route | `apps/dashboard` route | APIs / transport | Owned state |
|--------|-------------|-------------------------|------------------|--------------|
| **Landing** | `/` | `/` | None (static + links). | — |
| **Login** | `/login` | `/login` | Firebase magic link (`firebase/auth`); no REST until post-login. | Local form UI (`LoginPage`). **Lux-only;** not Gunnr’s old login. |
| **Complete registration** | `/complete-registration` | `/complete-registration` | `GET /api/v1/auth/me`; `completeRegistration` + related `useApi` helpers. | Form + `useAuth`. **Auth:** `getAuth` + `fetch` Bearer — align with T3 `useAuth` / same Firebase. |
| **Home / case list** | `/app` | `/app` | Upload + case APIs via `useUpload`, `useApi` (`listSamples`, `createSampleCase`, …), case history context, analytics. | `HomePage` local UI; samples/expansion; `useCaseHistory` + context. |
| **Spec workshop** | `/spec-workshop` | `/spec-workshop` | `evaluateSpec`, `generateSampleData`, `getDemoLoans`, `evaluateDemoLoan`, `generateDemoLoanSample`, `getSpec`, … (`useApi`). | Large local editor/eval state (`SpecWorkshopPage`). |
| **Case shell** | `/case/:caseId/*` | `/case/:caseId/*` | **`useGunnrCase`** (SSE + case payload), `useCaseScenarios`, `getScenario`, layout APIs, tab modules (below). Redux dispatches for header case name. | `CasePage` view state, sidebars, `useCaseEventStore` subscription. |

### Nested under `/case/:caseId/` (same paths Gunnr `CasePage` used)

| Sub-screen | Path suffix | APIs (pattern) | Owned state |
|------------|-------------|----------------|-------------|
| **Extraction** | `…`, `extraction` | Case status/result/extraction via queries + SSE. | `ExtractionTab` + hooks. |
| **Documents** | `view` | Case result, documents, workflows. | `DocumentsTab` + sidebars. |
| **Graph** | `graph` | Case graph query keys. | `GraphTab`. |
| **Income** | `income` | Income verification + case result (`useCaseQueries` / `useApi`). | `IncomeTab`. |
| **Credit** | `credit` | Credit workflows + extraction. | `CreditTab`. |
| **Credit report** | `credit-report` | Credit report extraction endpoints. | `CreditReportTab`. |
| **Ratios** | `ratios` | Ratios + workflows. | `RatiosTab`. |
| **Bank statements** | `bank-statements` | Bank review/transactions; **image** `GET /api/v1/case/.../page/.../image` (needs auth/CORS if `VITE_GUNNR_API_URL` cross-origin). | `BankStatementsTab`. |
| **Compare** | `compare` | `useCaseScenarios`, `getIncomeVerification`, `listRefinements`. | `ComparePage`. |
| **Compliance** | `compliance` | **None** — static “Coming Soon” UI. | None. |
| **New scenario** | `new-scenario` | `cancelWorkflows`, scenario/case mutations (`useCaseQueries` / `useApi`). | `CreateScenarioPage`. |
| **Scenario** | `scenario/:scenarioId` (+ `summary`, `:productId`) | Scenario detail, income verification, refinements (`useCaseQueries`, `useApi`). | `ScenarioPage`, `ScenarioSummaryPage`, `ScenarioIncomeTab`; outlet context. |
| **Refine** | `scenario/:scenarioId/refine` | Refinement + scenario APIs. | `ScenarioRefinePage`. |

---

## Gunnr-specific auth / tenancy — T3 swap checklist

| Item | Location | Note |
|------|----------|------|
| **`ProtectedRoute`** | `components/shared/ProtectedRoute.tsx` | Gunnr flow: `fetch /api/v1/auth/me`, `/tenants/me`, `complete-registration` bypass hack. **Not used in Lux `App.tsx`** (replaced by `TenantProtectedRoute`). Remove or rewrite to delegate to `useAuth` + single tenant check to avoid drift. |
| **`TenantProtectedRoute`** | `components/TenantProtectedRoute.tsx` | Lux canonical guard: `useAuth` + `GET /api/v1/auth/me` (via `resolveApiUrl`). **Keep.** |
| **`CompleteRegistrationPage`** | `pages/CompleteRegistrationPage.tsx` | Uses `useAuth` + direct `fetch` `auth/me` — same contract as guard; ensure token source stays `useAuth` / Firebase only. |
| **Ad-hoc `getAuth()`** | Many components (`IncomeAdvisorModal`, `CaseActionBar`, SSE, …) | Same default Firebase app as `useAuth`; OK if T3 standardizes on hooks-only for readability. |
| **`VITE_DEV_UI_ONLY`** | `lib/devUiOnly.ts`, `HealthGate`, `TenantProtectedRoute` | **Dev-only** bypass; must not ship enabled. |

---

## Cannot port “as-is” (callouts)

1. **`CompliancePage`** — Marketing/placeholder only; **no backend** yet. Route exists; feature TBD.
2. **Cross-origin `VITE_GUNNR_API_URL`** — `<img src={resolveApiUrl(...)}>` and raw `EventSource` need **CORS** (and often **token** strategy for images) on Gunnr staging; not a code port gap but an **integration** requirement.
3. **Lux `LoginPage`** — Intentionally **not** Gunnr’s login implementation; behavior is magic-link + `useAuth` (product decision, already merged).

---

## File index (where screens live)

| Gunnr area | Dashboard path |
|------------|----------------|
| `pages/*.tsx` | `src/pages/*.tsx` |
| `components/**` | `src/components/**` |
| `contexts/**` | `src/contexts/**` |
| `stores/**` | `src/stores/**` |
| `hooks/**` | `src/hooks/**` |
| `types/**` | `src/types/**` |
| `utils/**` | `src/utils/**` |

For **per-component** API drilling (e.g. every `api.post` in `RatiosTab`), grep `src/components` for `api\.`, `apiRequest`, `fetch(resolveApiUrl`, and `useCaseQueries` — the table above is the routing map; hooks consolidate most REST paths under `/api/v1/...` and `/api/case/...` (income advisor).
