import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useUploadCaseFiles, type UploadCaseFilesResponse } from "./useUploadCaseFiles.js";

/**
 * Composable drag-and-drop file uploader, scoped to a case.
 *
 * Renders nothing visual by default — the host passes `slots.body` (and
 * optionally `slots.preview` / `slots.actions`) to render the UI. The
 * component owns three pieces of state every host needs:
 *
 * - `selectedFiles`: files chosen but not yet uploaded
 * - `phase`: lifecycle state (`idle`/`uploading`/`extracting`/`error`)
 * - `error`: human-readable error message
 *
 * It also exposes raw drag handlers (`onDragOver`, `onDrop`) and a
 * `triggerFilePicker()` helper so hosts can attach the upload affordance
 * to any element — a button, a label, a giant zone, anything.
 *
 * Usage:
 * ```tsx
 * <CaseFileUploadDropzone
 *   caseId={caseId}
 *   accept=".pdf"
 *   onUploaded={(resp) => setUploading(true)}
 * >
 *   {({ phase, selectedFiles, triggerFilePicker, upload }) => (
 *     <div onClick={triggerFilePicker}>{phase === 'idle' ? 'Drop PDFs' : phase}</div>
 *   )}
 * </CaseFileUploadDropzone>
 * ```
 */
export interface CaseFileUploadDropzoneClassNames {
  root?: string;
  dragOver?: string;
}

export type UploadPhase = "idle" | "uploading" | "extracting" | "error";

export interface CaseFileUploadRenderProps {
  /** Files selected via dialog or drag — not yet uploaded. */
  selectedFiles: File[];
  /** Current lifecycle state. */
  phase: UploadPhase;
  /** Human-readable error, when `phase === 'error'`. */
  error: string | null;
  /** True while the dropzone is being hovered with a dragged file. */
  isDragging: boolean;
  /** Open the OS file picker. */
  triggerFilePicker: () => void;
  /** Set selected files programmatically (e.g. via a custom picker). */
  setFiles: (files: File[]) => void;
  /** Upload the currently-selected files. Resolves with the server response. */
  upload: () => Promise<UploadCaseFilesResponse | undefined>;
  /** Reset to `idle` with no selected files. */
  reset: () => void;
}

export interface CaseFileUploadDropzoneProps {
  caseId: string | null;
  /** File picker filter, e.g. `".pdf"` or `"application/pdf"`. */
  accept?: string;
  /** Whether to allow multiple files. Default `true`. */
  multiple?: boolean;
  /** Notified once the server accepts the upload. */
  onUploaded?: (resp: UploadCaseFilesResponse, files: File[]) => void;
  onError?: (err: Error) => void;
  classNames?: CaseFileUploadDropzoneClassNames;
  style?: CSSProperties;
  /**
   * Render function. Receives the dropzone state and helpers — the host
   * is responsible for the actual DOM. Returning `null` is fine when the
   * host only needs the imperative API (e.g. mounting via portal).
   */
  children: (state: CaseFileUploadRenderProps) => ReactNode;
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function CaseFileUploadDropzone({
  caseId,
  accept = ".pdf",
  multiple = true,
  onUploaded,
  onError,
  classNames,
  style,
  children,
}: CaseFileUploadDropzoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mutation = useUploadCaseFiles(caseId, {
    onSuccess: (resp) => {
      onUploaded?.(resp, selectedFiles);
    },
    onError: (err) => {
      onError?.(err);
    },
  });

  // Default behavior is `idle`; while the mutation is in-flight we report
  // `uploading`. After success the host typically polls for extraction —
  // we don't infer that here (no source of truth) and stay in `idle`
  // until the host calls `reset()` or selects more files.
  const phase: UploadPhase = mutation.isError
    ? "error"
    : mutation.isPending
      ? "uploading"
      : "idle";

  const setFiles = useCallback(
    (files: File[]) => {
      const valid = accept.includes("pdf") ? files.filter(isPdf) : files;
      const next = multiple ? valid : valid.slice(0, 1);
      setSelectedFiles(next);
      setError(null);
    },
    [accept, multiple],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list) return;
      setFiles(Array.from(list));
      // Clear the input so selecting the same file twice still fires `change`.
      event.target.value = "";
    },
    [setFiles],
  );

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length === 0) return;
      setFiles(files);
    },
    [setFiles],
  );

  const upload = useCallback(async (): Promise<UploadCaseFilesResponse | undefined> => {
    if (selectedFiles.length === 0) return undefined;
    try {
      const resp = await mutation.mutateAsync({ files: selectedFiles });
      return resp;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      return undefined;
    }
  }, [mutation, selectedFiles]);

  const reset = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
    mutation.reset();
  }, [mutation]);

  useEffect(() => {
    if (mutation.isError && mutation.error) {
      setError(mutation.error.message);
    }
  }, [mutation.isError, mutation.error]);

  const renderProps = useMemo<CaseFileUploadRenderProps>(
    () => ({
      selectedFiles,
      phase,
      error,
      isDragging,
      triggerFilePicker,
      setFiles,
      upload,
      reset,
    }),
    [selectedFiles, phase, error, isDragging, triggerFilePicker, setFiles, upload, reset],
  );

  const rootClass = [classNames?.root, isDragging ? classNames?.dragOver : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClass || undefined}
      style={style}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      {children(renderProps)}
    </div>
  );
}
