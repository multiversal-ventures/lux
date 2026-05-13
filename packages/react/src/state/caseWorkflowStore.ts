/**
 * Per-case workflow store — the small piece of cross-component UI state
 * that doesn't belong to React Query (which owns server data) but needs
 * to live somewhere multiple Lux components can subscribe to without
 * prop-drilling.
 *
 * Why zustand (not React context):
 *   - Selector subscriptions: only components reading a changed field
 *     re-render. With a context, every consumer would re-render on every
 *     phase change.
 *   - Vanilla `createStore` (no React) means tests can drive the store
 *     directly and assertions stay pure.
 *
 * The store is intentionally tiny — only the bits we need for the
 * upload + extraction-review flow today. New fields can be added
 * here without rewriting consumers, because all reads go through
 * selectors.
 */

import { createStore, type StoreApi } from "zustand/vanilla";

export type UploadPhase = "idle" | "uploading" | "extracting" | "reviewing";

export interface CaseWorkflowState {
  /** Current phase of the upload + review flow. */
  uploadPhase: UploadPhase;
  /** Filenames the user uploaded in this session (for the "extracting" UX). */
  uploadedFileNames: string[];
  /**
   * Snapshot of document ids that existed before the upload started. Used
   * to diff against the current `useCaseDocuments` rows so the UI can
   * highlight only the freshly-extracted documents.
   */
  previousDocIds: string[];
  /** Latest error message surfaced by upload or extraction. */
  lastError: string | null;
}

export interface CaseWorkflowActions {
  /** Move from `idle` → `uploading`. Captures filenames + the doc-id baseline. */
  beginUpload: (params: { fileNames: string[]; currentDocIds: string[] }) => void;
  /**
   * Move from `uploading` → `extracting`. Called after the server accepts
   * the upload payload and starts the extraction workflow.
   */
  markExtracting: () => void;
  /**
   * Move from `extracting` → `reviewing`. Called when extraction events
   * indicate new documents have been written.
   */
  markReviewing: () => void;
  /** User confirmed the new docs; collapse back to idle. */
  confirmReview: () => void;
  /** User dismissed the review; collapse back to idle without selecting. */
  dismissReview: () => void;
  /** Set or clear the surfaced error. */
  setError: (message: string | null) => void;
  /** Hard reset to a fresh idle state. */
  reset: () => void;
}

export type CaseWorkflowStore = StoreApi<CaseWorkflowState & CaseWorkflowActions>;

const INITIAL_STATE: CaseWorkflowState = {
  uploadPhase: "idle",
  uploadedFileNames: [],
  previousDocIds: [],
  lastError: null,
};

/**
 * Build a fresh store. Each case gets its own instance so unmounting
 * one case route does not stomp on another's session state.
 */
export function createCaseWorkflowStore(): CaseWorkflowStore {
  return createStore<CaseWorkflowState & CaseWorkflowActions>((set) => ({
    ...INITIAL_STATE,

    beginUpload: ({ fileNames, currentDocIds }) =>
      set({
        uploadPhase: "uploading",
        uploadedFileNames: fileNames,
        previousDocIds: currentDocIds,
        lastError: null,
      }),

    markExtracting: () =>
      set((s) =>
        s.uploadPhase === "uploading" || s.uploadPhase === "idle"
          ? { uploadPhase: "extracting" }
          : s,
      ),

    markReviewing: () =>
      set((s) =>
        s.uploadPhase === "extracting" || s.uploadPhase === "uploading"
          ? { uploadPhase: "reviewing" }
          : s,
      ),

    confirmReview: () => set({ ...INITIAL_STATE }),

    dismissReview: () => set({ ...INITIAL_STATE }),

    setError: (message) => set({ lastError: message }),

    reset: () => set({ ...INITIAL_STATE }),
  }));
}
