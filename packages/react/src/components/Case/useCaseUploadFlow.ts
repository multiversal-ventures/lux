import { useMemo } from "react";
import { useStore } from "zustand";
import { useCaseWorkflowContext } from "./CaseWorkflowProvider.js";
import { useCaseDocuments, type CaseDocumentRow } from "./useCaseDocuments.js";
import type {
  CaseWorkflowActions,
  UploadPhase,
} from "../../state/caseWorkflowStore.js";

/**
 * Selector hook for the per-case upload + review flow.
 *
 * Returns the current phase, the filenames captured at upload time, the
 * documents that appeared **since** the upload started, and the action
 * callbacks needed to advance the state machine. Components use this
 * hook to render flow-aware UI (banners, confirmation buttons, etc.)
 * without coordinating state themselves.
 *
 * Components that pass a `caseId` argument get the slice for that case;
 * components rendered inside `<CaseWorkflowProvider>` can omit the
 * argument and rely on the context.
 */
export interface UseCaseUploadFlowResult {
  /** Stable phase enum — drive your UI off this. */
  phase: UploadPhase;
  /** Filenames the user submitted in this session. */
  uploadedFileNames: string[];
  /** Documents that did **not** exist before the upload started. */
  newDocuments: CaseDocumentRow[];
  /** Latest surfaced error, if any. */
  lastError: string | null;
  /** True iff the flow is in any non-idle phase. */
  isActive: boolean;

  beginUpload: CaseWorkflowActions["beginUpload"];
  markExtracting: CaseWorkflowActions["markExtracting"];
  markReviewing: CaseWorkflowActions["markReviewing"];
  confirmReview: CaseWorkflowActions["confirmReview"];
  dismissReview: CaseWorkflowActions["dismissReview"];
  setError: CaseWorkflowActions["setError"];
  reset: CaseWorkflowActions["reset"];
}

/**
 * Subscribe to the upload flow store.
 *
 * @param caseId Explicit case id when calling outside `<CaseWorkflowProvider>`.
 *               When omitted, the surrounding provider's case is used.
 */
export function useCaseUploadFlow(caseId?: string | null): UseCaseUploadFlowResult {
  const ctx = useCaseWorkflowContext();
  // The hook is only ever consumed with the provider mounted; the optional
  // arg lets a host explicitly cross-cut to a different case (rare, but
  // useful for split-views). We default to the provider's case.
  const effectiveCaseId = caseId ?? ctx.caseId;
  const store = ctx.store;

  // Subscribe per primitive/array slot so each `useSyncExternalStore`
  // snapshot returns a value React can compare with `Object.is`. A single
  // composite-object selector would synthesize a fresh object on every
  // getSnapshot call and trigger "result of getSnapshot should be cached"
  // → infinite-loop assertions under React 19.
  const uploadPhase = useStore(store, (s) => s.uploadPhase);
  const uploadedFileNames = useStore(store, (s) => s.uploadedFileNames);
  const previousDocIds = useStore(store, (s) => s.previousDocIds);
  const lastError = useStore(store, (s) => s.lastError);

  // Action refs are created once by `createCaseWorkflowStore` and never
  // re-assigned, so a one-shot read via `getState()` is safe and avoids a
  // useless render subscription for stable closures.
  const actions = useMemo<{
    beginUpload: CaseWorkflowActions["beginUpload"];
    markExtracting: CaseWorkflowActions["markExtracting"];
    markReviewing: CaseWorkflowActions["markReviewing"];
    confirmReview: CaseWorkflowActions["confirmReview"];
    dismissReview: CaseWorkflowActions["dismissReview"];
    setError: CaseWorkflowActions["setError"];
    reset: CaseWorkflowActions["reset"];
  }>(() => {
    const s = store.getState();
    return {
      beginUpload: s.beginUpload,
      markExtracting: s.markExtracting,
      markReviewing: s.markReviewing,
      confirmReview: s.confirmReview,
      dismissReview: s.dismissReview,
      setError: s.setError,
      reset: s.reset,
    };
  }, [store]);

  const documents = useCaseDocuments(effectiveCaseId ?? null);

  const newDocuments = useMemo<CaseDocumentRow[]>(() => {
    if (previousDocIds.length === 0) return [];
    const previousSet = new Set(previousDocIds);
    return documents.rows.filter((row) => !previousSet.has(row.id));
  }, [documents.rows, previousDocIds]);

  return {
    phase: uploadPhase,
    uploadedFileNames,
    newDocuments,
    lastError,
    isActive: uploadPhase !== "idle",
    ...actions,
  };
}

