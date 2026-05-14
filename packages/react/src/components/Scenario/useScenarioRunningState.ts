import { useCallback, useSyncExternalStore } from "react";
import type { components } from "@fenero/lux-core";
import { useMaybeCaseScenarioContext } from "./ScenarioProvider.js";
import { getScenarioRunsStore } from "../../state/scenarioRunsStore.js";

type ScenarioComparisonResponse = components["schemas"]["ScenarioComparisonResponse"];
type RefinementResponse = components["schemas"]["RefinementResponse"];

/**
 * Phase classification a UI can branch on. ``running`` means there is
 * either a scenario- or refinement-level computation in flight; ``idle``
 * means the latest server-confirmed state is terminal (completed /
 * failed) AND no client-side pulse is fresh.
 */
export type ScenarioRunPhase = "idle" | "running";

export interface ScenarioRunningState {
  /**
   * High-level phase. ``true`` for ``isRunning`` is the common
   * predicate consumers branch on — see ``<ScenarioRunningPanel>``.
   */
  phase: ScenarioRunPhase;
  /** Convenience boolean — same signal as ``phase === "running"``. */
  isRunning: boolean;
  /** Server-confirmed scenario status, when known (``running``/``pending``/``completed``/``failed``/...). */
  scenarioStatus: string | null;
  /** Server-confirmed status of the latest refinement, when one exists. */
  refinementStatus: string | null;
  /** Refinement number of the latest refinement, when present. */
  latestRefinementNum: number | null;
  /** Free-text note on the latest refinement (e.g. "Refined with 2 extraction edits"). */
  latestRefinementNote: string | null;
  /**
   * True when ``markJustStarted(scenarioId)`` was called recently. Lets
   * UIs render the loader IMMEDIATELY after Save & Run, before the
   * scenarios query has refetched the new ``running`` status.
   */
  justStarted: boolean;
}

const IDLE: ScenarioRunningState = {
  phase: "idle",
  isRunning: false,
  scenarioStatus: null,
  refinementStatus: null,
  latestRefinementNum: null,
  latestRefinementNote: null,
  justStarted: false,
};

function pickLatestRefinement(
  refinements: readonly RefinementResponse[],
): RefinementResponse | null {
  if (refinements.length === 0) return null;
  return [...refinements].sort(
    (a, b) => (b.refinement_num ?? -1) - (a.refinement_num ?? -1),
  )[0] ?? null;
}

/**
 * Server-confirmed running status: a scenario is "running" when either
 * its own row is in a non-terminal state OR its latest refinement is.
 *
 * The two layers are separate on purpose: a scenario whose first run
 * already completed can still kick off a NEW refinement (e.g. the
 * inline expense-factor edit on the summary page) — that refinement's
 * status flips to ``running`` while the scenario row stays at
 * ``completed`` from the prior pass. Both signals must be consulted
 * to keep the loader visible during such mid-stream re-runs.
 */
function deriveServerRunning(
  scenarioStatus: string | null,
  refinementStatus: string | null,
): boolean {
  const RUNNING = new Set(["running", "pending"]);
  return (
    (scenarioStatus !== null && RUNNING.has(scenarioStatus)) ||
    (refinementStatus !== null && RUNNING.has(refinementStatus))
  );
}

/**
 * Subscribe to the just-started pulse for ``scenarioId``. ``null``
 * scenarioId returns a stable ``false`` and never re-renders.
 */
function useJustStartedPulse(scenarioId: string | null): boolean {
  const store = getScenarioRunsStore();
  return useSyncExternalStore(
    store.subscribe,
    () => (scenarioId == null ? false : store.getState().isJustStarted(scenarioId)),
    () => false, // SSR safe
  );
}

/**
 * Compute "is this scenario currently running?" by combining
 * ``CaseScenarioContext`` (server-confirmed scenarios + refinements)
 * with the client-side just-started pulse from ``scenarioRunsStore``.
 *
 * Falls back to ``IDLE`` when:
 *   - ``scenarioId`` is null (host hasn't picked one yet), or
 *   - the hook is called outside ``<CaseScenarioProvider>`` (the
 *     ``useMaybeCaseScenarioContext`` reader returns ``null`` so the
 *     hook stays safe to call from optional/portal-mounted UI).
 *
 * Re-renders on:
 *   - changes to the cached scenarios list (already reactive via
 *     React Query / context),
 *   - pulse changes for THIS scenarioId (zustand ``subscribe`` +
 *     ``useSyncExternalStore``).
 *
 * The pulse is suppressed when the server has confirmed a terminal
 * status (completed/failed). That guards against a stale pulse pinning
 * the loader after a quick run — the latest server state always wins
 * once it's known.
 */
export function useScenarioRunningState(
  scenarioId: string | null,
): ScenarioRunningState {
  const ctx = useMaybeCaseScenarioContext();
  const justStarted = useJustStartedPulse(scenarioId);

  if (!scenarioId || !ctx) {
    return justStarted
      ? { ...IDLE, justStarted: true, phase: "running", isRunning: true }
      : IDLE;
  }

  const scenario: ScenarioComparisonResponse | undefined = ctx.scenarios.find(
    (s) => s.scenario_id === scenarioId,
  );
  const scenarioStatus = scenario?.status ?? null;

  const latest = pickLatestRefinement(scenario?.refinements ?? []);
  const refinementStatus = latest?.status ?? null;

  const TERMINAL = new Set(["completed", "failed"]);
  const refinementTerminal =
    refinementStatus !== null && TERMINAL.has(refinementStatus);
  const scenarioTerminal =
    scenarioStatus !== null && TERMINAL.has(scenarioStatus);

  const serverRunning = deriveServerRunning(scenarioStatus, refinementStatus);
  // Pulse only counts when neither the scenario row NOR its latest
  // refinement has reached a terminal status server-side. Suppressing
  // on EITHER signal is critical because a freshly-bootstrapped
  // scenario has ``refinementStatus = null`` (the manifest carries no
  // status column — see ``_build_refinement.derived_status`` for the
  // server-side derivation rules). Without the scenarioTerminal guard
  // the pulse stayed pinned for the full 60s TTL even after qualify
  // flipped the scenario row to ``completed``, leaving operators
  // watching a spinner over fresh results.
  const pulseEffective =
    justStarted && !refinementTerminal && !scenarioTerminal;

  const isRunning = serverRunning || pulseEffective;

  return {
    phase: isRunning ? "running" : "idle",
    isRunning,
    scenarioStatus,
    refinementStatus,
    latestRefinementNum: latest?.refinement_num ?? null,
    latestRefinementNote: latest?.note ?? null,
    justStarted,
  };
}

export interface UseMarkScenarioJustStartedResult {
  /** Pulse: a Save & Run just fired for this scenario id. */
  markJustStarted: (scenarioId: string) => void;
  /** Suppress the pulse — usually because the server confirmed terminal status. */
  clearJustStarted: (scenarioId: string) => void;
}

/**
 * Stable callbacks the host invokes from its Save & Run handler to
 * pulse the just-started indicator. Decouples hosts from the store
 * implementation so we can swap in a context-backed transport later
 * without touching their code.
 */
export function useMarkScenarioJustStarted(): UseMarkScenarioJustStartedResult {
  const markJustStarted = useCallback((scenarioId: string) => {
    getScenarioRunsStore().getState().markJustStarted(scenarioId);
  }, []);
  const clearJustStarted = useCallback((scenarioId: string) => {
    getScenarioRunsStore().getState().clearJustStarted(scenarioId);
  }, []);
  return { markJustStarted, clearJustStarted };
}
