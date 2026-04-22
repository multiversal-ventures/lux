# Fenero — Dashboard (Gunnr UI)

Vite + React app in the Lux monorepo. Talks to the **Gunnr HTTP API** (same routes as legacy `gunnr/ui`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_FIREBASE_*` | Yes (normal use) | Firebase client config for magic-link auth. |
| **`VITE_GUNNR_API_URL`** | No | Absolute origin of the Gunnr API (**no trailing slash**), e.g. `https://api.staging.example.com`. All requests that use `resolveApiUrl()` / `apiRequest()` are sent to `VITE_GUNNR_API_URL` + path (e.g. `…/api/v1/...`). **When unset**, the app uses **same-origin** URLs (`/api/...`). In local dev, Vite’s proxy (`vite.config.ts`) forwards `/api` to `http://localhost:8000` unless you point the UI at staging via this variable. |
| `VITE_DEV_UI_ONLY` | No | If `true`, skips health polling and skips login/tenant checks on protected routes so you can open `/app` without a local API. **Local debugging only**; remove before shipping. |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Firebase Analytics. |
| `VITE_MIXPANEL_TOKEN` | No | Mixpanel. |

**Staging:** set `VITE_GUNNR_API_URL` to your Gunnr staging host. The browser must be allowed by that API’s **CORS** policy. Authenticated `<img src={...}>` calls to document/image URLs may need the backend to accept your dashboard origin or use signed URLs.

Copy from `.env.example` and adjust for your machine.

## Scripts

```bash
pnpm dev          # Vite dev server (default port 3332)
pnpm build        # production build
pnpm typecheck    # TypeScript
```

From repo root: `pnpm --filter @gunnr/ui dev`.

## Routes (inventory)

**Public**

- `/` — Landing (`PublicRoute`).
- `/login` — Magic-link login (`LoginPage`; uses `useAuth`).
- `/complete-registration` — Post-auth org registration.

**Authenticated** (inside `TenantProtectedRoute` + `Layout`)

- `/app` — Case list / home (`HomePage`).
- `/spec-workshop` — Spec workshop.
- `/case/:caseId/*` — Case shell (`CasePage`) with nested routes, including:
  - `/case/:caseId` — extraction / redirect into scenario.
  - `…/extraction`, `…/view` — extraction & documents.
  - `…/graph`, `…/income`, `…/credit`, `…/credit-report`, `…/ratios`, `…/bank-statements`
  - `…/compare` — `ComparePage`
  - `…/compliance` — `CompliancePage`
  - `…/new-scenario` — `CreateScenarioPage`
  - `…/scenario/:scenarioId` (+ `summary`, `:productId`) — `ScenarioPage`, `ScenarioSummaryPage`, `ScenarioIncomeTab`
  - `…/scenario/:scenarioId/refinement/:refinementId` — same nested scenario UI with refinement in path
  - `…/scenario/:scenarioId/refine` — `ScenarioRefinePage`

Source files live under `src/pages/`; `src/App.tsx` declares top-level routes; `CasePage.tsx` declares case-scoped routes.

## API client

Shared helpers: `src/lib/api.ts` — `getGunnrApiBaseUrl()`, `resolveApiUrl(path)`, `apiRequest`, `api`, `uploadFile`, `createEventSource`.
