import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAppDispatch } from "../../store";
import { collapseSidebarForView } from "../../store/appSlice";
import { Sidebar } from "./Sidebar";
import { DocumentsSidebar, type ViewerSelection } from "./DocumentsSidebar";
import { DocumentsYearHeader } from "./DocumentsYearHeader";
import { OverviewTab } from "../results";
import type {
	CaseResult,
	CaseStatus,
	LoadedFile,
	StreamEvent,
	SourceRef,
	StreamStatus,
} from "../../types";

interface PendingFile {
	filename: string;
	tempId: string;
}

interface DocumentsTabProps {
	caseId: string;
	basePath: string;
	result: CaseResult | null;
	status: CaseStatus | null;
	events: StreamEvent[];
	streamStatus: StreamStatus;
	loadedFiles: LoadedFile[];
	pendingFiles: PendingFile[];
	caseName: string;
	loading: boolean;
	onRefetch: () => void;
}

export function DocumentsTab({
	caseId,
	basePath,
	result,
	status,
	events,
	streamStatus,
	loadedFiles,
	pendingFiles,
	caseName,
	loading,
	onRefetch,
}: DocumentsTabProps) {
	const dispatch = useAppDispatch();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams, setSearchParams] = useSearchParams();

	// Collapse sidebar when DocumentsTab mounts
	useEffect(() => {
		dispatch(collapseSidebarForView());
	}, [dispatch]);

	// Document/file selection state
	const [selection, setSelection] = useState<ViewerSelection | null>(null);

	// Uploaded files for Documents view header (display filename as uploaded)
	const extractedDocs = useMemo(() => result?.extractions?.documents ?? [], [result]);
	const viewFiles = useMemo(() => {
		const files = result?.artifacts?.files ?? [];
		const seen = new Set(files.map((f) => f.file_id));
		const list = files.map((f) => ({ file_id: f.file_id, filename: f.filename }));
		for (const doc of extractedDocs) {
			if (doc.file_id && !seen.has(doc.file_id)) {
				seen.add(doc.file_id);
				list.push({ file_id: doc.file_id, filename: doc.file_id });
			}
		}
		return list;
	}, [result?.artifacts?.files, extractedDocs]);
	const viewFileIds = useMemo(() => viewFiles.map((f) => f.file_id), [viewFiles]);
	const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

	// Focused source from sidebar click or URL params
	const [focusedSource, setFocusedSource] = useState<SourceRef | null>(null);

	// Read query parameters for document/fact navigation
	const factParam = searchParams.get("fact");
	const fileParam = searchParams.get("file");
	const pageParam = searchParams.get("page");

	const [focusedFact, setFocusedFact] = useState<string | null>(null);
	const [focusedPage, setFocusedPage] = useState<number | null>(null);
	const [processedUrlParams, setProcessedUrlParams] = useState<string | null>(null);

	// Default selected file to first when file list loads
	useEffect(() => {
		if (viewFileIds.length === 0) return;
		setSelectedFileId((prev) => {
			if (prev == null || !viewFileIds.includes(prev)) return viewFileIds[0];
			return prev;
		});
	}, [viewFileIds.join(",")]);

	// Sync header file to selected document's file when user selects a document
	useEffect(() => {
		if (selection?.type === "document") {
			setSelectedFileId(selection.fileId);
		}
	}, [selection]);

	// Handle fact param
	useEffect(() => {
		if (factParam) {
			setFocusedFact(factParam);
		} else {
			setFocusedFact(null);
		}
	}, [factParam]);

	// Handle file/page URL params to auto-select document
	useEffect(() => {
		if (!fileParam || !pageParam || !result) return;

		const currentUrlKey = `${fileParam}:${pageParam}:${factParam || ""}:${location.key}`;
		if (currentUrlKey === processedUrlParams) return;

		const pageNumber = parseInt(pageParam, 10);
		if (!isNaN(pageNumber)) {
			setFocusedSource({
				file_id: fileParam,
				page_number: pageNumber,
			});
			setProcessedUrlParams(currentUrlKey);
		}
	}, [fileParam, pageParam, factParam, processedUrlParams, result, location.key]);

	// Convert focusedSource to selection
	useEffect(() => {
		const fileId = focusedSource?.file_id;
		const pageNumber = focusedSource?.page_number;
		if (fileId && pageNumber) {
			const targetDoc = extractedDocs.find(
				(doc) =>
					(doc.file_id === fileId ||
						doc.file_id.startsWith(fileId) ||
						fileId.startsWith(doc.file_id)) &&
					doc.pages.some((p) => p.page_number === pageNumber),
			);
			if (targetDoc) {
				const firstPage = Math.min(...targetDoc.pages.map((p) => p.page_number));
				setSelection({
					type: "document",
					fileId: targetDoc.file_id,
					documentType: targetDoc.document_type,
					firstPageNumber: firstPage,
				});
				setFocusedPage(pageNumber);
			}
			setFocusedSource(null);
		}
	}, [focusedSource, extractedDocs]);

	// Auto-select first document when on documents view with no valid selection
	useEffect(() => {
		const isOnDocumentsView = location.pathname === `${basePath}/view`;
		if (!isOnDocumentsView) return;
		if (extractedDocs.length === 0 || viewFileIds.length === 0) return;

		const selectionValid =
			selection?.type === "document" &&
			extractedDocs.some(
				(d) =>
					d.file_id === selection.fileId &&
					d.document_type === selection.documentType &&
					Math.min(...d.pages.map((p) => p.page_number)) === selection.firstPageNumber,
			);
		if (selectionValid) return;

		const firstFileId = viewFileIds[0];
		const docsForFirstFile = extractedDocs.filter((d) => d.file_id === firstFileId);
		const firstDoc = docsForFirstFile[0];
		if (!firstDoc || !firstDoc.pages || firstDoc.pages.length === 0) return;

		const firstPage = Math.min(...firstDoc.pages.map((p) => p.page_number));
		setSelection({
			type: "document",
			fileId: firstDoc.file_id,
			documentType: firstDoc.document_type,
			firstPageNumber: firstPage,
		});
	}, [basePath, location.pathname, selection, extractedDocs, viewFileIds]);

	const handleFileSelect = useCallback(
		(fileId: string) => {
			setSelectedFileId(fileId);
			const docsForFile = extractedDocs.filter((d) => d.file_id === fileId);
			const first = docsForFile[0];
			if (first) {
				const firstPage = Math.min(...first.pages.map((p) => p.page_number));
				setSelection({
					type: "document",
					fileId: first.file_id,
					documentType: first.document_type,
					firstPageNumber: firstPage,
				});
			}
		},
		[extractedDocs],
	);

	const handleClearFocusedFact = useCallback(() => {
		setFocusedFact(null);
		const newParams = new URLSearchParams(searchParams);
		newParams.delete("fact");
		setSearchParams(newParams, { replace: true });
	}, [searchParams, setSearchParams]);

	const handleSourceClick = useCallback(
		(source: SourceRef) => {
			if (!caseId) return;
			const viewPath = `${basePath}/view`;
			if (location.pathname !== viewPath) {
				navigate(`${viewPath}?file=${source.file_id ?? ""}&page=${source.page_number ?? ""}`);
			} else {
				setFocusedSource(source);
			}
		},
		[caseId, basePath, location.pathname, navigate],
	);

	return (
		<>
			<DocumentsYearHeader
				files={viewFiles}
				selectedFileId={selectedFileId}
				onFileSelect={handleFileSelect}
			/>
			<div className="flex-1 flex overflow-hidden min-w-0">
				<DocumentsSidebar
					result={result}
					status={status}
					loadedFiles={loadedFiles}
					pendingFiles={pendingFiles}
					selection={selection}
					onSelectionChange={setSelection}
					caseName={caseName}
					onNavigateToOverview={() => navigate(`${basePath}/view`)}
					onViewJson={() => navigate(`${basePath}/json`)}
					onViewGraph={() => navigate(`${basePath}/graph`)}
					loading={loading}
					selectedFileIdFromHeader={selectedFileId}
				/>
				<div className="flex-1 overflow-hidden bg-slate-100 min-w-0">
					{loading && !result ? (
						<div className="flex items-center justify-center h-full">
							<div className="spinner" />
						</div>
					) : (
						<OverviewTab
							result={result}
							caseId={caseId}
							selection={selection}
							onSelectionChange={setSelection}
							focusedFact={focusedFact}
							focusedPage={focusedPage}
							onClearFocusedFact={handleClearFocusedFact}
							onClearFocusedPage={() => setFocusedPage(null)}
							onRefetch={onRefetch}
						/>
					)}
				</div>
				<Sidebar
					events={events}
					status={status}
					streamStatus={streamStatus}
					onSourceClick={handleSourceClick}
				/>
			</div>
		</>
	);
}
