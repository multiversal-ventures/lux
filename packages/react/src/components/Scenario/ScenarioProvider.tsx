import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

const caseAuditQueryKey = (caseId: string): readonly [string, string, string, string] =>
	["case", caseId, "audit", "lux-scenario"] as const;

type ScenarioDetailResponse = components["schemas"]["ScenarioDetailResponse"];
type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

interface CaseScenarioContextValue {
  caseId: string;
  scenarios: ScenarioComparisonResponse[];
  isLoading: boolean;
  /** Force a refetch when the host hasn't supplied scenarios via prop. No-op otherwise. */
  refresh: () => void;
  /**
   * The scenarioId of the currently mounted `<ScenarioProvider>` descendant,
   * if any. Lifted to the case-level context so siblings rendered ABOVE the
   * `<ScenarioProvider>` (e.g. an export modal at the case-page root) can
   * still observe which scenario the user is viewing without parsing URLs.
   *
   * `null` when no `<ScenarioProvider>` is mounted in the subtree.
   */
  activeScenarioId: string | null;
  /**
   * Internal: called by `<ScenarioProvider>` on mount / unmount to publish
   * its scenarioId. Hosts should not call this directly — use the public
   * `useActiveScenarioId()` reader instead.
   */
  _registerActiveScenarioId: (id: string | null) => void;
}

/**
 * Cache key the provider uses when auto-fetching. Hosts that route their own
 * stream/SSE invalidation can target this key (or any prefix of it) to keep
 * the provider's data fresh.
 *
 * Note: this matches gunnr's `[...caseKeys.scenarios(caseId), 'lux']`, so
 * `invalidateQueries({ queryKey: ['case', caseId, 'scenarios'] })` will partial-match
 * and refresh both views off a single SSE event.
 */
export function caseScenariosQueryKey(caseId: string): readonly [string, string, string, string] {
  return ["case", caseId, "scenarios", "lux"] as const;
}

interface ScenarioContextValue {
  caseId: string;
  scenarioId: string;
  scenario: ScenarioDetailResponse;
  audit: SpecAuditResponse[];
  refinements: RefinementResponse[];
  activeProductId: string | null;
  setActiveProductId: (id: string | null) => void;
  isLoading: boolean;
  /**
   * The refinement currently being viewed (URL-selected or latest).
   * When set, Lux components filter audit rows to only those whose
   * `manifest_id` matches this refinement, ensuring calc logs and
   * references always reflect the selected run — not a mix of all runs.
   */
  activeRefinementId: string | null;
}

const CaseScenarioContext = createContext<CaseScenarioContextValue | null>(null);
const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function useCaseScenarioContext(): CaseScenarioContextValue {
  const ctx = useContext(CaseScenarioContext);
  if (!ctx) throw new Error("CaseScenarioProvider required");
  return ctx;
}

/** Same store as `useCaseScenarioContext`, but returns null outside the provider. */
export function useMaybeCaseScenarioContext(): CaseScenarioContextValue | null {
  return useContext(CaseScenarioContext);
}

/** Same store as `useScenarioContext`, but returns null outside `ScenarioProvider`. */
export function useMaybeScenarioContext(): ScenarioContextValue | null {
  return useContext(ScenarioContext);
}

export function useScenarioContext(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("ScenarioProvider required");
  return ctx;
}

/**
 * Returns the scenarioId of the currently mounted `<ScenarioProvider>`
 * descendant of `<CaseScenarioProvider>`, or `null` if no scenario is active.
 *
 * Unlike `useScenarioContext()`, this hook works for components rendered
 * ABOVE `<ScenarioProvider>` (siblings like a case-level export modal) —
 * the inner provider lifts its scenarioId into the case context on mount.
 *
 * Returns `null` (does not throw) when called outside `<CaseScenarioProvider>`,
 * so it's safe to call from optional/portal-mounted UI.
 */
export function useActiveScenarioId(): string | null {
  return useContext(CaseScenarioContext)?.activeScenarioId ?? null;
}

export interface CaseScenarioProviderProps {
  caseId: string;
  /**
   * Explicit scenarios. When supplied, the provider does NOT fetch — the host
   * is fully responsible for keeping these fresh.
   */
  scenarios?: ScenarioComparisonResponse[];
  isLoading?: boolean;
  /**
   * When true and `scenarios` is omitted, the provider fetches the full
   * scenario comparison list via the default lux client and keeps it in the
   * shared React Query cache (see `caseScenariosQueryKey`).
   *
   * Stream-driven freshness: any host-side `invalidateQueries` on the
   * `['case', caseId, 'scenarios']` prefix will refresh this query, so plug
   * SSE/EventSource handlers into your existing invalidation pipeline and
   * the sidebar/components consuming this provider stay up to date.
   *
   * Defaults to `false` for backwards compatibility.
   */
  autoFetch?: boolean;
  /**
   * Optional polling interval (ms) used only when `autoFetch` is on. Use as a
   * fallback when the stream may be disconnected; pass `false` (default) when
   * the host invalidates via SSE.
   */
  refetchInterval?: number | false;
  children: ReactNode;
}

export function CaseScenarioProvider({
  caseId,
  scenarios: scenariosProp,
  isLoading: isLoadingProp,
  autoFetch = false,
  refetchInterval = false,
  children,
}: CaseScenarioProviderProps) {
  // Auto-fetch path uses React Query and therefore requires a QueryClient
  // ancestor. Render it through a dedicated inner component so callers that
  // pass scenarios manually (and tests / non-RQ environments) never invoke
  // `useQuery` at all.
  if (autoFetch && scenariosProp === undefined && caseId) {
    return (
      <AutoFetchingCaseScenarioProvider
        caseId={caseId}
        isLoadingProp={isLoadingProp}
        refetchInterval={refetchInterval}
      >
        {children}
      </AutoFetchingCaseScenarioProvider>
    );
  }

  return (
    <StaticCaseScenarioProvider
      caseId={caseId}
      scenarios={scenariosProp ?? []}
      isLoading={isLoadingProp ?? false}
    >
      {children}
    </StaticCaseScenarioProvider>
  );
}

function StaticCaseScenarioProvider({
  caseId,
  scenarios,
  isLoading,
  children,
}: {
  caseId: string;
  scenarios: ScenarioComparisonResponse[];
  isLoading: boolean;
  children: ReactNode;
}) {
  const [activeScenarioId, _registerActiveScenarioId] = useState<string | null>(null);
  const value = useMemo<CaseScenarioContextValue>(
    () => ({
      caseId,
      scenarios,
      isLoading,
      refresh: noopRefresh,
      activeScenarioId,
      _registerActiveScenarioId,
    }),
    [caseId, scenarios, isLoading, activeScenarioId],
  );
  return (
    <CaseScenarioContext.Provider value={value}>
      {children}
    </CaseScenarioContext.Provider>
  );
}

const noopRefresh = () => undefined;

function AutoFetchingCaseScenarioProvider({
  caseId,
  isLoadingProp,
  refetchInterval,
  children,
}: {
  caseId: string;
  isLoadingProp: boolean | undefined;
  refetchInterval: number | false;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: caseScenariosQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseScenarios(caseId),
    enabled: !!caseId,
    staleTime: 60_000,
    refetchInterval,
    // SSE qualify.completed/failed drives cache invalidation.
    // Window-focus refetch is suppressed: this endpoint hydrates every
    // scenario's refinements and is expensive — re-fetching on every
    // tab-switch would visibly re-paint the sidebar multiple times a session.
    refetchOnWindowFocus: false,
  });

  const scenarios = query.data ?? [];
  const isLoading = isLoadingProp ?? query.isLoading;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: caseScenariosQueryKey(caseId) });
  }, [queryClient, caseId]);

  const [activeScenarioId, _registerActiveScenarioId] = useState<string | null>(null);

  const value = useMemo<CaseScenarioContextValue>(
    () => ({
      caseId,
      scenarios,
      isLoading,
      refresh,
      activeScenarioId,
      _registerActiveScenarioId,
    }),
    [caseId, scenarios, isLoading, refresh, activeScenarioId],
  );

  return (
    <CaseScenarioContext.Provider value={value}>
      {children}
    </CaseScenarioContext.Provider>
  );
}

export interface ScenarioProviderProps {
  scenarioId: string;
  scenario: ScenarioDetailResponse;
  audit?: SpecAuditResponse[];
  refinements?: RefinementResponse[];
  initialProductId?: string | null;
  isLoading?: boolean;
  /** The refinement being actively viewed. Passed by the host (Gunnr ScenarioPage)
   *  from the URL refinementId or latestRefinementId. When set, all Lux
   *  components that consume the audit (calc logs, references) filter to
   *  rows from this specific run. */
  activeRefinementId?: string | null;
  children: ReactNode;
}

export function ScenarioProvider({
  scenarioId,
  scenario,
  audit: auditProp,
  refinements = [],
  initialProductId = null,
  isLoading = false,
  activeRefinementId = null,
  children,
}: ScenarioProviderProps) {
  const caseCtx = useCaseScenarioContext();
  const { caseId, _registerActiveScenarioId } = caseCtx;
  const [activeProductId, setActiveProductId] = useState<string | null>(initialProductId);

  // Publish our scenarioId to the case-level context so siblings rendered
  // ABOVE this provider (e.g. an export modal at the case page root) can
  // observe the active scenario via `useActiveScenarioId()`. Clear on unmount
  // so navigating off a scenario route resets the active id to null.
  useEffect(() => {
    _registerActiveScenarioId(scenarioId);
    return () => _registerActiveScenarioId(null);
  }, [scenarioId, _registerActiveScenarioId]);

  const auditQuery = useQuery({
    queryKey: caseAuditQueryKey(caseId),
    queryFn: () => getDefaultClient().getCaseAudit(caseId),
    enabled: auditProp === undefined && !!caseId,
    staleTime: 60_000,
  });

  const audit =
    auditProp !== undefined ? auditProp : (auditQuery.data ?? []);

  const mergedLoading = isLoading || (auditProp === undefined && auditQuery.isLoading);

  useEffect(() => {
    setActiveProductId(initialProductId);
  }, [initialProductId]);

  return (
    <ScenarioContext.Provider
      value={{
        caseId,
        scenarioId,
        scenario,
        audit,
        refinements,
        activeProductId,
        setActiveProductId,
        isLoading: mergedLoading,
        activeRefinementId,
      }}
    >
      {children}
    </ScenarioContext.Provider>
  );
}
