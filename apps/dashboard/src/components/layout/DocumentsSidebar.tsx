import { useState, useEffect, useMemo } from "react";
import type { CaseResult, CaseStatus, LoadedFile, ExtractedDocument } from "../../types";
import { getDocClassInfo, isMISMOStandard } from "../../utils/docUtils";
import { isOngoing } from "../../lib/phases";
import { FileCardSkeleton } from "../shared/Skeleton";

// Pending file from upload navigation state
interface PendingFile {
	filename: string;
	tempId: string;
}

// Selection stores identifiers only - actual data is derived from result (source of truth)
export type ViewerSelection =
	| { type: "file"; fileId: string }
	| { type: "document"; fileId: string; documentType: string; firstPageNumber: number };

interface DocumentsSidebarProps {
	result: CaseResult | null;
	status: CaseStatus | null;
	loadedFiles?: LoadedFile[];
	pendingFiles?: PendingFile[];
	selection: ViewerSelection | null;
	onSelectionChange: (selection: ViewerSelection | null) => void;
	/** Case display name (e.g. "Kamala Harris Case file") */
	caseName?: string;
	/** Called when a document/file is selected - used to navigate to overview tab */
	onNavigateToOverview?: () => void;
	/** Called when View JSON button is clicked */
	onViewJson?: () => void;
	/** Called when View Graph button is clicked */
	onViewGraph?: () => void;
	/** Show loading indicator */
	loading?: boolean;
	/** When set (from header), show flat list for this file only; otherwise accordion by file */
	selectedFileIdFromHeader?: string | null;
	/** Called when user clicks to create a scenario */
	onScenarioClick?: () => void;
}

export function DocumentsSidebar({
	result,
	status,
	loadedFiles: _loadedFiles = [],
	pendingFiles = [],
	selection,
	onSelectionChange,
	caseName: _caseName = "Case",
	onNavigateToOverview,
	onViewJson: _onViewJson,
	onViewGraph: _onViewGraph,
	loading,
	selectedFileIdFromHeader = null,
}: DocumentsSidebarProps) {
	const extractedDocs: ExtractedDocument[] = result?.extractions?.documents ?? [];
	const artifactsFiles = result?.artifacts?.files ?? [];

	// Files in upload order: { fileId, filename } – use filename as label
	const fileItems = useMemo(() => {
		const seen = new Set<string>();
		const items: Array<{ fileId: string; filename: string }> = [];
		for (const f of artifactsFiles) {
			items.push({ fileId: f.file_id, filename: f.filename });
			seen.add(f.file_id);
		}
		for (const doc of extractedDocs) {
			if (doc.file_id && !seen.has(doc.file_id)) {
				seen.add(doc.file_id);
				items.push({ fileId: doc.file_id, filename: doc.file_id }); // fallback when no artifact yet
			}
		}
		return items;
	}, [artifactsFiles, extractedDocs]);
	const fileKeys = useMemo(() => fileItems.map((f) => f.fileId), [fileItems]);

	// Group documents by uploaded file (file_id)
	const docsByFile = useMemo(() => {
		const map: Record<string, ExtractedDocument[]> = {};
		for (const doc of extractedDocs) {
			if (!doc.file_id) continue;
			if (!map[doc.file_id]) map[doc.file_id] = [];
			map[doc.file_id].push(doc);
		}
		return map;
	}, [extractedDocs]);

	// Accordion: which files are expanded. Default: first file expanded.
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(() =>
		fileKeys.length > 0 ? new Set([fileKeys[0]]) : new Set(),
	);

	// When file list changes (e.g. after load), expand first if none expanded
	useEffect(() => {
		if (fileKeys.length === 0) return;
		setExpandedFiles((prev) => {
			const hasAny = fileKeys.some((f) => prev.has(f));
			if (hasAny) return prev;
			return new Set([fileKeys[0]]);
		});
	}, [fileKeys.join(",")]);

	// Keep selected document's file expanded when selection changes
	const selectedFileId = selection?.type === "document" ? selection.fileId : null;

	useEffect(() => {
		if (selectedFileId) {
			setExpandedFiles((prev) => new Set(prev).add(selectedFileId));
		}
	}, [selectedFileId]);

	const toggleFile = (fileId: string) => {
		setExpandedFiles((prev) => {
			const next = new Set(prev);
			if (next.has(fileId)) next.delete(fileId);
			else next.add(fileId);
			return next;
		});
	};

	const statusCode = status?.status.code;
	const isProcessing = status != null && statusCode != null && isOngoing(statusCode);
	const progress = status?.progress;
	const progressPct = progress?.percent ?? 0;
	const isDocSelected = (doc: ExtractedDocument) => {
		if (selection?.type !== "document") return false;
		const firstPage = Math.min(...doc.pages.map((p) => p.page_number));
		return (
			selection.fileId === doc.file_id &&
			selection.documentType === doc.document_type &&
			selection.firstPageNumber === firstPage
		);
	};

	const handleSelectDocument = (doc: ExtractedDocument) => {
		const firstPage = Math.min(...doc.pages.map((p) => p.page_number));
		onSelectionChange({
			type: "document",
			fileId: doc.file_id,
			documentType: doc.document_type,
			firstPageNumber: firstPage,
		});
		onNavigateToOverview?.();
	};

	const hasDocs = fileKeys.length > 0;
	const docsForHeaderFile =
		selectedFileIdFromHeader != null ? (docsByFile[selectedFileIdFromHeader] ?? []) : null;

	// Split documents into Standard (MISMO) and Supporting (custom)
	const partitionDocs = (docs: ExtractedDocument[]) => {
		const standard: ExtractedDocument[] = [];
		const supporting: ExtractedDocument[] = [];
		for (const doc of docs) {
			if (isMISMOStandard(doc.document_type)) standard.push(doc);
			else supporting.push(doc);
		}
		return { standard, supporting };
	};

	const renderDocList = (docs: ExtractedDocument[]) => {
		const { standard, supporting } = partitionDocs(docs);
		const renderDocItem = (doc: ExtractedDocument) => {
			const selected = isDocSelected(doc);
			const docInfo = getDocClassInfo(doc.document_type);
			const key = `${doc.file_id}-${doc.document_type}-${doc.pages[0]?.page_number}`;
			return (
				<li key={key}>
					<button
						type="button"
						onClick={() => handleSelectDocument(doc)}
						className={`w-full text-left px-3 py-2 rounded-lg transition-colors cursor-pointer text-sm font-normal ${
							selected
								? "bg-slate-100 text-slate-900"
								: "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
						}`}
					>
						{docInfo.displayName}
					</button>
				</li>
			);
		};
		return (
			<>
				{standard.length > 0 && (
					<div className="mb-4">
						<div className="px-1 py-2 text-sm font-semibold text-slate-900">Standard</div>
						<ul className="border-l border-slate-200 pl-4 ml-2 mt-0.5 space-y-1">
							{standard.map(renderDocItem)}
						</ul>
					</div>
				)}
				{supporting.length > 0 && (
					<div>
						<div className="px-1 py-2 text-sm font-semibold text-slate-900">Supporting</div>
						<ul className="border-l border-slate-200 pl-4 ml-2 mt-0.5 space-y-1">
							{supporting.map(renderDocItem)}
						</ul>
					</div>
				)}
			</>
		);
	};

	return (
		<aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
			<div className="flex-1 overflow-y-auto flex flex-col">
				{loading && !hasDocs ? (
					<div className="flex items-center justify-center h-32">
						<div className="flex items-center gap-3">
							<div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
							<span className="text-sm text-slate-500">Loading documents...</span>
						</div>
					</div>
				) : (
					<div className="py-4 px-4">
						{isProcessing && status && (
							<div className="px-3 py-2 flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
								<div className="relative w-6 h-6">
									<svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 36 36">
										<circle cx="18" cy="18" r="14" fill="none" stroke="#e2e8f0" strokeWidth="3" />
										<circle
											cx="18"
											cy="18"
											r="14"
											fill="none"
											stroke="#94a3b8"
											strokeWidth="3"
											strokeDasharray={`${progressPct * 0.88} 88`}
											strokeLinecap="round"
										/>
									</svg>
								</div>
								<span className="text-xs font-medium text-slate-600">
									{Math.round(progressPct)}%
								</span>
							</div>
						)}
						{selectedFileIdFromHeader != null && docsForHeaderFile ? (
							<div>{renderDocList(docsForHeaderFile)}</div>
						) : hasDocs ? (
							/* Accordion: files expand to show Standard/Supporting doc tree */
							<div>
								{fileItems.map(({ fileId, filename }) => {
									const docs = docsByFile[fileId] ?? [];
									const isExpanded = expandedFiles.has(fileId);
									const label = filename || fileId;

									return (
										<div key={fileId} className="mb-1 last:mb-0">
											<button
												type="button"
												onClick={() => toggleFile(fileId)}
												className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer hover:opacity-80 font-normal text-slate-900"
											>
												<span className="text-sm truncate" title={label}>
													{label}
												</span>
												<svg
													className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth={2}
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</button>
											{isExpanded && (
												<div className="border-l border-slate-200 pl-4 ml-2 mt-0.5">
													{renderDocList(docs)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						) : pendingFiles.length > 0 ? (
							<div className="divide-y divide-slate-300 border-l border-slate-200 pl-4 ml-2 mt-1">
								{pendingFiles.map((pf) => (
									<FileCardSkeleton key={pf.tempId} filename={pf.filename} />
								))}
							</div>
						) : (
							<div className="p-6 text-center text-slate-400 border-l border-slate-200 pl-4 ml-2 mt-1">
								<svg
									className="w-10 h-10 mx-auto mb-2 opacity-40"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									/>
								</svg>
								<p className="text-sm">No files uploaded</p>
							</div>
						)}
					</div>
				)}

				{/* JSON and Graph buttons - bottom */}
				{/* <div className="px-3 py-2 border-t border-slate-200 shrink-0 mt-auto flex gap-2">
          <button
            onClick={onViewJson}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            JSON
          </button>
          <button
            onClick={onViewGraph}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Graph
          </button>
        </div> */}
			</div>
		</aside>
	);
}
