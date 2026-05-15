import type { CSSProperties, ReactNode } from "react";
import { useCaseUploadFlow } from "./useCaseUploadFlow.js";
import type { CaseDocumentRow } from "./useCaseDocuments.js";

/**
 * Composable banner that reflects the current upload + review phase.
 *
 * Renders nothing in the `idle` phase, an "extracting" message during
 * uploading/extracting, and a confirm/dismiss prompt during reviewing.
 * Hosts override any phase by passing the matching slot — pass
 * `slots.idle: null` to keep the banner hidden when idle, or override
 * `extracting`/`reviewing` to inject host-styled UI.
 *
 * The component is entirely driven by the surrounding `<CaseWorkflowProvider>`
 * store, so multiple banners on the page stay in sync without any
 * coordination logic.
 */
export interface CaseUploadStatusBannerClassNames {
  root?: string;
  uploading?: string;
  extracting?: string;
  reviewing?: string;
  spinner?: string;
  actions?: string;
  confirmButton?: string;
  dismissButton?: string;
  cancelButton?: string;
}

export interface CaseUploadStatusBannerSlots {
  /** Render override for the idle phase. Defaults to `null`. */
  idle?: ReactNode;
  /**
   * Render override for the uploading phase (network in flight).
   * Receives the filenames the user selected so the host can list them.
   */
  uploading?: (params: { fileNames: string[] }) => ReactNode;
  /**
   * Render override for the extracting phase (server is running extraction).
   * Receives the filenames so the host can show "extracting <names>".
   */
  extracting?: (params: { fileNames: string[]; cancel?: () => void }) => ReactNode;
  /**
   * Render override for the reviewing phase. Receives the freshly-extracted
   * documents and confirm/dismiss handlers wired to the store.
   */
  reviewing?: (params: {
    newDocuments: CaseDocumentRow[];
    confirm: () => void;
    dismiss: () => void;
  }) => ReactNode;
  /** Render override for the error sub-state. Composes with phase slots. */
  error?: (message: string) => ReactNode;
}

export interface CaseUploadStatusBannerProps {
  /** Optional cancel handler for the extracting phase (e.g. Temporal abort). */
  onCancel?: () => void;
  /**
   * When provided, called instead of the default `confirmReview` action so
   * the host can extend confirmation (e.g. "add to scenario selection").
   * Defaults to `confirmReview` from the store.
   */
  onConfirm?: (newDocuments: CaseDocumentRow[]) => void;
  /**
   * When provided, called instead of the default `dismissReview` action so
   * the host can extend dismissal (e.g. fire analytics, clear selection).
   * Defaults to `dismissReview` from the store.
   */
  onDismiss?: () => void;
  classNames?: CaseUploadStatusBannerClassNames;
  slots?: CaseUploadStatusBannerSlots;
  style?: CSSProperties;
}

export function CaseUploadStatusBanner({
  onCancel,
  onConfirm,
  onDismiss,
  classNames,
  slots,
  style,
}: CaseUploadStatusBannerProps) {
  const flow = useCaseUploadFlow();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(flow.newDocuments);
      flow.confirmReview();
      return;
    }
    flow.confirmReview();
  };

  const handleDismiss = () => {
    if (onDismiss) onDismiss();
    flow.dismissReview();
  };

  const errorNode =
    flow.lastError != null
      ? (slots?.error?.(flow.lastError) ?? (
          <div role="alert">{flow.lastError}</div>
        ))
      : null;

  const inner = (() => {
    switch (flow.phase) {
      case "idle":
        return slots?.idle ?? null;
      case "uploading":
        if (slots?.uploading) {
          return slots.uploading({ fileNames: flow.uploadedFileNames });
        }
        return (
          <div className={classNames?.uploading}>
            <span className={classNames?.spinner} aria-hidden>
              ⟳
            </span>{" "}
            Uploading {flow.uploadedFileNames.length} file
            {flow.uploadedFileNames.length === 1 ? "" : "s"}…
          </div>
        );
      case "extracting":
        if (slots?.extracting) {
          return slots.extracting({ fileNames: flow.uploadedFileNames, cancel: onCancel });
        }
        return (
          <div className={classNames?.extracting}>
            <span className={classNames?.spinner} aria-hidden>
              ⟳
            </span>{" "}
            Extracting…
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className={classNames?.cancelButton}
              >
                Cancel
              </button>
            )}
          </div>
        );
      case "reviewing":
        if (slots?.reviewing) {
          return slots.reviewing({
            newDocuments: flow.newDocuments,
            confirm: handleConfirm,
            dismiss: handleDismiss,
          });
        }
        return (
          <div className={classNames?.reviewing}>
            <span>
              {flow.newDocuments.length} new document
              {flow.newDocuments.length === 1 ? "" : "s"} extracted
            </span>
            <div className={classNames?.actions}>
              <button type="button" onClick={handleDismiss} className={classNames?.dismissButton}>
                Skip
              </button>
              <button type="button" onClick={handleConfirm} className={classNames?.confirmButton}>
                Add to scenario
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  })();

  if (inner == null && errorNode == null) return null;

  return (
    <div className={classNames?.root} style={style}>
      {errorNode}
      {inner}
    </div>
  );
}
