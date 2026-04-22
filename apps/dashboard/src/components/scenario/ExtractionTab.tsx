import { CheckCircle, FileText } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { ExtractedDocument } from "../../types";
import { DocumentViewer } from "../results/DocumentViewer";

interface ExtractionTabProps {
	caseId: string;
	documents: ExtractedDocument[];
	selectedDocumentIds: string[];
	onUpdate: () => void;
	/** Callback when extraction edits are made */
	onEditCountChange?: (count: number) => void;
}

/**
 * ExtractionTab - Document extraction review and correction.
 *
 * Reuses the existing DocumentViewer component for viewing and editing
 * extracted facts. Changes are saved immediately via patchCase().
 * Tracks edit count to inform parent of changes.
 */
export function ExtractionTab({
	caseId,
	documents,
	selectedDocumentIds,
	onUpdate,
	onEditCountChange,
}: ExtractionTabProps) {
	const [selectedDocIndex, setSelectedDocIndex] = useState(0);
	const [editCount, setEditCount] = useState(0);

	// Filter to selected documents only
	// Note: selectedDocumentIds contains doc.id (Memgraph doc_id), not file_id
	const filteredDocuments = useMemo(() => {
		return documents.filter((doc) => selectedDocumentIds.includes(doc.id));
	}, [documents, selectedDocumentIds]);

	const selectedDoc = filteredDocuments[selectedDocIndex];

	// Calculate the ACTUAL docIndex in the full documents array for correct JSON Patch paths
	const actualDocIndex = useMemo(() => {
		if (!selectedDoc) return -1;
		return documents.findIndex(
			(d) => d.file_id === selectedDoc.file_id && d.document_type === selectedDoc.document_type,
		);
	}, [documents, selectedDoc]);

	// Track edits when DocumentViewer saves
	const handleUpdate = useCallback(() => {
		const newCount = editCount + 1;
		setEditCount(newCount);
		onEditCountChange?.(newCount);
		onUpdate();
	}, [editCount, onEditCountChange, onUpdate]);

	if (filteredDocuments.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 text-slate-400">
				<FileText className="w-12 h-12 mb-3" />
				<p className="text-sm">No documents selected for this scenario</p>
				<p className="text-xs mt-1">Select documents in the Documents tab first</p>
			</div>
		);
	}

	return (
		<div className="flex h-[600px] -mx-6 -mb-6 border-t border-slate-200">
			{/* Document list sidebar */}
			<div className="w-64 border-r border-slate-200 bg-white overflow-y-auto shrink-0">
				<div className="p-3 border-b border-slate-200 bg-slate-50">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium text-slate-800">
							Documents ({filteredDocuments.length})
						</h3>
						{editCount > 0 && (
							<span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
								<CheckCircle className="w-3 h-3" />
								{editCount} edit{editCount !== 1 ? "s" : ""}
							</span>
						)}
					</div>
					<p className="text-xs text-slate-500 mt-0.5">Select to review and correct</p>
				</div>
				<div className="divide-y divide-slate-100">
					{filteredDocuments.map((doc, idx) => (
						<button
							key={`${doc.file_id}-${doc.document_type}`}
							onClick={() => setSelectedDocIndex(idx)}
							className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${
								idx === selectedDocIndex
									? "bg-amber-50 border-l-2 border-amber-500"
									: "border-l-2 border-transparent"
							}`}
						>
							<div className="text-sm font-medium text-slate-800 truncate">
								{doc.document_type.replace(/_/g, " ")}
							</div>
							<div className="text-xs text-slate-500 mt-0.5">
								{doc.facts?.length ?? 0} facts • {doc.pages?.length ?? 0} pages
							</div>
						</button>
					))}
				</div>
			</div>

			{/* DocumentViewer - reusing the exact component from results */}
			<div className="flex-1 min-w-0 bg-slate-900">
				{selectedDoc && actualDocIndex >= 0 ? (
					<DocumentViewer
						caseId={caseId}
						document={selectedDoc}
						docIndex={actualDocIndex}
						onUpdate={handleUpdate}
					/>
				) : (
					<div className="flex items-center justify-center h-full text-slate-400">
						<p>Select a document to view</p>
					</div>
				)}
			</div>
		</div>
	);
}

export default ExtractionTab;
