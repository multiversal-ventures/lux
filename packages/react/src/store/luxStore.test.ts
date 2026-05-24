/**
 * Tests for the lux Zustand singleton store (health, version, products)
 * and the useHealth / useVersion hooks.
 *
 * Mocking strategy: we use `vi.mock("@multiversal-ventures/lux-core")` to
 * intercept `getDefaultClient()` — the same approach used in
 * `useCreateRefinement.test.tsx` and `useCreateScenarioWithRefinement.test.tsx`.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { luxStore } from "./luxStore.js";
import { useHealth } from "./useHealth.js";
import { useVersion } from "./useVersion.js";

// ─── Mock lux-core ──────────────────────────────────────────────────────────

const mockClient = {
  requestJson: vi.fn(),
  listTenantProducts: vi.fn(),
};

vi.mock("@multiversal-ventures/lux-core", async () => {
  const actual = await vi.importActual<typeof import("@multiversal-ventures/lux-core")>(
    "@multiversal-ventures/lux-core",
  );
  return {
    ...actual,
    getDefaultClient: () => mockClient,
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

const HEALTH_RESPONSE = {
  status: "ok",
  services: { db: true, redis: true },
  checked_at: "2026-01-01T00:00:00Z",
};

const VERSION_RESPONSE = {
  component: "gunnr",
  version: "1.2.3",
  git_hash: "abc1234",
  git_branch: "main",
};

const PRODUCTS_RESPONSE = [
  {
    product_id: "fannie_mae",
    display_name: "Fannie Mae",
    agency: "FNMA",
    agency_path: "fnma_multiple_entities",
    description: null,
    spec_filter: [],
    income_document_types: [],
    credit_document_types: [],
    default_calculation_track: null,
    config: {},
    enabled: true,
    is_default: true,
    sort_order: 1,
    groups: [],
    initial_required_inputs: [],
  },
];

// Reset store state AND mock call counts before each test.
beforeEach(() => {
  // Clear any module-level timers set by the store (e.g. the 60 s health refresh)
  // without enabling fake timers — fake timers break waitFor() which uses setTimeout
  // internally for its polling loop.
  vi.clearAllTimers();

  // Reset store slices to initial "idle" state
  luxStore.setState({
    health: { status: "unknown", services: {}, checkedAt: null },
    healthStatus: "idle",
    healthError: null,
    version: null,
    versionStatus: "idle",
    versionError: null,
    products: null,
    productsStatus: "idle",
    productsError: null,
  });

  mockClient.requestJson.mockReset();
  mockClient.listTenantProducts.mockReset();
});

// ─── Store unit tests (no React) ────────────────────────────────────────────

describe("luxStore.fetchHealth", () => {
  it("makes exactly one HTTP call when invoked twice concurrently", async () => {
    mockClient.requestJson.mockResolvedValueOnce(HEALTH_RESPONSE);

    // Fire both at the same time — first call sets status to "loading",
    // second call should bail early because status is already "loading".
    await Promise.all([
      luxStore.getState().fetchHealth(),
      luxStore.getState().fetchHealth(),
    ]);

    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
    expect(mockClient.requestJson).toHaveBeenCalledWith("/api/v1/health/live");
  });

  it("makes exactly one HTTP call when invoked twice sequentially", async () => {
    mockClient.requestJson.mockResolvedValueOnce(HEALTH_RESPONSE);

    await luxStore.getState().fetchHealth();
    await luxStore.getState().fetchHealth(); // status is now "loaded" → bail

    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
  });

  it("stores health data correctly after a successful fetch", async () => {
    mockClient.requestJson.mockResolvedValueOnce(HEALTH_RESPONSE);
    await luxStore.getState().fetchHealth();

    const { health, healthStatus, healthError } = luxStore.getState();
    expect(healthStatus).toBe("loaded");
    expect(health.status).toBe("ok");
    expect(health.services).toEqual({ db: true, redis: true });
    expect(health.checkedAt).toBe("2026-01-01T00:00:00Z");
    expect(healthError).toBeNull();
  });

  it("transitions to error status on fetch failure", async () => {
    mockClient.requestJson.mockRejectedValueOnce(new Error("network error"));
    await luxStore.getState().fetchHealth();

    expect(luxStore.getState().healthStatus).toBe("error");
    expect(luxStore.getState().healthError).toBe("network error");
  });

  it("re-fetches after reset to idle (force re-fetch pattern)", async () => {
    mockClient.requestJson
      .mockResolvedValueOnce(HEALTH_RESPONSE)
      .mockResolvedValueOnce({ ...HEALTH_RESPONSE, status: "degraded" });

    await luxStore.getState().fetchHealth();
    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);

    // Simulate force re-fetch: reset gate + fetch again
    luxStore.setState({ healthStatus: "idle" });
    await luxStore.getState().fetchHealth();

    expect(mockClient.requestJson).toHaveBeenCalledTimes(2);
    expect(luxStore.getState().health.status).toBe("degraded");
  });
});

describe("luxStore.fetchVersion", () => {
  it("makes exactly one HTTP call when invoked twice concurrently", async () => {
    mockClient.requestJson.mockResolvedValueOnce(VERSION_RESPONSE);

    await Promise.all([
      luxStore.getState().fetchVersion(),
      luxStore.getState().fetchVersion(),
    ]);

    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
    expect(mockClient.requestJson).toHaveBeenCalledWith("/api/v1/version");
  });

  it("makes exactly one HTTP call when invoked twice sequentially", async () => {
    mockClient.requestJson.mockResolvedValueOnce(VERSION_RESPONSE);

    await luxStore.getState().fetchVersion();
    await luxStore.getState().fetchVersion();

    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
  });

  it("stores version data correctly, mapping snake_case to camelCase", async () => {
    mockClient.requestJson.mockResolvedValueOnce(VERSION_RESPONSE);
    await luxStore.getState().fetchVersion();

    const { version, versionStatus } = luxStore.getState();
    expect(versionStatus).toBe("loaded");
    expect(version?.version).toBe("1.2.3");
    expect(version?.gitHash).toBe("abc1234");
    expect(version?.gitBranch).toBe("main");
    expect(version?.component).toBe("gunnr");
  });
});

describe("luxStore.fetchProducts", () => {
  it("makes exactly one HTTP call regardless of includeDisabled option", async () => {
    mockClient.listTenantProducts.mockResolvedValueOnce(PRODUCTS_RESPONSE);

    // Two callers — one with includeDisabled: false (default), one with true.
    await Promise.all([
      luxStore.getState().fetchProducts({ includeDisabled: false }),
      luxStore.getState().fetchProducts({ includeDisabled: true }),
    ]);

    expect(mockClient.listTenantProducts).toHaveBeenCalledTimes(1);
    // Always fetches the full superset
    expect(mockClient.listTenantProducts).toHaveBeenCalledWith({ includeDisabled: true });
  });

  it("makes exactly one call when invoked sequentially with different options", async () => {
    mockClient.listTenantProducts.mockResolvedValueOnce(PRODUCTS_RESPONSE);

    await luxStore.getState().fetchProducts({ includeDisabled: false });
    await luxStore.getState().fetchProducts({ includeDisabled: true });

    expect(mockClient.listTenantProducts).toHaveBeenCalledTimes(1);
  });

  it("stores raw products correctly", async () => {
    mockClient.listTenantProducts.mockResolvedValueOnce(PRODUCTS_RESPONSE);
    await luxStore.getState().fetchProducts();

    const { products, productsStatus } = luxStore.getState();
    expect(productsStatus).toBe("loaded");
    expect(products).toHaveLength(1);
    expect(products?.[0]?.product_id).toBe("fannie_mae");
  });
});

// ─── React hook tests ────────────────────────────────────────────────────────

describe("useHealth hook", () => {
  it("starts with isLoading: true while fetch is in flight", async () => {
    // Never resolve — the promise stays pending
    mockClient.requestJson.mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    const { result } = renderHook(() => useHealth());
    // Still loading (either "idle" → "loading" transition)
    expect(result.current.isLoading).toBe(true);
  });

  it("returns isLoading: false and correct status after fetch resolves", async () => {
    mockClient.requestJson.mockResolvedValueOnce(HEALTH_RESPONSE);

    const { result } = renderHook(() => useHealth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.status).toBe("ok");
    expect(result.current.services).toEqual({ db: true, redis: true });
    expect(result.current.isError).toBe(false);
  });

  it("returns isError: true when fetch fails", async () => {
    mockClient.requestJson.mockRejectedValueOnce(new Error("timeout"));

    const { result } = renderHook(() => useHealth());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
  });

  it("does not trigger a second HTTP call when two hooks mount", async () => {
    mockClient.requestJson.mockResolvedValue(HEALTH_RESPONSE);

    renderHook(() => useHealth());
    const { result } = renderHook(() => useHealth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The fetch was already in flight / loaded from the first hook;
    // the second hook should have bailed early.
    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
  });
});

describe("useVersion hook", () => {
  it("starts with null fields while loading", () => {
    mockClient.requestJson.mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    const { result } = renderHook(() => useVersion());

    expect(result.current.version).toBeNull();
    expect(result.current.gitHash).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("populates version fields after fetch resolves", async () => {
    mockClient.requestJson.mockResolvedValueOnce(VERSION_RESPONSE);

    const { result } = renderHook(() => useVersion());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.version).toBe("1.2.3");
    expect(result.current.gitHash).toBe("abc1234");
    expect(result.current.gitBranch).toBe("main");
    expect(result.current.component).toBe("gunnr");
  });

  it("does not trigger a second HTTP call when two hooks mount", async () => {
    mockClient.requestJson.mockResolvedValue(VERSION_RESPONSE);

    renderHook(() => useVersion());
    const { result } = renderHook(() => useVersion());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockClient.requestJson).toHaveBeenCalledTimes(1);
  });
});
