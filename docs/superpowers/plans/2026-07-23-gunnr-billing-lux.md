# Gunnr Billing Settings — lux Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed operator-client billing methods (`createBillingCheckout`, `recordUsage`, `getBillingStatus`) to `@multiversal-ventures/lux-core`, and matching React Query hooks (`useBillingStatus`, `useCreateBillingCheckout`) to `@multiversal-ventures/lux-react`, so gunnr-app can build a billing settings UI without any bespoke fetch code.

**Architecture:** `operator-billing.ts` mirrors `operator-cases.ts` exactly — a `createBillingMethods(base, authHeaders, request)` factory spread into `createOperatorClient`'s return value. On the React side, `useBilling.ts` mirrors `useCase.ts` — built on the existing internal `useOperatorQuery` wrapper (`hooks/_useOperatorQuery.ts`), not a new pattern. This is deliberately **not** built on `getDefaultClient()`/`initLux()` (the mechanism `useOfficerSettings` happens to use) — that's a different client entirely (`VeritasClient`, `client.ts`), unrelated to the bearer-token operator client gunnr's billing calls need.

**Tech Stack:** TypeScript, pnpm + turbo monorepo, vitest, `@tanstack/react-query`.

**Spec:** `/Users/kartikthakore/Development/fenero/work/veritas/docs/superpowers/specs/2026-07-23-gunnr-billing-settings-and-case-origin-design.md` (Part 1d).

**Branch:** `feature/stripe-billing-methods` (already created off `main`, per the branch-prep step already completed).

---

## Conventions (read first)

- Run everything from `/Users/kartikthakore/Development/fenero/work/lux`.
- Test one package: `pnpm --filter @multiversal-ventures/lux-core test` / `pnpm --filter @multiversal-ventures/lux-react test` (alias for `vitest run`).
- Single file: `pnpm --filter @multiversal-ventures/lux-core exec vitest run src/operator-billing.test.ts`.
- Typecheck: `pnpm --filter @multiversal-ventures/lux-core run typecheck` / `pnpm --filter @multiversal-ventures/lux-react run typecheck`.
- Tabs for indentation in `.ts` files (match `operator-cases.ts`/`useCase.ts` exactly — this codebase uses tabs, not spaces, in `packages/core` and `packages/react`).
- Commit after every passing task. Short conventional messages. **NO AI attribution trailers.**
- The veritas billing routes are mounted at `/integrations/stripe/{checkout,usage,status}` — **no** `/api` prefix (integration adapters auto-mount without it; confirmed against `src/veritas/integrations/stripe_billing/router.py`). Do not prepend `/api` the way `operator-cases.ts` does for first-party routes.

## Verified repo facts (baked in — do not re-derive)

- `operator-cases.ts`'s `createCaseMethods(base, authHeaders, request)` factory shape, `Result<T>` (`{data, error} | {data: null, error: {status, message}}`), and the `try { ... } catch { return {data: null, error: {status: 0, message: "Network error"}} }` pattern every method follows — copy this exactly.
- `operator-client.ts` spreads `createSpecMethods`, `createCaseMethods`, `createUploadMethods` into `createOperatorClient`'s return; `request<T>` and `authHeaders` are built once in `createOperatorClient` and passed down.
- `operator-client.test.ts`'s harness: `makeClient()` (`createOperatorClient({bearerToken: "tok-abc", baseUrl: ""})`), `ok(body)`/`fail(status, text)` Response builders, `vi.stubGlobal("fetch", vi.fn())` in `beforeEach`.
- `hooks/_useOperatorQuery.ts`: `useOperatorQuery<T>(key, fetcher, opts)` wraps `useOperatorClient()` + `useQuery`, throws `res.error` into `Query.error` on failure. `hooks/useCase.ts` is the minimal usage example.
- `providers/OperatorProvider.tsx` exports `useOperatorClient()` (throws outside provider) and `useOperatorClientOptional()`.
- `hooks/index.ts` and the package's top-level `index.ts` re-export every hook/type by hand — no barrel wildcard exports. New hooks/types must be added to both, following the exact style of the `useOfficerSettings`/`OfficerProfile` lines already there.
- `packages/core/package.json` current version: `0.2.78` (bump per Task 4 — read the actual value at implementation time, this may have moved again).

## File structure

```
packages/core/src/
  operator-billing.ts          # NEW: createBillingMethods — checkout/usage/status
  operator-billing.test.ts     # NEW: vitest
  operator-client.ts           # EDIT: spread ...createBillingMethods, re-export types
  index.ts                     # EDIT: re-export billing types

packages/react/src/hooks/
  useBilling.ts                 # NEW: useBillingStatus, useCreateBillingCheckout
  useBilling.test.tsx            # NEW: vitest + @testing-library/react (mirror useCase test pattern)
  index.ts                       # EDIT: re-export
packages/react/src/index.ts      # EDIT: re-export
```

---

## Task 1: `operator-billing.ts` — failing tests first

**Files:**
- Create: `packages/core/src/operator-billing.ts`
- Create: `packages/core/src/operator-billing.test.ts`

Read first: `packages/core/src/operator-cases.ts`, `packages/core/src/operator-client.test.ts`.

- [ ] **Step 1: Write failing tests.**

```typescript
// packages/core/src/operator-billing.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createOperatorClient } from "./operator-client.js";

function makeClient() {
	return createOperatorClient({ bearerToken: "tok-abc", baseUrl: "" });
}
function ok(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body, text: async () => "" } as unknown as Response;
}
function fail(status = 400, text = "Bad request"): Response {
	return { ok: false, status, text: async () => text } as unknown as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("createOperatorClient — billing methods", () => {
	const client = makeClient();

	it("createBillingCheckout: POSTs {product, return_url} to /integrations/stripe/checkout", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ url: "https://checkout.stripe.com/c/sess_1" }));
		const res = await client.createBillingCheckout({ product: "fenero:gunnr", returnUrl: "https://app/settings?billing=done" });
		expect(res.error).toBeNull();
		expect(res.data?.url).toContain("checkout.stripe.com");
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/integrations/stripe/checkout");
		expect(init?.method).toBe("POST");
		expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-abc");
		const body = JSON.parse(init?.body as string);
		expect(body).toEqual({ product: "fenero:gunnr", return_url: "https://app/settings?billing=done" });
	});

	it("createBillingCheckout: surfaces API error", async () => {
		vi.mocked(fetch).mockResolvedValue(fail(402, "No customer"));
		const res = await client.createBillingCheckout({ product: "fenero:gunnr", returnUrl: "r" });
		expect(res.error?.status).toBe(402);
		expect(res.error?.message).toBe("No customer");
	});

	it("recordUsage: POSTs {event_key, dedup_id} to /integrations/stripe/usage", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ status: "billed" }));
		const res = await client.recordUsage({ eventKey: "gunnr.case", dedupId: "case-42" });
		expect(res.error).toBeNull();
		expect(res.data?.status).toBe("billed");
		const [url, init] = vi.mocked(fetch).mock.calls[0];
		expect(url).toBe("/integrations/stripe/usage");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body as string)).toEqual({ event_key: "gunnr.case", dedup_id: "case-42" });
	});

	it("getBillingStatus: GETs /integrations/stripe/status with bearer", async () => {
		vi.mocked(fetch).mockResolvedValue(
			ok({ card_status: "active", stripe_customer_id: "cus_1", free_allotment_used: 4, free_allotment_total: 100 }),
		);
		const res = await client.getBillingStatus();
		expect(res.error).toBeNull();
		expect(res.data?.card_status).toBe("active");
		expect(res.data?.free_allotment_total).toBe(100);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/integrations/stripe/status");
		expect((vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-abc");
	});

	it("returns network error on fetch throw", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("offline"));
		const res = await client.getBillingStatus();
		expect(res.error?.status).toBe(0);
		expect(res.error?.message).toBe("Network error");
	});
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @multiversal-ventures/lux-core exec vitest run src/operator-billing.test.ts`
Expected: FAIL (`client.createBillingCheckout is not a function`)

- [ ] **Step 3: Implement `operator-billing.ts`.**

```typescript
// packages/core/src/operator-billing.ts
import type { Result } from "./operator-types.js";

// Inline until veritas publishes these routes to OpenAPI; then replace with
// components["schemas"][...] and run `pnpm codegen` (same pattern as the
// inline CreatePortalTokenRequest in operator-cases.ts).
export type BillingCheckoutRequest = { product: string; returnUrl: string };
export type BillingCheckoutResponse = { url: string };
export type RecordUsageRequest = { eventKey: string; dedupId: string };
// Mirrors veritas RecordResult: waived|billed|blocked|failed|errored|duplicate.
export type RecordUsageResponse = { status: string; ledger_id?: number | null; stripe_event_id?: string | null };
export type BillingStatusResponse = {
	card_status: string;
	stripe_customer_id?: string | null;
	free_allotment_used: number;
	free_allotment_total: number;
};

// stripe_billing is an integration adapter — mounts WITHOUT the /api prefix
// veritas's first-party routers get (confirmed against
// src/veritas/integrations/stripe_billing/router.py).
const PATHS = {
	checkout: "/integrations/stripe/checkout",
	usage: "/integrations/stripe/usage",
	status: "/integrations/stripe/status",
} as const;

/**
 * Billing methods bound to a shared request context. Spread into the
 * OperatorClient return value, identical to createCaseMethods.
 */
export function createBillingMethods(
	base: string,
	authHeaders: (extra?: Record<string, string>) => Record<string, string>,
	request: <T>(res: Response) => Promise<Result<T>>,
) {
	/** Create a setup-mode Stripe Checkout session; returns the hosted URL to redirect to. */
	async function createBillingCheckout(
		body: BillingCheckoutRequest,
	): Promise<Result<BillingCheckoutResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.checkout}`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ product: body.product, return_url: body.returnUrl }),
			});
			return await request<BillingCheckoutResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Meter one billable unit. Only used by out-of-veritas completion paths — gunnr's own
	 * case-close billing is triggered veritas-side, not from this client. */
	async function recordUsage(body: RecordUsageRequest): Promise<Result<RecordUsageResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.usage}`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ event_key: body.eventKey, dedup_id: body.dedupId }),
			});
			return await request<RecordUsageResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	/** Card status + lifetime free-case allotment usage for the caller's tenant. */
	async function getBillingStatus(): Promise<Result<BillingStatusResponse>> {
		try {
			const res = await fetch(`${base}${PATHS.status}`, { headers: authHeaders() });
			return await request<BillingStatusResponse>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	return { createBillingCheckout, recordUsage, getBillingStatus };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @multiversal-ventures/lux-core exec vitest run src/operator-billing.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/operator-billing.ts packages/core/src/operator-billing.test.ts
git commit -m "feat(billing): operator-billing methods (checkout, usage, status)"
```

---

## Task 2: Spread into `createOperatorClient`, re-export types

**Files:**
- Modify: `packages/core/src/operator-client.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Edit `operator-client.ts`.**

```typescript
export type {
	// ... existing exports ...
	BillingCheckoutRequest,
	BillingCheckoutResponse,
	RecordUsageRequest,
	RecordUsageResponse,
	BillingStatusResponse,
} from "./operator-billing.js";

import { createBillingMethods } from "./operator-billing.js";

// ... inside createOperatorClient's return:
	return {
		...createSpecMethods(base, authHeaders, request),
		...createCaseMethods(base, authHeaders, request),
		...createUploadMethods(base, authHeaders, request),
		...createBillingMethods(base, authHeaders, request),
	};
```

- [ ] **Step 2: Edit `packages/core/src/index.ts`** to re-export the same types at the package root (check the exact re-export style already used there for `operator-cases.ts`'s types and mirror it for billing).

- [ ] **Step 3: Run the full operator-client test suite**

Run: `pnpm --filter @multiversal-ventures/lux-core exec vitest run src/operator-client.test.ts src/operator-billing.test.ts`
Expected: PASS

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @multiversal-ventures/lux-core run typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/operator-client.ts packages/core/src/index.ts
git commit -m "feat(billing): spread billing methods into createOperatorClient"
```

---

## Task 3: `useBillingStatus` / `useCreateBillingCheckout` in lux-react

**Files:**
- Create: `packages/react/src/hooks/useBilling.ts`
- Create: `packages/react/src/hooks/useBilling.test.tsx`
- Modify: `packages/react/src/hooks/index.ts`
- Modify: `packages/react/src/index.ts`

Read first: `packages/react/src/hooks/_useOperatorQuery.ts`, `packages/react/src/hooks/useCase.ts`, `packages/react/src/providers/OperatorProvider.tsx` (`useOperatorClient`), and one existing mutation-shaped hook if any exists (check `hooks/useCreatePortalLink.ts` for the `useMutation` + `useOperatorClient()` pattern, since `useCase.ts` only demonstrates the query side).

- [ ] **Step 1: Write failing tests.** Mirror `useQualification.test.tsx`'s harness exactly — it's the one existing hook test that actually renders through `OperatorProvider` (`useCasesList.test.tsx` mocks `getDefaultClient()` instead — the *other* client, per this plan's architecture note — do not copy that one). The critical detail: when `OperatorProvider` is given a `queryClient` prop, it deliberately does **not** wrap children in its own `<QueryClientProvider>` (it assumes one already exists above it, for cache-sharing) — so the test wrapper must supply an **outer** `<QueryClientProvider>` sharing the same instance, or every `useQuery`/`useMutation` call throws `"No QueryClient set"`. Example shape:

```tsx
// packages/react/src/hooks/useBilling.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { OperatorProvider } from "../providers/OperatorProvider.js";
import { useBillingStatus, useCreateBillingCheckout } from "./useBilling.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return (
		<QueryClientProvider client={qc}>
			<OperatorProvider bearerToken="tok-abc" queryClient={qc}>
				{children}
			</OperatorProvider>
		</QueryClientProvider>
	);
}

function ok(body: unknown): Response {
	return { ok: true, status: 200, json: async () => body, text: async () => "" } as unknown as Response;
}

beforeEach(() => {
	vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
	vi.restoreAllMocks();
});

describe("useBillingStatus", () => {
	it("fetches billing status via the operator client", async () => {
		vi.mocked(fetch).mockResolvedValue(
			ok({ card_status: "active", free_allotment_used: 1, free_allotment_total: 100 }),
		);
		const { result } = renderHook(() => useBillingStatus(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.card_status).toBe("active");
	});
});

describe("useCreateBillingCheckout", () => {
	it("mutates and returns the checkout URL", async () => {
		vi.mocked(fetch).mockResolvedValue(ok({ url: "https://checkout.stripe.com/c/sess_1" }));
		const { result } = renderHook(() => useCreateBillingCheckout(), { wrapper });
		result.current.mutate({ product: "fenero:gunnr", returnUrl: "https://app/settings" });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));
		expect(result.current.data?.url).toContain("checkout.stripe.com");
	});
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @multiversal-ventures/lux-react exec vitest run src/hooks/useBilling.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `useBilling.ts`.**

```typescript
// packages/react/src/hooks/useBilling.ts
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import type {
	BillingCheckoutRequest,
	BillingCheckoutResponse,
	BillingStatusResponse,
} from "@multiversal-ventures/lux-core";
import { useOperatorClient } from "../providers/OperatorProvider.js";
import { useOperatorQuery } from "./_useOperatorQuery.js";

/** Card status + lifetime free-case allotment for the current operator's tenant. */
export function useBillingStatus() {
	return useOperatorQuery<BillingStatusResponse>(
		["billing-status"],
		(client) => client.getBillingStatus(),
	);
}

/** Launch a setup-mode Stripe Checkout session; resolves with the hosted URL to redirect to. */
export function useCreateBillingCheckout(): UseMutationResult<
	BillingCheckoutResponse,
	{ status: number; message: string },
	BillingCheckoutRequest
> {
	const client = useOperatorClient();
	return useMutation<BillingCheckoutResponse, { status: number; message: string }, BillingCheckoutRequest>({
		mutationFn: async (body) => {
			const res = await client.createBillingCheckout(body);
			if (res.error) throw res.error;
			return res.data as BillingCheckoutResponse;
		},
	});
}
```

Verify the exact `useMutation` import/typing style against an existing mutation hook in this package (e.g. `useCreatePortalLink.ts` or `useOfficerSettings.ts`'s `useSetOfficerAvatar`) and match it precisely rather than inventing new conventions.

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter @multiversal-ventures/lux-react exec vitest run src/hooks/useBilling.test.tsx`
Expected: PASS

- [ ] **Step 5: Re-export.** In `packages/react/src/hooks/index.ts`:

```typescript
export { useBillingStatus, useCreateBillingCheckout } from "./useBilling.js";
```

In `packages/react/src/index.ts`, add the same to the hooks re-export block (alongside `useOfficerSettings, useSetOfficerAvatar`).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @multiversal-ventures/lux-react run typecheck`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/hooks/useBilling.ts packages/react/src/hooks/useBilling.test.tsx packages/react/src/hooks/index.ts packages/react/src/index.ts
git commit -m "feat(billing): useBillingStatus and useCreateBillingCheckout hooks"
```

---

## Task 4: Version bump + publish

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/react/package.json`

**Publish trigger is a tag push, NOT a merge to `main`.** `.github/workflows/package.yml`'s `on:` block only fires on `push: branches: ["release/*"]` and `push: tags: ["v*"]` — there is no `pull_request` trigger and no trigger on push to `main`. Merging the PR alone publishes nothing; a `vX.Y.Z` tag must be pushed afterward (matching git history precedent: `v0.2.76`/`v0.2.77`/`v0.2.78` all sit directly on `main`'s merge commits). Skipping this step means gunnr-app's plan (which depends on this package existing on the registry) has nothing to install.

- [ ] **Step 1: Check current versions**

Run: `cat packages/core/package.json packages/react/package.json | grep '"version"'`

- [ ] **Step 2: Bump both packages** (minor bump — new feature, no breaking change) to the same new version, e.g. current `0.2.78` → `0.2.79`.

- [ ] **Step 3: Commit the version bump**

```bash
git add packages/core/package.json packages/react/package.json
git commit -m "chore: bump lux-core/lux-react for billing methods"
```

- [ ] **Step 4: Open a PR to `main`.** Do not push directly to `main`. Follow the repo's standard PR process.

- [ ] **Step 5: After the PR merges, tag the merge commit and push the tag** — this is what actually triggers `package.yml`'s `publish` job:

```bash
git checkout main && git pull origin main
git tag v0.2.79   # match Step 2's bumped version exactly
git push origin v0.2.79
```

- [ ] **Step 6: Confirm the publish workflow ran and succeeded** (check the Actions tab for the `package.yml` run triggered by the tag push), then confirm the new version is installable:

Run: `npm view @multiversal-ventures/lux-core versions --registry=https://npm.pkg.github.com 2>&1 | tail -5`
Expected: the newly tagged version appears in the list.

---

## Final verification

- [ ] `pnpm --filter @multiversal-ventures/lux-core test && pnpm --filter @multiversal-ventures/lux-react test`
- [ ] `pnpm --filter @multiversal-ventures/lux-core run typecheck && pnpm --filter @multiversal-ventures/lux-react run typecheck`
- [ ] Confirm the PR is merged AND the version tag is pushed AND the publish workflow succeeds off that tag — this is what gunnr-app's plan depends on before it can bump its `@multiversal-ventures/lux-core`/`lux-react` pin. A merge alone is not enough.
