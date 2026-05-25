/**
 * Module-level Zustand singleton for the three global singletons:
 * health, version, and products.
 *
 * Why a module-level store instead of TanStack Query:
 *   - TanStack Query's dedup guarantee requires the same QueryClient
 *     instance and the same queryKey. If the host mounts multiple
 *     QueryClientProviders, or callers pass different staleTime options,
 *     the guarantee breaks.
 *   - These three resources are truly global (one per app), so a
 *     module-level Zustand store is the right primitive: one JS module
 *     instance = one store = one set of HTTP calls, regardless of how
 *     many React trees are mounted.
 *
 * Fetch-once semantics:
 *   Each `fetch*` action checks `*Status === "loading" | "loaded"` and
 *   bails early. N subscribers → 1 HTTP call.
 *
 * Health polling:
 *   After a successful (or failed) health fetch, a module-level
 *   `setTimeout` re-schedules the next check at 60 s. No React lifecycle
 *   is involved.
 *
 * Products:
 *   Always fetches the full catalog (includeDisabled: true). This is the
 *   most permissive superset, so callers requesting disabled=false still
 *   hit the same cached data. The hook layer filters down to what each
 *   caller asked for. Consequence: the `includeDisabled` option on
 *   `useTenantProducts` is now purely a UI-layer filter; `staleTime` is
 *   silently ignored (the store owns freshness).
 */

import { create } from "zustand";
import {
  getDefaultClient,
  type components,
} from "@multiversal-ventures/lux-core";

export type TenantProductRaw = components["schemas"]["ProductResponse"];

// ─── State shapes ──────────────────────────────────────────────────────────

export interface HealthSlice {
  status: "ok" | "degraded" | "unknown";
  services: Record<string, boolean>;
  checkedAt: string | null;
}

export interface VersionSlice {
  component: string;
  version: string;
  gitHash: string;
  gitBranch: string;
}

export type SliceStatus = "idle" | "loading" | "loaded" | "error";

// ─── Store interface ────────────────────────────────────────────────────────

export interface LuxStoreState {
  health: HealthSlice;
  healthStatus: SliceStatus;
  healthError: string | null;

  version: VersionSlice | null;
  versionStatus: SliceStatus;
  versionError: string | null;

  /** Full catalog fetched with `includeDisabled: true`. */
  products: TenantProductRaw[] | null;
  productsStatus: SliceStatus;
  productsError: string | null;

  /** Fetch /api/v1/health/live. Bails if already loading/loaded. */
  fetchHealth(): Promise<void>;
  /** Fetch /api/v1/version. Bails if already loading/loaded. */
  fetchVersion(): Promise<void>;
  /**
   * Fetch GET /api/products with `includeDisabled: true`. Bails if already
   * loading/loaded. `opts.includeDisabled` is accepted for API compat but
   * ignored — the store always fetches the full superset.
   */
  fetchProducts(opts?: { includeDisabled?: boolean }): Promise<void>;
}

// ─── Module-level timer (no React lifecycle) ───────────────────────────────

let _healthTimer: ReturnType<typeof setTimeout> | null = null;

function _scheduleHealthRefresh(delayMs: number): void {
  if (_healthTimer) clearTimeout(_healthTimer);
  _healthTimer = setTimeout(() => {
    _healthTimer = null;
    // Reset the gate so fetchHealth actually fires, then re-fetch.
    luxStore.setState({ healthStatus: "idle" });
    luxStore.getState().fetchHealth();
  }, delayMs);
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const luxStore = create<LuxStoreState>((set, get) => ({
  // --- health ---
  health: { status: "unknown", services: {}, checkedAt: null },
  healthStatus: "idle",
  healthError: null,

  // --- version ---
  version: null,
  versionStatus: "idle",
  versionError: null,

  // --- products ---
  products: null,
  productsStatus: "idle",
  productsError: null,

  // ─── Actions ─────────────────────────────────────────────────────────────

  async fetchHealth(): Promise<void> {
    const { healthStatus } = get();
    if (healthStatus === "loading" || healthStatus === "loaded") return;

    set({ healthStatus: "loading", healthError: null });
    if (_healthTimer) { clearTimeout(_healthTimer); _healthTimer = null; }

    try {
      const data = await getDefaultClient().requestJson<{
        status?: string;
        services?: Record<string, boolean>;
        checked_at?: string;
      }>("/api/v1/health/live");

      const mapped = data.status === "ok"
        ? "ok"
        : data.status === "degraded"
          ? "degraded"
          : "unknown";

      set({
        health: {
          status: mapped,
          services: data.services ?? {},
          checkedAt: data.checked_at ?? new Date().toISOString(),
        },
        healthStatus: "loaded",
        healthError: null,
      });

      _scheduleHealthRefresh(60_000);
    } catch (err) {
      set({
        healthStatus: "error",
        healthError: err instanceof Error ? err.message : String(err),
      });
      // Retry after 60 s even on error so a transient outage self-heals.
      _scheduleHealthRefresh(60_000);
    }
  },

  async fetchVersion(): Promise<void> {
    const { versionStatus } = get();
    if (versionStatus === "loading" || versionStatus === "loaded") return;

    set({ versionStatus: "loading", versionError: null });

    try {
      const data = await getDefaultClient().requestJson<{
        component: string;
        version: string;
        git_hash: string;
        git_branch: string;
      }>("/api/v1/version");

      set({
        version: {
          component: data.component,
          version: data.version,
          gitHash: data.git_hash,
          gitBranch: data.git_branch,
        },
        versionStatus: "loaded",
        versionError: null,
      });
    } catch (err) {
      set({
        versionStatus: "error",
        versionError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async fetchProducts(_opts?: { includeDisabled?: boolean }): Promise<void> {
    const { productsStatus } = get();
    if (productsStatus === "loading" || productsStatus === "loaded") return;

    set({ productsStatus: "loading", productsError: null });

    try {
      // Always fetch the full catalog (superset). Hook layer filters down.
      const data = await getDefaultClient().listTenantProducts({ includeDisabled: true });

      set({
        products: data,
        productsStatus: "loaded",
        productsError: null,
      });
    } catch (err) {
      set({
        productsStatus: "error",
        productsError: err instanceof Error ? err.message : String(err),
      });
    }
  },
}));
