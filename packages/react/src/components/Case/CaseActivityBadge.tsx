import type { CSSProperties, ReactElement, ReactNode } from "react";
import { useCaseUploadFlow } from "./useCaseUploadFlow.js";

/**
 * A tiny "what is happening on this case right now" indicator. Drops into
 * any component (sidebar, header, badges row) and auto-updates from the
 * shared `<CaseWorkflowProvider>` store.
 *
 * The default rendering is minimal — three short strings keyed off the
 * upload-flow phase. Hosts override individual phases through `slots`
 * (e.g. to render a styled chip or a `<Loader />` spinner). Renders
 * `null` when the flow is `idle` and no `slots.idle` is supplied.
 */
export interface CaseActivityBadgeSlots {
  idle?: ReactNode;
  uploading?: (params: { fileCount: number }) => ReactNode;
  extracting?: (params: { fileCount: number }) => ReactNode;
  reviewing?: (params: { newCount: number }) => ReactNode;
}

export interface CaseActivityBadgeClassNames {
  root?: string;
  uploading?: string;
  extracting?: string;
  reviewing?: string;
  dot?: string;
}

export interface CaseActivityBadgeProps {
  classNames?: CaseActivityBadgeClassNames;
  slots?: CaseActivityBadgeSlots;
  style?: CSSProperties;
}

export function CaseActivityBadge({
  classNames,
  slots,
  style,
}: CaseActivityBadgeProps) {
  const flow = useCaseUploadFlow();

  switch (flow.phase) {
    case "idle":
      return (slots?.idle as ReactElement | null) ?? null;
    case "uploading":
      if (slots?.uploading) {
        return <>{slots.uploading({ fileCount: flow.uploadedFileNames.length })}</>;
      }
      return (
        <span className={[classNames?.root, classNames?.uploading].filter(Boolean).join(" ")} style={style}>
          <span className={classNames?.dot} aria-hidden />
          Uploading {flow.uploadedFileNames.length} file
          {flow.uploadedFileNames.length === 1 ? "" : "s"}
        </span>
      );
    case "extracting":
      if (slots?.extracting) {
        return <>{slots.extracting({ fileCount: flow.uploadedFileNames.length })}</>;
      }
      return (
        <span className={[classNames?.root, classNames?.extracting].filter(Boolean).join(" ")} style={style}>
          <span className={classNames?.dot} aria-hidden />
          Extracting…
        </span>
      );
    case "reviewing":
      if (slots?.reviewing) {
        return <>{slots.reviewing({ newCount: flow.newDocuments.length })}</>;
      }
      return (
        <span className={[classNames?.root, classNames?.reviewing].filter(Boolean).join(" ")} style={style}>
          <span className={classNames?.dot} aria-hidden />
          {flow.newDocuments.length} new doc
          {flow.newDocuments.length === 1 ? "" : "s"} to review
        </span>
      );
    default:
      return null;
  }
}
