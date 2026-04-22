import { useMemo, useState, useEffect, useRef } from 'react';
import { Upload, Loader2, FileText, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DocumentSelectionTable, UploadModal, DocumentCardSkeleton, type DocumentItem } from '../shared';
import {
  useAdaptiveRefetchInterval,
  useCaseQueryInvalidation,
  useCaseStatus,
  useWorkflowStatus,
  caseKeys,
} from '../../hooks/useCaseQueries';
import { cancelWorkflows } from '../../hooks/useApi';
import { getDocClassInfo } from '../../utils/docUtils';
import type { ExtractedDocument } from '../../types';

/**
 * Upload state machine - eliminates race conditions from multiple boolean states.
 *
 * States:
 * - idle: No upload in progress
 * - extracting: Extraction workflow running
 * - reviewing: Extraction complete, showing new documents for user to confirm
 */
type UploadPhase = 'idle' | 'extracting' | 'reviewing';

interface UploadState {
  phase: UploadPhase;
  fileNames: string[];           // Names of files being processed
  previousDocIds: Set<string>;   // Doc IDs before upload (to identify new ones)
}

interface DocumentsTabProps {
  caseId: string;
  documents: ExtractedDocument[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  reviewConfirmLabel: string;
  /** File artifacts for filename lookup */
  files?: { file_id: string; filename?: string; processed_at?: string }[];
  /** Callback when new files are uploaded - triggers refetch */
  onUploadComplete?: (fileNames: string[]) => void;
}

/**
 * DocumentsTab - Document selection for scenario draft flows.
 *
 * Features:
 * - Document selection table
 * - Upload new documents with extraction progress
 * - Review and add newly extracted documents
 */
export function DocumentsTab({
  caseId,
  documents,
  selectedIds,
  onSelectionChange,
  reviewConfirmLabel,
  files = [],
  onUploadComplete,
}: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const adaptiveRefetchInterval = useAdaptiveRefetchInterval();
  const { invalidateResult, invalidateStatus, invalidateWorkflows } = useCaseQueryInvalidation();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  // Upload state machine
  const [uploadState, setUploadState] = useState<UploadState>({
    phase: 'idle',
    fileNames: [],
    previousDocIds: new Set(),
  });

  // Derive UI states from upload state machine
  const isExtracting = uploadState.phase === 'extracting';
  const showExtractionProgress = uploadState.phase === 'extracting';
  const reviewingNewDocs = uploadState.phase === 'reviewing';

  // Fetch case status for extraction progress
  const { data: caseStatus } = useCaseStatus(caseId, {
    refetchInterval: isExtracting ? 2000 : adaptiveRefetchInterval,
  });

  // Check for running add-files workflows
  const { data: workflowStatus } = useWorkflowStatus(caseId, {
    enabled: !!caseId,
    refetchInterval: isExtracting ? 2000 : adaptiveRefetchInterval,
  });

  // Check if an add-files workflow is running
  const addFilesWorkflowRunning = useMemo(() => {
    if (!workflowStatus?.workflows) return false;
    return workflowStatus.workflows.some(
      (wf) => wf.workflow_type === 'add_files' && wf.status === 'running'
    );
  }, [workflowStatus]);

  // Track previous workflow running state to detect completion
  const prevAddFilesRunningRef = useRef(false);

  // State machine transitions based on workflow status
  useEffect(() => {
    const wasRunning = prevAddFilesRunningRef.current;
    const isRunning = addFilesWorkflowRunning;
    prevAddFilesRunningRef.current = isRunning;

    // Workflow just completed: extracting → reviewing
    if (wasRunning && !isRunning && uploadState.phase === 'extracting') {
      // Refresh case data and transition to review phase
      queryClient.refetchQueries({ queryKey: caseKeys.result(caseId) }).then(() => {
        setUploadState((prev) => ({
          ...prev,
          phase: 'reviewing',
        }));
      });
    }
  }, [addFilesWorkflowRunning, uploadState.phase, queryClient, caseId]);

  // Transform ExtractedDocument[] to DocumentItem[]
  const documentItems = useMemo<DocumentItem[]>(() => {
    const fileMap = new Map(files.map((f) => [f.file_id, f]));

    return documents.map((doc) => {
      const file = fileMap.get(doc.file_id);
      const { displayName } = getDocClassInfo(doc.document_type);
      const year = doc.effective_period?.period_end
        ? new Date(doc.effective_period.period_end).getFullYear().toString()
        : null;

      const firstPageNumber = doc.pages?.length > 0
        ? Math.min(...doc.pages.map((p) => p.page_number))
        : 1;

      return {
        id: doc.id,
        fileId: doc.file_id,
        documentType: doc.document_type,
        displayName: year ? `${year} ${displayName}` : displayName,
        source: file?.filename ?? '',
        pageCount: doc.pages?.length ?? 0,
        firstPageNumber,
        year,
        processedAt: file?.processed_at ?? null,
      };
    });
  }, [documents, files]);

  // Compute newly extracted documents (for review mode)
  const newDocuments = useMemo(() => {
    if (uploadState.previousDocIds.size === 0) return [];
    return documentItems.filter((d) => !uploadState.previousDocIds.has(d.id));
  }, [documentItems, uploadState.previousDocIds]);

  // Track retry count for waiting for new documents
  const reviewRetryCountRef = useRef(0);
  const MAX_REVIEW_RETRIES = 3;

  // Auto-dismiss review mode if we can't identify new documents
  useEffect(() => {
    if (uploadState.phase !== 'reviewing') {
      reviewRetryCountRef.current = 0;
      return;
    }

    // Case 1: previousDocIds was never captured - dismiss immediately
    if (uploadState.previousDocIds.size === 0 && documentItems.length > 0) {
      setUploadState({ phase: 'idle', fileNames: [], previousDocIds: new Set() });
      return;
    }

    // Case 2: No new documents detected - retry a few times
    if (newDocuments.length === 0 && documentItems.length > 0) {
      reviewRetryCountRef.current += 1;

      if (reviewRetryCountRef.current >= MAX_REVIEW_RETRIES) {
        setUploadState({ phase: 'idle', fileNames: [], previousDocIds: new Set() });
        return;
      }

      // Refetch and wait for new documents
      const timer = setTimeout(() => {
        queryClient.refetchQueries({ queryKey: caseKeys.result(caseId) });
      }, 2000);

      return () => clearTimeout(timer);
    }

    // New documents found - stay in reviewing mode
    if (newDocuments.length > 0) {
      reviewRetryCountRef.current = 0;
    }
  }, [uploadState.phase, uploadState.previousDocIds.size, documentItems.length, newDocuments.length, queryClient, caseId]);

  // Handle upload complete - transition to extracting phase
  const handleUploadComplete = (fileNames: string[]) => {
    // Capture current doc IDs to identify new ones after extraction
    const currentDocIds = new Set(documentItems.map((d) => d.id));

    // Transition: idle → extracting
    setUploadState({
      phase: 'extracting',
      fileNames,
      previousDocIds: currentDocIds,
    });

    setShowUploadModal(false);

    // Refresh data
    invalidateResult(caseId);
    invalidateStatus(caseId);
    invalidateWorkflows(caseId);

    // Notify parent
    onUploadComplete?.(fileNames);
  };

  // Handle cancel extraction workflow
  const handleCancelExtraction = async () => {
    if (!caseId || isCanceling) return;
    setIsCanceling(true);
    try {
      await cancelWorkflows(caseId, ['AUEAddFilesWorkflow']);
      setUploadState({ phase: 'idle', fileNames: [], previousDocIds: new Set() });
      invalidateStatus(caseId);
      invalidateWorkflows(caseId);
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
    } finally {
      setIsCanceling(false);
    }
  };

  // Handle confirming new documents - finalize the current checkbox choices
  const handleConfirmNewDocs = () => {
    // Transition: reviewing → idle
    setUploadState({ phase: 'idle', fileNames: [], previousDocIds: new Set() });
  };

  // Handle dismissing new documents (skip review)
  const handleDismissNewDocs = () => {
    setUploadState({ phase: 'idle', fileNames: [], previousDocIds: new Set() });
  };

  // Toggle document selection
  const toggleDocument = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Documents
        </h3>
        <button
          type="button"
          onClick={() => setShowUploadModal(true)}
          disabled={showExtractionProgress}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          Upload New
        </button>
      </div>

      {/* Show extraction progress when running */}
      {showExtractionProgress && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden px-4 py-4">
          {/* Header with status and cancel button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                {caseStatus?.message || 'Extracting new files...'}
              </span>
            </div>
            <button
              onClick={handleCancelExtraction}
              disabled={isCanceling}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Cancel extraction"
            >
              <X className="w-3.5 h-3.5" />
              {isCanceling ? 'Canceling...' : 'Cancel'}
            </button>
          </div>
          {/* Progress bar */}
          {caseStatus?.progress?.percent !== undefined && (
            <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${caseStatus.progress.percent}%` }}
              />
            </div>
          )}
          {/* Show uploaded file names with skeleton */}
          <div className="space-y-2">
            {uploadState.fileNames.length > 0 ? (
              uploadState.fileNames.map((filename: string, idx: number) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <FileText className="w-5 h-5 text-amber-500 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 truncate block">
                      {filename}
                    </span>
                    <span className="text-xs text-slate-500">Extracting documents...</span>
                  </div>
                </div>
              ))
            ) : (
              <>
                <DocumentCardSkeleton />
                <DocumentCardSkeleton />
              </>
            )}
          </div>
        </div>
      )}

      {/* Review new documents after extraction */}
      {reviewingNewDocs && newDocuments.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {newDocuments.length} new document{newDocuments.length > 1 ? 's' : ''} extracted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDismissNewDocs}
                className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleConfirmNewDocs}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
              >
                {reviewConfirmLabel}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {newDocuments.map((doc) => {
              const docTypeLabel = getDocClassInfo(doc.documentType).displayName;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="rounded border-green-300 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700 block">
                      {doc.year ? `${doc.year} ` : ''}{docTypeLabel}
                    </span>
                    <span className="text-xs text-slate-500 truncate block">{doc.source}</span>
                  </div>
                  <span className="text-xs text-slate-400">{doc.pageCount}p</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Document selection table - hide during extraction/review */}
      {!showExtractionProgress && !reviewingNewDocs && (
        <DocumentSelectionTable
          documents={documentItems}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          caseId={caseId}
        />
      )}

      {/* Upload Modal */}
      <UploadModal
        caseId={caseId}
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}

export default DocumentsTab;
