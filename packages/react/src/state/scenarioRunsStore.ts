/**
 * Per-scenario "just-started" pulse store.
 *
 * Why it exists:
 *   ``Save & Run`` from the refine page kicks off a ``QualifyWorkflow``
 *   asynchronously — the API returns ``status: 'started'`` before the
 *   scenario row's ``status`` flips to ``running`` in the DB and before
 *   the scenarios query refetches with that fresh status. Without a
 *   client-side pulse, the summary page renders an empty body until the
 *   first poll lands ~3s later. The pulse lets ``useScenarioRunningState``
 *   answer "is this scenario actively running?" the instant Save & Run
 *   fires, even before any server-confirmed status is available.
 *
 * Design choices:
 *   - **Vanilla zustand** (no React) so the store is testable without
 *     a renderer and so non-React surfaces (e.g. the cli tools / CI
 *     harnesses) can drive it identically.
 *   - **Per-scenario id**, not a single global "is anything running"
 *     bit, because a case can have multiple scenarios in flight and
 *     each needs its own pulse.
 *   - **Auto-expire** via a TTL so a stale pulse can't pin the loader
 *     visible after navigation away + back. The hook reads
 *     ``isJustStarted(scenarioId, ttlMs)`` rather than baking the TTL
 *     into the store — keeps the store dumb.
 *   - Pulses **co-exist** with the URL ``?started=true`` query param
 *     used by ``ScenarioSummaryPage`` today; either signal is enough
 *     to trigger the loader. Hosts can pick whichever fits their
 *     navigation model.
 *
 * Lifecycle:
 *   - ``markJustStarted(scenarioId)`` on Save & Run.
 *   - ``clearJustStarted(scenarioId)`` when the server confirms the
 *     scenario reached a terminal status (or the host wants to
 *     suppress the pulse explicitly).
 *   - The store does NOT clear automatically — ``isJustStarted`` is
 *     the lazy reader that compares the timestamp against the TTL.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

export interface ScenarioRunsState {
  /** ScenarioId → epoch ms when ``Save & Run`` fired. */
  justStartedAt: Record<string, number>;
}

export interface ScenarioRunsActions {
  /** Pulse: a Save & Run just fired for this scenario. */
  markJustStarted: (scenarioId: string) => void;
  /** Clear the pulse (e.g. after the server confirms terminal status). */
  clearJustStarted: (scenarioId: string) => void;
  /**
   * True when the pulse for ``scenarioId`` is still within ``ttlMs``
   * of ``Date.now()``. Defaults to a 60s window — long enough that
   * navigation away and back during a Non-QM bank statement run
   * (which can take a minute) still surfaces the loader, but short
   * enough that abandoned pulses don't pin the loader forever.
   */
  isJustStarted: (scenarioId: string, ttlMs?: number) => boolean;
  /** Hard reset — every pulse is cleared. */
  reset: () => void;
}

export type ScenarioRunsStore = StoreApi<ScenarioRunsState & ScenarioRunsActions>;

const DEFAULT_TTL_MS = 60_000;

const INITIAL_STATE: ScenarioRunsState = {
  justStartedAt: {},
};

export function createScenarioRunsStore(): ScenarioRunsStore {
  return createStore<ScenarioRunsState & ScenarioRunsActions>((set, get) => ({
    ...INITIAL_STATE,

    markJustStarted: (scenarioId) =>
      set((s) => ({
        justStartedAt: { ...s.justStartedAt, [scenarioId]: Date.now() },
      })),

    clearJustStarted: (scenarioId) =>
      set((s) => {
        if (!(scenarioId in s.justStartedAt)) return s;
        const next = { ...s.justStartedAt };
        delete next[scenarioId];
        return { justStartedAt: next };
      }),

    isJustStarted: (scenarioId, ttlMs = DEFAULT_TTL_MS) => {
      const at = get().justStartedAt[scenarioId];
      if (at == null) return false;
      return Date.now() - at < ttlMs;
    },

    reset: () => set({ ...INITIAL_STATE }),
  }));
}

/**
 * Module-level singleton so unrelated components on the same page can
 * observe the same pulse without prop-drilling. Mirrors the ergonomic
 * choice we made for ``getDefaultClient`` in ``@fenero-ai/lux-core``: one
 * shared instance for the common case, ``createScenarioRunsStore`` for
 * tests / multi-tenant harnesses that want isolation.
 */
let _defaultStore: ScenarioRunsStore | null = null;

export function getScenarioRunsStore(): ScenarioRunsStore {
  if (_defaultStore === null) {
    _defaultStore = createScenarioRunsStore();
  }
  return _defaultStore;
}
