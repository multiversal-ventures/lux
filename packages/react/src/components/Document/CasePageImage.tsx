import { useCasePageBlob } from "./useCasePageBlob.js";

export interface CasePageImageProps {
  caseId: string;
  fileId: string;
  pageNumber: number;
  alt?: string;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  /** Rendered while the blob is loading. */
  loadingFallback?: React.ReactNode;
  /** Rendered when the blob fetch fails. */
  errorFallback?: React.ReactNode;
}

/**
 * Authed page-image renderer. Pure presentation — no overlay logic; pair
 * with `BoundingBoxOverlay` (or your own overlay div) absolutely
 * positioned over a wrapper to draw bboxes.
 *
 * Uses `useCasePageBlob` so the underlying GET is shared with every
 * other Lux viewer mounting the same `(caseId, fileId, page)`.
 */
export function CasePageImage({
  caseId,
  fileId,
  pageNumber,
  alt,
  className,
  onLoad,
  onError,
  loadingFallback,
  errorFallback,
}: CasePageImageProps) {
  const q = useCasePageBlob(caseId, fileId, pageNumber);

  if (q.isPending) {
    return (
      <>{loadingFallback ?? <div data-lux="case-page-image-loading" />}</>
    );
  }
  if (q.isError || !q.data) {
    if (onError) onError();
    return <>{errorFallback ?? <div data-lux="case-page-image-error" />}</>;
  }

  return (
    <img
      src={q.data}
      alt={alt ?? `Page ${pageNumber}`}
      className={className}
      onLoad={onLoad}
      draggable={false}
      style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }}
    />
  );
}
