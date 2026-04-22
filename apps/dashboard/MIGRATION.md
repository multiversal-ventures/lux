# Gunnr UI → Lux `apps/dashboard` — screen map

## Source layout

| Location | Role |
|----------|------|
| **Upstream Gunnr UI** | `/Users/peyman/Projects/gunnr/ui` (sibling repo; **not** inside Lux). `App.tsx` still wraps authenticated routes with `ProtectedRoute` + `PublicRoute` from `components/shared/`. |
| **Lux dashboard** | `apps/dashboard/src/` — same feature modules, with **Lux-owned shell**: `App.tsx`, `main.tsx`, `queryClient.ts`, `components/PublicRoute.tsx`, `components/TenantProtectedRoute.tsx`, `hooks/useAuth.ts`, `lib/firebase.ts`, `lib/devUiOnly.ts`. |

**Auth (single path in Lux):** Firebase session via `useAuth` + `main.tsx` (`initializeApp`, `waitForAuth`). Tenant/org gate and Redux `tenantId` / `tenantName` hydration live only in **`TenantProtectedRoute`** (`useAuth` + `GET /api/v1/auth/me` + optional `GET /api/v1/tenants/me`, `localStorage.bypass_tenant_check` for rare false negatives). Gunnr’s **`ProtectedRoute`** was **removed** from the dashboard tree; do not reintroduce a second guard.

**API:** `lib/api.ts` — `resolveApiUrl`, `apiRequest`, Bearer from `getAuth()` (same default Firebase app as `useAuth`). Staging: set **`VITE_GUNNR_API_URL`** (see `README.md`, `.env.example`).

---

## Global state & infrastructure

| Area | Location | Role |
|------|----------|------|
| **Redux** | `store/appSlice.ts` | Sidebars, `currentCaseId` / `currentCaseName`, `pendingEdits`, `tenantId` / `tenantName`, `selectedLoanProduct`. |
| **React Query** | `queryClient.ts` + hooks | Server cache; keys in `hooks/useCaseQueries.ts`. |
| **SSE / events** | `stores/caseEventStore.ts`, `stores/reviewAgentStore.ts`, `hooks/useSSEConnection.ts`, `hooks/useGunnrCase.ts` | Events → Zustand → invalidation (`hooks/useEventInvalidation.ts`). |
| **Case history** | `contexts/CaseHistoryContext.tsx` | `localStorage` (`gunnr_case_history`), tenant cases, `deleteCase`. |
| **Health** | `contexts/HealthContext.tsx` | `GET /api/v1/health` (bypass: `VITE_DEV_UI_ONLY`). |
| **Analytics** | `lib/analytics.ts`, `lib/mixpanel.ts`, `components/analytics/RouteObserver.tsx` | Events / page views. |
| **Post-extraction nav** | `pages/caseCompletionNavigation.ts` | Shared with Gunnr: summary vs `new-scenario` (`CasePage` adds polling before final redirect). |

---

## Screen → route → API (summary) → state

**API column:** Representative; full surface is `hooks/useApi.ts`, `useCaseQueries`, and per-file `fetch` / `api.*` / SSE.

| Screen | Gunnr route | Dashboard route | APIs / transport | Owned state |
|--------|-------------|-----------------|------------------|-------------|
| **Landing** | `/` | `/` | None. | — |
| **Login** | `/login` | `/login` | Firebase magic link. | `LoginPage` (Lux implementation). |
| **Complete registration** | `/complete-registration` | `/complete-registration` | `GET /api/v1/auth/me`, `completeRegistration` (`useApi`). | Form + `useAuth`; `bypass_tenant_check` on edge-case errors. |
| **Home** | `/app` | `/app` | Upload, samples, case list, case history, analytics. | `HomePage` + context. |
| **Spec workshop** | `/spec-workshop` | `/spec-workshop` | Spec eval / demo loan APIs (`useApi`). | Large local state. |
| **Case shell** | `/case/:caseId/*` | `/case/:caseId/*` | `useGunnrCase` (SSE), scenarios, layout APIs, tabs below. | `CasePage`, Redux case name, event store. |

### Nested under `/case/:caseId/`

| Sub-screen | Path suffix | APIs (pattern) | Notes |
|------------|-------------|----------------|--------|
| **Extraction** | `…`, `extraction` | Case status / result / extraction + SSE | Uses `getCaseCompletionRedirect` after complete. |
| **Documents** | `view` | Case result, workflows | |
| **Graph** | `graph` | Graph queries | |
| **Income** | `income` | Income verification, case result | |
| **Credit** | `credit` | Credit workflows | |
| **Credit report** | `credit-report` | Credit report extraction | |
| **Ratios** | `ratios` | Ratios + workflows | |
| **Bank statements** | `bank-statements` | Bank APIs; **images** may need CORS + auth strategy if API is cross-origin. | |
| **Compare** | `compare` | Scenarios, refinements, income verification | |
| **Compliance** | `compliance` | **None** — placeholder UI. | |
| **New scenario** | `new-scenario` | Scenario create / workflows | Gunnr uses `ScenarioDraftEditor` + `useScenarioDraft`; Lux **inlines** draft UX in `CreateScenarioPage` (same feature, different structure). |
| **Scenario** | `scenario/:scenarioId`, `summary`, `:productId` | Scenario + income APIs | |
| **Refine** | `scenario/:scenarioId/refine` | Refinement APIs | Gunnr `ScenarioRefinePage` uses draft editor; Lux uses tab layout (`PeriodsTab`, …). |

---

## Parity / portability callouts

1. **`CompliancePage`** — No backend; route only.
2. **Cross-origin `VITE_GUNNR_API_URL`** — CORS; `<img>` / `EventSource` may need backend support.
3. **Lux `LoginPage`** — Product choice vs copying Gunnr’s login verbatim.
4. **`VITE_DEV_UI_ONLY`** — Dev-only; must not ship enabled.

---

## File index (Gunnr `src/` → Lux `apps/dashboard/src/`)

`pages/`, `components/`, `contexts/`, `stores/`, `hooks/`, `types/`, `utils/`, `lib/` — same names except Lux-only files above and **no** `components/shared/ProtectedRoute.tsx` in dashboard.
