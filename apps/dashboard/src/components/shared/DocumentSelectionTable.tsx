import { useState, useMemo, useRef } from "react";
import { getDocClassInfo } from "../../utils/docUtils";

export interface DocumentItem {
	id: string;
	fileId: string;
	documentType: string;
	displayName: string;
	source: string;
	pageCount: number;
	firstPageNumber: number;
	year: string | null;
	processedAt: string | null;
}

interface DocumentSelectionTableProps {
	documents: DocumentItem[];
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
	caseId: string;
	disabled?: boolean;
	/** Number of items per page (default: 10) */
	pageSize?: number;
}

/**
 * DocumentSelectionTable - Reusable document selection with filters and pagination.
 *
 * Features:
 * - Document class search
 * - Year filter
 * - Select all / Deselect all (filtered)
 * - Pagination
 * - View links to document viewer
 */
export function DocumentSelectionTable({
	documents,
	selectedIds,
	onSelectionChange,
	caseId,
	disabled = false,
	pageSize = 10,
}: DocumentSelectionTableProps) {
	const [searchClass, setSearchClass] = useState("");
	const [searchYear, setSearchYear] = useState("");
	const [page, setPage] = useState(1);
	const selectAllRef = useRef<HTMLInputElement | null>(null);

	// Unique years from documents
	const years = useMemo(() => {
		const yearSet = new Set(documents.map((d) => d.year).filter(Boolean) as string[]);
		return Array.from(yearSet).sort().reverse(); // Most recent first
	}, [documents]);

	// Filter documents
	const filteredDocuments = useMemo(() => {
		return documents.filter((d) => {
			const docTypeLabel = getDocClassInfo(d.documentType).displayName.toLowerCase();
			const matchClass =
				!searchClass.trim() ||
				docTypeLabel.includes(searchClass.trim().toLowerCase()) ||
				d.documentType.toLowerCase().includes(searchClass.trim().toLowerCase());
			const matchYear = !searchYear || d.year === searchYear;
			return matchClass && matchYear;
		});
	}, [documents, searchClass, searchYear]);

	// Pagination
	const totalPages = Math.ceil(filteredDocuments.length / pageSize);
	const paginatedDocuments = useMemo(() => {
		const start = (page - 1) * pageSize;
		return filteredDocuments.slice(start, start + pageSize);
	}, [filteredDocuments, page, pageSize]);

	// Reset page when filters change
	useMemo(() => {
		setPage(1);
	}, [searchClass, searchYear]);

	const toggleDocument = (id: string) => {
		if (selectedIds.includes(id)) {
			onSelectionChange(selectedIds.filter((did) => did !== id));
		} else {
			onSelectionChange([...selectedIds, id]);
		}
	};

	const selectAllFiltered = () => {
		const ids = filteredDocuments.map((d) => d.id);
		onSelectionChange(Array.from(new Set([...selectedIds, ...ids])));
	};

	const deselectAllFiltered = () => {
		const ids = new Set(filteredDocuments.map((d) => d.id));
		onSelectionChange(selectedIds.filter((id) => !ids.has(id)));
	};

	const allFilteredSelected =
		filteredDocuments.length > 0 && filteredDocuments.every((d) => selectedIds.includes(d.id));

	// Format processedAt as relative time
	const formatProcessedAt = (processedAt: string | null): string => {
		if (!processedAt) return "—";
		const date = new Date(processedAt);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	};

	return (
		<div className="space-y-3">
			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				<input
					type="text"
					value={searchClass}
					onChange={(e) => setSearchClass(e.target.value)}
					placeholder="Filter by document class..."
					disabled={disabled}
					className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
				/>
				<select
					value={searchYear}
					onChange={(e) => setSearchYear(e.target.value)}
					disabled={disabled}
					className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
				>
					<option value="">All years</option>
					{years.map((y) => (
						<option key={y} value={y}>
							{y}
						</option>
					))}
				</select>
			</div>

			{/* Bulk select */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={selectAllFiltered}
					disabled={disabled}
					className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
				>
					Select all
				</button>
				<span className="text-slate-300">|</span>
				<button
					type="button"
					onClick={deselectAllFiltered}
					disabled={disabled}
					className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
				>
					Deselect all
				</button>
				<span className="text-xs text-slate-500">
					(applies to {filteredDocuments.length} filtered)
				</span>
			</div>

			{/* Table */}
			<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
				{filteredDocuments.length === 0 ? (
					<div className="px-4 py-6 text-center text-sm text-slate-500">
						No documents match the current filters.
					</div>
				) : (
					<>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-slate-200 bg-slate-50">
									<th className="w-10 px-4 py-3 text-left">
										<input
											ref={selectAllRef}
											type="checkbox"
											checked={allFilteredSelected}
											onChange={(e) => {
												if (e.target.checked) {
													selectAllFiltered();
												} else {
													deselectAllFiltered();
												}
											}}
											disabled={disabled}
											className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
										/>
									</th>
									<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">
										Year
									</th>
									<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">
										Doc type
									</th>
									<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs min-w-0">
										File Name
									</th>
									<th className="w-16 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide text-xs">
										View
									</th>
									<th className="px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide text-xs">
										Processed
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{paginatedDocuments.map((doc) => {
									const docTypeLabel = getDocClassInfo(doc.documentType).displayName;
									return (
										<tr
											key={doc.id}
											className={`hover:bg-slate-50 transition-colors ${disabled ? "opacity-50" : ""}`}
										>
											<td className="w-10 px-4 py-3">
												<input
													type="checkbox"
													checked={selectedIds.includes(doc.id)}
													onChange={() => toggleDocument(doc.id)}
													disabled={disabled}
													className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
												/>
											</td>
											<td className="px-4 py-3 text-slate-700">{doc.year ?? "—"}</td>
											<td className="px-4 py-3 text-slate-800">{docTypeLabel}</td>
											<td
												className="px-4 py-3 text-slate-600 truncate max-w-[200px]"
												title={doc.source || undefined}
											>
												{doc.source || "—"}
											</td>
											<td className="px-4 py-3 text-center">
												<a
													href={`/case/${caseId}/view?file=${doc.fileId}&page=${doc.firstPageNumber}`}
													target="_blank"
													rel="noopener noreferrer"
													className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
													title={`View document (${doc.pageCount} pages)`}
													onClick={(e) => e.stopPropagation()}
												>
													<svg
														className="w-4 h-4"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
														/>
													</svg>
												</a>
											</td>
											<td className="px-4 py-3 text-right text-slate-400 text-xs">
												{formatProcessedAt(doc.processedAt)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>

						{/* Pagination */}
						{totalPages > 1 && (
							<div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
								<span className="text-sm text-slate-600">
									{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredDocuments.length)}{" "}
									of {filteredDocuments.length}
								</span>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										disabled={page <= 1 || disabled}
										className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Previous
									</button>
									<span className="text-sm text-slate-600">
										Page {page} of {totalPages}
									</span>
									<button
										type="button"
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										disabled={page >= totalPages || disabled}
										className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										Next
									</button>
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

export default DocumentSelectionTable;
