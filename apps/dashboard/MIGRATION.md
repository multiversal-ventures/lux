# Gunnr UI → Lux `apps/dashboard` — screen map

This document mirrors a walk of **`gunnr/ui/src/`** (pages, components, contexts, stores, hooks, types, utils) against **`apps/dashboard/src/`**. Use it for parity checks and **T3** work: anything marked **auth/tenancy** depended on Gunnr’s `ProtectedRoute` / session shape and is now wired to Lux **`useAuth`**, **`lib/firebase.ts`**, and **`TenantProtectedRoute`** (see README).

---

## 1. Source layout

| Gunnr `gunnr/ui/src/` | Lux `apps/dashboard/src/` | Notes |
|----------------------|---------------------------|--------|
| `pages/` | `pages/` | Same route-oriented screens; Lux `App.tsx` + `CasePage.tsx` own routing. |
| `components/` | `components/` | Same feature areas; **no** `components/shared/ProtectedRoute.tsx` in Lux. |
| `contexts/` | `contexts/` | e.g. `CaseHistoryContext`, `HealthContext`. |
| `stores/` | `stores/` | Zustand: `caseEventStore`, `reviewAgentStore`, … |
| `hooks/` | `hooks/` | `useApi`, `useCaseQueries`, `useGunnrCase`, … |
| `types/` | `types/` | Shared TS models. |
| `utils/` | `utils/` | e.g. `scenarioDraft.ts`, `caseNameUtils.ts`. |
| `lib/` | `lib/` | Lux adds `firebase.ts`, `devUiOnly.ts`; API via `api.ts` (`resolveApiUrl`, Bearer). |
| `App.tsx`, `main.tsx` | `App.tsx`, `main.tsx` | Lux shell: `PublicRoute`, `TenantProtectedRoute`, `waitForAuth`, Redux `Provider`. |

**Auth (single path in Lux):** Firebase via **`useAuth`** + **`main.tsx`** (`initializeApp`, `waitForAuth`). Tenant gate + Redux **`tenantId` / `tenantName`**: **`TenantProtectedRoute`** (`GET /api/v1/auth/me`, optional `GET /api/v1/tenants/me`, `localStorage.bypass_tenant_check`). Gunnr **`ProtectedRoute`** is not used in the dashboard tree.

**API:** `lib/api.ts` — `resolveApiUrl`, `apiRequest`, Bearer from **`getFirebaseAuth().currentUser`** (same app as `useAuth`). Staging: **`VITE_GUNNR_API_URL`** (README, `.env.example`).

---

## 2. Global state & infrastructure

| Area | Location | Role |
|------|----------|------|
| **Redux** | `store/appSlice.ts` | Sidebars, `currentCaseId` / `currentCaseName`, `pendingEdits`, **`tenantId` / `tenantName`**, `selectedLoanProduct`. |
| **React Query** | `queryClient.ts`, `hooks/useCaseQueries.ts` | Server cache for case/scenario/workflows/bank/credit/… |
| **SSE** | `stores/caseEventStore.ts`, `hooks/useSSEConnection.ts`, `hooks/useGunnrCase.ts` | Stream → Zustand → `useEventInvalidation` → query invalidation. |
| **Case history** | `contexts/CaseHistoryContext.tsx` | `localStorage` (`gunnr_case_history`), open cases, delete. |
| **Health** | `contexts/HealthContext.tsx` | `GET /api/v1/health` (bypass: `VITE_DEV_UI_ONLY`). |
| **Analytics** | `lib/analytics.ts`, `lib/mixpanel.ts`, `components/analytics/RouteObserver.tsx` | Page / funnel events. |
| **Post-extraction nav** | `pages/caseCompletionNavigation.ts` | Redirect after extraction complete (summary vs `new-scenario`). |

---

## 3. Screen inventory (route → APIs → state → T3)

**API column:** Representative endpoints / transports; the full surface is `hooks/useApi.ts`, `hooks/useCaseQueries.ts`, per-component `fetch`/`api`, and SSE where noted.

**T3 auth/tenancy:** `Y` = screen or flow touched Gunnr-style session/tenant (now Lux); `—` = no extra hookup beyond normal Bearer + layout guard.

| Screen | Gunnr route | Dashboard route | Primary APIs / transport | Owned / local state | T3 |
|--------|-------------|-------------------|---------------------------|---------------------|-----|
| **Landing** | `/` | `/` | None | — | — |
| **Login** | `/login` | `/login` | Firebase magic link (`sendSignInLinkToEmail`, `signInWithEmailLink`) | Email UI, magic-link handling | Y (Firebase only; Lux page) |
| **Complete registration** | `/complete-registration` | `/complete-registration` | `GET /api/v1/auth/me`, tenant create via `completeRegistration` / `useApi` | Form, `useAuth`, `bypass_tenant_check` on edge errors | Y |
| **Home / case list** | `/app` | `/app` | `uploadFiles` / case start, `listSamples`, `createSampleCase`, upload progress | `HomePage`: samples UI, upload state; `CaseHistoryContext` | — |
| **Spec workshop** | `/spec-workshop` | `/spec-workshop` | `evaluateSpec`, `generateSampleData`, `getDemoLoans`, `evaluateDemoLoan`, `generateDemoLoanSample`, `getSpec`, … | Large workshop UI state (YAML, entities, demo mode) | — |
| **Case shell** | `/case/:caseId/*` | `/case/:caseId/*` | `useGunnrCase` → status/result + **`/api/v1/stream/:caseId`** (SSE); scenarios | `CasePage`: modals, extraction nav ref; Redux case name; `caseEventStore` | — |

### Nested under `/case/:caseId/` (`CasePage.tsx`)

| Sub-screen | Path (suffix) | Dashboard file(s) | Primary APIs / transport | Owned state | T3 |
|------------|---------------|-------------------|---------------------------|-------------|-----|
| **Extraction** | `/`, `/extraction` | `ExtractionTab` | Case `status` / `result`, SSE, reprocess/cancel as exposed in tab | Stepper, events display | — |
| **Documents** | `/view` | `DocumentsTab`, `Sidebar` | Case `result`, workflows, `getPageImageUrl` (auth images) | Tabs, selection, URL params (`file`, `page`) | — (cross-origin **images** need CORS if API host ≠ UI; see §5) |
| **Graph** | `/graph` | `GraphTab` | `/api/v1/case/:id/graph`, tables | Graph UI state | — |
| **Income** | `/income` | `IncomeTab` | Income verification, workflows, case result | Verification UI | — |
| **Credit** | `/credit` | `CreditTab` | Credit pull / verification APIs | Modals, workflow UI | — |
| **Credit report** | `/credit-report` | `CreditReportTab` | Credit report extraction / summary | Tab state | — |
| **Ratios** | `/ratios` | `RatiosTab` | Ratios + workflows | Tab state | — |
| **Bank statements** | `/bank-statements` | `BankStatementsTab` | Bank summary, transactions, review, reclassify; page images (`subscribeIdTokenChange` + URLs) | Large grid/filter state | — (images / SSE URL token) |
| **Compare** | `/compare` | `ComparePage` | `useCaseScenarios`, `getIncomeVerification`, `listRefinements` | Derived compare rows | — |
| **Compliance** | `/compliance` | `CompliancePage` | **None** (placeholder) | — | — |
| **New scenario** | `/new-scenario` | `CreateScenarioPage` | Scenario create/start, workflows, `useCaseQueries` | Form, loan product, **draft** (`useScenarioDraft` / utils) | — |
| **Scenario layout** | `/scenario/:id/...`, `/scenario/:id/refinement/:rid/...` | `ScenarioPage` (+ `Outlet`) | Scenario detail, refinements, income routes | Layout, nav, selected product | — |
| **Scenario summary** | `…/summary` | `ScenarioSummaryPage` | Scenario + case APIs, navigation to bank/docs | Summary UI, dialogs | — |
| **Scenario income (product)** | `…/:productId` | `ScenarioIncomeTab` | Income for scenario/refinement | Product tab state | — |
| **Refine** | `/scenario/:id/refine` | `ScenarioRefinePage` | Refinement create/start APIs | Periods / draft refinement UI | — |

**Layout chrome (case)** | (all case routes) | `CaseDetailSidebar`, `CaseActionBar`, `DownloadAsExcelModal` | Excel URLs, optional **`/api/aue/cases/:id/start`** (AUE), case workflows | Sidebar expand, downloads | **Y** — `CaseDetailSidebar` sends `tenant_id: 'default'` on AUE start; should use real **`tenantId`** from **`useAuth()`** / Redux when wiring AUE for multi-tenant staging. |

---

## 4. Map: Gunnr page module → Lux page module

| Gunnr `pages/*` (typical) | Lux `pages/*` |
|---------------------------|---------------|
| `HomePage` | `HomePage.tsx` |
| `LoginPage` | `LoginPage.tsx` (Lux-owned UX) |
| `CompleteRegistrationPage` | `CompleteRegistrationPage.tsx` |
| `SpecWorkshopPage` | `SpecWorkshopPage.tsx` |
| `CasePage` | `CasePage.tsx` |
| `CreateScenarioPage` | `CreateScenarioPage.tsx` |
| `ScenarioPage` | `ScenarioPage.tsx` |
| `ScenarioSummaryPage` | `ScenarioSummaryPage.tsx` |
| `ScenarioIncomeTab` | `ScenarioIncomeTab.tsx` |
| `ScenarioRefinePage` | `ScenarioRefinePage.tsx` |
| `ComparePage` | `ComparePage.tsx` |
| `CompliancePage` | `CompliancePage.tsx` |

Landing lives under **`components/landing/Landing.tsx`** (route `/` in `App.tsx`), not `pages/`, matching marketing shell split.

---

## 5. Cannot port “as-is” / intentional differences

1. **`LoginPage`** — Lux product copy and flow; not a verbatim copy of Gunnr’s login (same Firebase magic-link mechanism).
2. **`CompliancePage`** — UI placeholder only; no Gunnr backend until product defines it.
3. **New scenario / refine** — Gunnr may use **`ScenarioDraftEditor`** as a dedicated surface; Lux **`CreateScenarioPage`** / **`ScenarioRefinePage`** may **inline** the same draft rules via **`useScenarioDraft`** with a different component structure — behavior parity, not file-level parity.
4. **Cross-origin `VITE_GUNNR_API_URL`** — `<img src={...}>` and `EventSource` to another origin may need Gunnr API CORS and token rules; not a pure UI port issue.
5. **`VITE_DEV_UI_ONLY`** — Relaxes health + tenant route guard for local UI-only dev; must not ship enabled.

---

## 6. File index (Gunnr `src/` → Lux `apps/dashboard/src/`)

`pages/`, `components/`, `contexts/`, `stores/`, `hooks/`, `types/`, `utils/`, `lib/` — aligned module names except Lux-only: **`PublicRoute`**, **`TenantProtectedRoute`**, **`lib/firebase.ts`**, **`lib/devUiOnly.ts`**, and **no** `components/shared/ProtectedRoute.tsx`.

---

## 7. Maintainer checklist

- [ ] Routes in **`README.md`** “Routes (inventory)” match **`App.tsx`** + **`CasePage.tsx`**.
- [ ] Staging: **`VITE_GUNNR_API_URL`** + CORS verified for JSON, SSE, and image URLs you use.
- [ ] Replace hardcoded **`tenant_id: 'default'`** in AUE start with Redux / **`useAuth().tenantId`** when exercising multi-tenant Gunnr staging.
