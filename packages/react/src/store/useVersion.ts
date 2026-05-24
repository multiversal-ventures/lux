import { useEffect } from "react";
import { luxStore, type VersionSlice } from "./luxStore.js";

export interface UseVersionResult {
  version: string | null;
  gitHash: string | null;
  gitBranch: string | null;
  component: string | null;
  isLoading: boolean;
}

/**
 * Subscribe to the global version slice from the lux singleton store.
 *
 * Returns `null` fields while loading. The first call triggers a single
 * `/api/v1/version` request. Subsequent calls in the same JS session reuse
 * the cached result.
 */
export function useVersion(): UseVersionResult {
  const version = luxStore((s) => s.version);
  const versionStatus = luxStore((s) => s.versionStatus);

  useEffect(() => {
    luxStore.getState().fetchVersion();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    version: version?.version ?? null,
    gitHash: version?.gitHash ?? null,
    gitBranch: version?.gitBranch ?? null,
    component: version?.component ?? null,
    isLoading: versionStatus === "loading" || versionStatus === "idle",
  };
}

export type { VersionSlice };
