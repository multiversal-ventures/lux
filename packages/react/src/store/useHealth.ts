import { useEffect } from "react";
import { luxStore } from "./luxStore.js";

export interface UseHealthResult {
  status: "ok" | "degraded" | "unknown";
  services: Record<string, boolean>;
  checkedAt: string | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Subscribe to the global health slice from the lux singleton store.
 *
 * The first call (regardless of how many components mount) triggers a single
 * `/api/v1/health/live` request. Subsequent calls in the same JS session reuse
 * the cached result; the store auto-refreshes every 60 s via a module-level
 * timer.
 */
export function useHealth(): UseHealthResult {
  const health = luxStore((s) => s.health);
  const healthStatus = luxStore((s) => s.healthStatus);

  useEffect(() => {
    luxStore.getState().fetchHealth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status: health.status,
    services: health.services,
    checkedAt: health.checkedAt,
    isLoading: healthStatus === "loading" || healthStatus === "idle",
    isError: healthStatus === "error",
  };
}
