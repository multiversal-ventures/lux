import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getDefaultClient } from "@multiversal-ventures/lux-core";
import {
  caseDocumentsQueryKey,
  caseFilesQueryKey,
  useCaseDocuments,
} from "./useCaseDocuments.js";
import { useMaybeCaseWorkflowContext } from "./CaseWorkflowProvider.js";

/**
 * Response shape returned from `POST /api/cases/{id}/files`. Mirrors the
 * Veritas FastAPI handler (`api/files.py::upload_files`).
 */
export interface UploadCaseFilesResponse {
  case_id: string;
  workflow_id: string;
  files_queued: number;
  status: string;
}

export interface UseUploadCaseFilesVars {
  files: File[] | FileList;
}

export interface UseUploadCaseFilesOptions {
  /** Called after the server accepts the upload. Use to advance UI state. */
  onSuccess?: (resp: UploadCaseFilesResponse, vars: UseUploadCaseFilesVars) => void;
  onError?: (err: Error, vars: UseUploadCaseFilesVars) => void;
}

export type UseUploadCaseFilesResult = UseMutationResult<
  UploadCaseFilesResponse,
  Error,
  UseUploadCaseFilesVars
>;

/**
 * Upload one or more PDFs to a case via the Veritas client.
 *
 * Side effects on success:
 *   1. Invalidates the case's documents + files queries so any
 *      `useCaseDocuments` consumer re-fetches the new extractions.
 *   2. If a `<CaseWorkflowProvider>` is mounted above, captures the doc-id
 *      baseline and moves the store to `uploading → extracting` so any
 *      `<CaseUploadStatusBanner>` / `useCaseUploadFlow` consumer reacts
 *      automatically without prop-drilling.
 */
export function useUploadCaseFiles(
  caseId: string | null,
  options: UseUploadCaseFilesOptions = {},
): UseUploadCaseFilesResult {
  const qc = useQueryClient();
  const workflowCtx = useMaybeCaseWorkflowContext();
  const documents = useCaseDocuments(caseId);

  return useMutation({
    mutationFn: async (vars: UseUploadCaseFilesVars) => {
      if (!caseId) throw new Error("caseId required");
      return getDefaultClient().uploadCasePdfs(caseId, vars.files);
    },
    onMutate: (vars) => {
      // Capture the doc-id baseline + transition to "uploading" the moment
      // the user hits go. Doing this here (instead of onSuccess) means the
      // banner renders the spinner before the network completes.
      if (workflowCtx) {
        const fileNames = Array.from(vars.files as FileList | File[]).map((f) => f.name);
        const currentDocIds = documents.rows.map((row) => row.id);
        workflowCtx.store.getState().beginUpload({ fileNames, currentDocIds });
      }
    },
    onSuccess: (resp, vars) => {
      if (caseId) {
        qc.invalidateQueries({ queryKey: caseDocumentsQueryKey(caseId) });
        qc.invalidateQueries({ queryKey: caseFilesQueryKey(caseId) });
      }
      // Network accepted the upload — extraction workflow is now running on
      // the server. The provider will move us to "reviewing" once
      // extraction.* events arrive.
      if (workflowCtx) {
        workflowCtx.store.getState().markExtracting();
      }
      options.onSuccess?.(resp, vars);
    },
    onError: (err, vars) => {
      if (workflowCtx) {
        const state = workflowCtx.store.getState();
        state.setError(err instanceof Error ? err.message : String(err));
        // If we never made it past upload, drop back to idle so the banner
        // doesn't get stuck in "uploading" forever on error.
        if (state.uploadPhase === "uploading") state.reset();
      }
      options.onError?.(err as Error, vars);
    },
  });
}
