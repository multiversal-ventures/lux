import { useMemo, useRef } from "react";
import type { CaseResult, ExtractedDocument, FileArtifact } from "../../types";
import { PdfViewer } from "./PdfViewer";
import { DocumentViewer } from "./DocumentViewer";

// Selection stores identifiers only - actual data is derived from result (source of truth)
export type ViewerSelection =
	| { type: "file"; fileId: string }
	| { type: "document"; fileId: string; documentType: string; firstPageNumber: number };

interface OverviewTabProps {
	result: CaseResult | null;
	caseId?: string;
	/** Current selection from DocumentsSidebar */
	selection: ViewerSelection | null;
	/** Callback when selection changes */
	onSelectionChange: (selection: ViewerSelection | null) => void;
	/** Focused fact field name from query parameter (for highlighting) */
	focusedFact?: string | null;
	/** Focused page number for scrolling */
	focusedPage?: number | null;
	/** Callback when focused fact is cleared */
	onClearFocusedFact?: () => void;
	/** Callback when focused page is cleared */
	onClearFocusedPage?: () => void;
	/** Callback to trigger data refetch after updates */
	onRefetch?: () => void;
}

/**
 * OverviewTab - displays document viewer for selected file/document.
 *
 * The document list is now in DocumentsSidebar (left sidebar).
 * This component only shows the viewer area.
 */
export function OverviewTab({
	result,
	caseId,
	selection,
	onSelectionChange,
	focusedFact,
	focusedPage,
	onClearFocusedFact,
	onClearFocusedPage,
	onRefetch,
}: OverviewTabProps) {
	// Get documents from extractions (source of truth from GCS snapshot)
	const extractedDocs: ExtractedDocument[] = result?.extractions?.documents ?? [];

	// Get files from GCS artifacts
	const gcsFiles: FileArtifact[] = result?.artifacts?.files ?? [];

	// Ref to preserve last valid document during transient refetch states
	// This prevents the "Select a file or document" flash when SSE events trigger refetch
	const lastValidDocRef = useRef<{
		doc: ExtractedDocument;
		index: number;
		selectionKey: string;
	} | null>(null);

	// Derive selected document AND its index from result using selection identifiers
	// Uses fallback to last valid document to handle race conditions during refetch
	const { selectedDocument, selectedDocIndex } = useMemo(() => {
		if (selection?.type !== "document") {
			lastValidDocRef.current = null;
			return { selectedDocument: null, selectedDocIndex: -1 };
		}

		// Create a key for this selection to track if selection itself changed
		const selectionKey = `${selection.fileId}:${selection.documentType}:${selection.firstPageNumber}`;

		// Try exact match first
		let index = extractedDocs.findIndex(
			(doc) =>
				doc.file_id === selection.fileId &&
				doc.document_type === selection.documentType &&
				doc.pages.some((p) => p.page_number === selection.firstPageNumber),
		);

		// If not found, try fuzzy match on file_id (handles partial ID matches)
		if (index === -1) {
			index = extractedDocs.findIndex(
				(doc) =>
					(doc.file_id === selection.fileId ||
						doc.file_id?.includes(selection.fileId) ||
						selection.fileId?.includes(doc.file_id)) &&
					doc.document_type === selection.documentType,
			);
		}

		if (index >= 0) {
			// Found the document - update the ref
			lastValidDocRef.current = {
				doc: extractedDocs[index],
				index,
				selectionKey,
			};
			return {
				selectedDocument: extractedDocs[index],
				selectedDocIndex: index,
			};
		}

		// Not found - check if we have a cached valid document for the same selection
		// This handles transient states during refetch where extractedDocs briefly doesn't contain the doc
		if (lastValidDocRef.current && lastValidDocRef.current.selectionKey === selectionKey) {
			// Try to find the cached document in the new extractedDocs by file_id and document_type
			const cachedDoc = lastValidDocRef.current.doc;
			const newIndex = extractedDocs.findIndex(
				(d) => d.file_id === cachedDoc.file_id && d.document_type === cachedDoc.document_type,
			);

			if (newIndex >= 0) {
				// Found it in the new list - update ref and return
				lastValidDocRef.current = {
					doc: extractedDocs[newIndex],
					index: newIndex,
					selectionKey,
				};
				return {
					selectedDocument: extractedDocs[newIndex],
					selectedDocIndex: newIndex,
				};
			}

			// Document not in new list but selection hasn't changed - keep showing cached doc
			// This prevents flash during SSE refetch race conditions
			return {
				selectedDocument: lastValidDocRef.current.doc,
				selectedDocIndex: lastValidDocRef.current.index,
			};
		}

		// No match and no valid cache - clear ref and return null
		lastValidDocRef.current = null;
		return { selectedDocument: null, selectedDocIndex: -1 };
	}, [selection, extractedDocs]);

	// Get selected file for PDF viewer
	const selectedFile =
		selection?.type === "file" ? gcsFiles.find((f) => f.file_id === selection.fileId) : null;

	return (
		<div className="h-full bg-slate-100">
			{selection?.type === "file" && selectedFile && caseId ? (
				<PdfViewer
					caseId={caseId}
					fileId={selectedFile.file_id}
					filename={selectedFile.filename}
					onClose={() => onSelectionChange(null)}
				/>
			) : selection?.type === "document" && selectedDocument && caseId && selectedDocIndex >= 0 ? (
				<DocumentViewer
					caseId={caseId}
					document={selectedDocument}
					docIndex={selectedDocIndex}
					focusedFact={focusedFact}
					focusedPage={focusedPage}
					onClearFocusedFact={onClearFocusedFact}
					onClearFocusedPage={onClearFocusedPage}
					onUpdate={onRefetch}
					onClose={() => onSelectionChange(null)}
				/>
			) : (
				<div className="h-full flex items-center justify-center text-slate-400">
					<div className="text-center">
						<svg
							className="w-16 h-16 mx-auto mb-4 opacity-50"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						<p className="text-lg font-medium">Select a file or document</p>
						<p className="text-sm mt-1">
							Click a <span className="text-red-500 font-medium">FILE</span> to view the original
							PDF
						</p>
						<p className="text-sm">
							Click a <span className="text-blue-500 font-medium">DOCUMENT</span> to view extracted
							pages
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
