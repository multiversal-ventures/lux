import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { CaseEvent } from "@fenero-ai/lux-core";
import {
  createCaseWorkflowStore,
  type CaseWorkflowStore,
} from "../../state/caseWorkflowStore.js";
import { useCaseEventsOptional } from "../../providers/CaseEventsProvider.js";
import {
  caseDocumentsQueryKey,
  caseFilesQueryKey,
  useCaseDocuments,
} from "./useCaseDocuments.js";

/**
 * `<CaseWorkflowProvider>` is the single mount point for the per-case upload
 * + extraction-review state machine. It does three things:
 *
 *   1. Owns a zustand store keyed by `caseId`. Multiple consumer hooks
 *      and components subscribe to slices of this store without prop-
 *      drilling or context-driven re-renders.
 *   2. Subscribes to `CaseEventsProvider` events to drive the state
 *      machine forward as Veritas reports progress (extraction.*).
 *   3. Invalidates document/file queries on the relevant events so any
 *      `useCaseDocuments` consumer picks up freshly-extracted rows.
 *
 * The provider deliberately depends on `<CaseEventsProvider>` at runtime
 * so SSE invalidation stays a single source of truth. Hosts that mount
 * this provider get both pieces; lower-level helpers (`createCaseWorkflowStore`
 * + `useCaseUploadFlow`) remain usable standalone for tests.
 */

interface CaseWorkflowContextValue {
  caseId: string;
  store: CaseWorkflowStore;
}

const CaseWorkflowContext = createContext<CaseWorkflowContextValue | null>(null);

const storeRegistry = new Map<string, CaseWorkflowStore>();

function getOrCreateStore(caseId: string): CaseWorkflowStore {
  let s = storeRegistry.get(caseId);
  if (!s) {
    s = createCaseWorkflowStore();
    storeRegistry.set(caseId, s);
  }
  return s;
}

export interface CaseWorkflowProviderProps {
  caseId: string;
  /**
   * Event types that, when seen, transition the store from `extracting` →
   * `reviewing`. Defaults to the Veritas event names emitted by the
   * extract / banking / qualify pipelines. Pass a custom list to track
   * different terminal events (e.g. for a case that uses a different
   * workflow).
   */
  readyEventTypes?: readonly string[];
  /**
   * Event types that, when seen, hard-reset the store back to idle. Used
   * to clean up after a case-wide workflow finishes. Defaults to the
   * `case.system.completed` terminator.
   */
  resetEventTypes?: readonly string[];
  children: ReactNode;
}

const DEFAULT_READY_EVENTS = ["extraction.completed", "extraction.system.extracted"] as const;
const DEFAULT_RESET_EVENTS = ["case.system.completed"] as const;

export function CaseWorkflowProvider({
  caseId,
  readyEventTypes = DEFAULT_READY_EVENTS,
  resetEventTypes = DEFAULT_RESET_EVENTS,
  children,
}: CaseWorkflowProviderProps) {
  const store = useMemo(() => getOrCreateStore(caseId), [caseId]);
  const qc = useQueryClient();

  // Reset on caseId change so route changes don't leak prior session state.
  // Don't reset on every render — only when the *caseId* actually changes.
  const prevCaseIdRef = useRef(caseId);
  useEffect(() => {
    if (prevCaseIdRef.current !== caseId) {
      const previous = storeRegistry.get(prevCaseIdRef.current);
      previous?.getState().reset();
      prevCaseIdRef.current = caseId;
    }
  }, [caseId]);

  const readySet = useMemo(() => new Set(readyEventTypes), [readyEventTypes]);
  const resetSet = useMemo(() => new Set(resetEventTypes), [resetEventTypes]);

  const value = useMemo<CaseWorkflowContextValue>(() => ({ caseId, store }), [caseId, store]);

  return (
    <CaseWorkflowContext.Provider value={value}>
      <CaseEventBridge
        caseId={caseId}
        store={store}
        qc={qc}
        readySet={readySet}
        resetSet={resetSet}
      />
      <CaseDocsDeltaBridge caseId={caseId} store={store} />
      {children}
    </CaseWorkflowContext.Provider>
  );
}

/**
 * Internal child component that wires the workflow store to the case event
 * stream **when a `<CaseEventsProvider>` is mounted above**. Rendering it as
 * a child lets us read the events context with `useContext` (which never
 * throws) and skip the subscription entirely when the optional provider is
 * absent — important because not every host has SSE plumbing yet.
 */
function CaseEventBridge({
  caseId,
  store,
  qc,
  readySet,
  resetSet,
}: {
  caseId: string;
  store: CaseWorkflowStore;
  qc: ReturnType<typeof useQueryClient>;
  readySet: Set<string>;
  resetSet: Set<string>;
}) {
  // `useCaseEventsOptional` returns null when no `<CaseEventsProvider>`
  // is mounted, so workflow integration is opt-in for hosts that haven't
  // wired up SSE yet. The store still receives mutation-driven updates.
  const events = useCaseEventsOptional();

  useEffect(() => {
    if (!events) return;
    const unsubscribe = events.subscribe((event: CaseEvent) => {
      const state = store.getState();
      if (resetSet.has(event.event_type)) {
        state.reset();
        return;
      }
      if (readySet.has(event.event_type)) {
        if (state.uploadPhase === "extracting" || state.uploadPhase === "uploading") {
          state.markReviewing();
        }
        qc.invalidateQueries({ queryKey: caseDocumentsQueryKey(caseId) });
        qc.invalidateQueries({ queryKey: caseFilesQueryKey(caseId) });
      }
    });
    return unsubscribe;
  }, [events, store, qc, caseId, readySet, resetSet]);

  return null;
}

/**
 * Fallback transition for hosts that haven't mounted `<CaseEventsProvider>`.
 *
 * Watches `useCaseDocuments` for newly-arriving rows while the store is in
 * `uploading`/`extracting`, and auto-transitions to `reviewing` once at
 * least one row appears that wasn't in the baseline `previousDocIds`. This
 * keeps the workflow store useful in event-less environments while leaving
 * the canonical SSE-driven path untouched when events ARE available.
 */
function CaseDocsDeltaBridge({
  caseId,
  store,
}: {
  caseId: string;
  store: CaseWorkflowStore;
}) {
  const { rows } = useCaseDocuments(caseId);

  useEffect(() => {
    const state = store.getState();
    if (state.uploadPhase !== "uploading" && state.uploadPhase !== "extracting") return;
    if (state.previousDocIds.length === 0 && state.uploadPhase === "extracting") return;
    const previous = new Set(state.previousDocIds);
    const hasNew = rows.some((row) => !previous.has(row.id));
    if (hasNew) state.markReviewing();
  }, [rows, store]);

  return null;
}

/** Throws when no `<CaseWorkflowProvider>` is mounted above. */
export function useCaseWorkflowContext(): CaseWorkflowContextValue {
  const ctx = useContext(CaseWorkflowContext);
  if (!ctx) throw new Error("CaseWorkflowProvider required");
  return ctx;
}

/** Same context, but returns null outside the provider. */
export function useMaybeCaseWorkflowContext(): CaseWorkflowContextValue | null {
  return useContext(CaseWorkflowContext);
}
