import type { CSSProperties, ReactNode } from "react";

/**
 * Placeholder Extraction-tab body for hosts that haven't lifted their
 * fact-editing UI into Lux yet.
 *
 * The full inline-edit experience (overrides on individual extracted
 * values) is a larger surface — staying in the host until we're ready
 * to standardise it. This component renders the "select documents
 * first" / "N docs ready" empty states so the tab still feels live,
 * and exposes slots so the host can drop its existing editor into the
 * body without changing the surrounding chrome.
 */
export interface RefinementExtractionTabClassNames {
  root?: string;
  empty?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  icon?: string;
}

export interface RefinementExtractionTabSlots {
  /** Renders when `selectedDocumentCount > 0`. */
  body?: ReactNode;
  /** Custom empty state when no docs are selected. */
  empty?: ReactNode;
  /** Icon shown in the default empty state. */
  emptyIcon?: ReactNode;
}

export interface RefinementExtractionTabProps {
  selectedDocumentCount: number;
  classNames?: RefinementExtractionTabClassNames;
  slots?: RefinementExtractionTabSlots;
  style?: CSSProperties;
}

export function RefinementExtractionTab({
  selectedDocumentCount,
  classNames,
  slots,
  style,
}: RefinementExtractionTabProps) {
  if (selectedDocumentCount === 0) {
    return (
      <div className={classNames?.root} style={style}>
        {slots?.empty ?? (
          <div className={classNames?.empty}>
            {slots?.emptyIcon && <div className={classNames?.icon}>{slots.emptyIcon}</div>}
            <div className={classNames?.emptyTitle}>No documents selected for this scenario</div>
            <div className={classNames?.emptySubtitle}>
              Select documents in the Documents tab first
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={classNames?.root} style={style}>
      {slots?.body ?? null}
    </div>
  );
}
