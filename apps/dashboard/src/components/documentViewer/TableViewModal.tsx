import { useCallback, useEffect, useState } from "react";
import {
	type CaseTablesResponse,
	type DocumentTables,
	type TableData,
	getCaseTables,
} from "../../hooks/useApi";

export interface TableViewModalProps {
	open: boolean;
	caseId: string;
	fileId?: string;
	documentType?: string;
	onClose: () => void;
}

const PAGE_SIZE = 50;

function formatRegionType(raw: string | undefined): string {
	if (!raw) return "Table";
	return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function TableViewModal({
	open,
	caseId,
	fileId,
	documentType,
	onClose,
}: TableViewModalProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<CaseTablesResponse | null>(null);
	const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
	const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageLoading, setPageLoading] = useState(false);

	const selectDocument = useCallback(
		(documents: DocumentTables[]): DocumentTables | undefined => {
			if (fileId) {
				const fileMatch = documents.find((doc) => doc.file_id === fileId);
				if (fileMatch) return fileMatch;
			}
			if (documentType) {
				return documents.find((doc) => doc.document_type === documentType);
			}
			return documents[0];
		},
		[documentType, fileId],
	);

	const fetchTables = useCallback(
		async (page: number) => {
			const isInitial = page === 1 && !data;
			if (isInitial) setLoading(true);
			else setPageLoading(true);
			setError(null);

			try {
				const response = await getCaseTables(caseId, page, PAGE_SIZE);
				setData(response);

				if (isInitial && response.documents.length > 0) {
					const doc = selectDocument(response.documents);
					if (doc && doc.tables.length > 0) {
						setSelectedDocId(doc.doc_id);
						setSelectedTable(doc.tables[0]);
					}
				} else if (selectedDocId && selectedTable) {
					// Update selectedTable with fresh row data for same region
					const doc = response.documents.find((d) => d.doc_id === selectedDocId);
					const table = doc?.tables.find((t) => t.region_id === selectedTable.region_id);
					if (table) setSelectedTable(table);
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load tables");
			} finally {
				setLoading(false);
				setPageLoading(false);
			}
		},
		[caseId, data, selectDocument, selectedDocId, selectedTable],
	);

	// Fetch tables when modal opens
	useEffect(() => {
		if (!open) return;
		setCurrentPage(1);
		setData(null);
		setSelectedTable(null);
		setSelectedDocId(null);
		// Fetch page 1
		(async () => {
			setLoading(true);
			setError(null);
			try {
				const response = await getCaseTables(caseId, 1, PAGE_SIZE);
				setData(response);
				if (response.documents.length > 0) {
					const doc = selectDocument(response.documents);
					if (doc && doc.tables.length > 0) {
						setSelectedDocId(doc.doc_id);
						setSelectedTable(doc.tables[0]);
					}
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load tables");
			} finally {
				setLoading(false);
			}
		})();
	}, [open, caseId, selectDocument]);

	const handlePageChange = useCallback(
		(newPage: number) => {
			setCurrentPage(newPage);
			fetchTables(newPage);
		},
		[fetchTables],
	);

	if (!open) return null;

	const currentDoc = data?.documents.find((d) => d.doc_id === selectedDocId);
	const totalPages = selectedTable?.total_pages ?? 1;

	const getDocDisplayName = (doc: DocumentTables) => {
		const sameTypeCount =
			data?.documents.filter((d) => d.document_type === doc.document_type).length ?? 0;
		if (sameTypeCount > 1) {
			const sameTypeDocs =
				data?.documents.filter((d) => d.document_type === doc.document_type) ?? [];
			const docIndex = sameTypeDocs.findIndex((d) => d.doc_id === doc.doc_id) + 1;
			return `${doc.document_type} #${docIndex}`;
		}
		return doc.document_type;
	};

	return (
		<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
			<div className="bg-slate-900 rounded-xl shadow-2xl w-[90vw] max-w-6xl max-h-[85vh] flex flex-col mx-4 border border-slate-700">
				{/* Header */}
				<div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-blue-500/20 rounded-lg">
							<svg
								className="w-5 h-5 text-blue-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						</div>
						<div>
							<h3 className="text-lg font-semibold text-white">Sections</h3>
							<p className="text-xs text-slate-400">
								{data
									? `${data.total_rows} rows across ${data.total_tables} sections`
									: "Loading..."}
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
					>
						<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Left sidebar - document/table selection */}
					<div className="w-56 border-r border-slate-700 flex flex-col">
						<div className="p-3 border-b border-slate-700">
							<h4 className="text-xs font-medium text-slate-400 uppercase">Documents</h4>
						</div>
						<div className="flex-1 overflow-y-auto p-2 space-y-1">
							{loading ? (
								<div className="flex items-center justify-center py-8">
									<div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
								</div>
							) : error ? (
								<div className="p-3 text-sm text-red-400">{error}</div>
							) : data?.documents.length === 0 ? (
								<div className="p-3 text-sm text-slate-400 text-center">No tables found</div>
							) : (
								data?.documents.map((doc) => (
									<div key={doc.doc_id} className="space-y-1">
										<button
											onClick={() => {
												setSelectedDocId(doc.doc_id);
												if (doc.tables.length > 0) {
													setSelectedTable(doc.tables[0]);
													setCurrentPage(1);
												}
											}}
											className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
												selectedDocId === doc.doc_id
													? "bg-blue-500/20 text-blue-400"
													: "text-slate-300 hover:bg-slate-700/50"
											}`}
										>
											<div className="font-medium truncate">{getDocDisplayName(doc)}</div>
											<div className="text-xs text-slate-500">
												{(() => {
													const types = [
														...new Set(doc.tables.map((t) => t.semantic_type || "table")),
													];
													if (types.length === 1) {
														return `${doc.tables.length} ${formatRegionType(types[0])}`;
													}
													return types.map(formatRegionType).join(", ");
												})()}
											</div>
										</button>
										{selectedDocId === doc.doc_id && doc.tables.length > 1 && (
											<div className="ml-3 space-y-0.5">
												{doc.tables.map((table, tableIdx) => (
													<button
														key={table.region_id}
														onClick={() => {
															setSelectedTable(table);
															setCurrentPage(1);
														}}
														className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
															selectedTable?.region_id === table.region_id
																? "bg-slate-600 text-white"
																: "text-slate-400 hover:text-slate-200"
														}`}
													>
														Page {table.page_number} -{" "}
														{formatRegionType(table.semantic_type) || `Table ${tableIdx + 1}`}
														{table.row_count > 0 && (
															<span className="ml-1 text-slate-500">({table.row_count})</span>
														)}
													</button>
												))}
											</div>
										)}
									</div>
								))
							)}
						</div>
					</div>

					{/* Main content - table display */}
					<div className="flex-1 flex flex-col overflow-hidden">
						{selectedTable ? (
							<>
								{/* Table header */}
								<div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
									<div className="flex items-center justify-between">
										<div>
											<h4 className="text-sm font-medium text-white">
												{currentDoc?.document_type} - Page {selectedTable.page_number}
												{selectedTable.semantic_type && (
													<span className="ml-2 text-blue-400 font-normal">
														({formatRegionType(selectedTable.semantic_type)})
													</span>
												)}
											</h4>
											<p className="text-xs text-slate-400 mt-0.5">
												{selectedTable.row_count} rows, {selectedTable.columns.length} columns
												{totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
											</p>
										</div>
										{Object.keys(selectedTable.semantic_mapping).length > 0 && (
											<div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
												Columns mapped to schema
											</div>
										)}
									</div>
								</div>

								{/* Table content */}
								<div className="flex-1 overflow-auto p-4">
									{pageLoading ? (
										<div className="flex items-center justify-center py-12">
											<div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
										</div>
									) : selectedTable.rows.length === 0 ? (
										<div className="flex items-center justify-center py-12 text-slate-400 text-sm">
											No rows in this table
										</div>
									) : (
										<table className="w-full text-sm">
											<thead className="sticky top-0">
												<tr className="bg-slate-800">
													<th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase border-b border-slate-700">
														#
													</th>
													{selectedTable.columns.map((col) => {
														const semanticName = selectedTable.semantic_mapping[col];
														return (
															<th
																key={col}
																className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase border-b border-slate-700"
															>
																<span>{col}</span>
																{semanticName && semanticName !== col && (
																	<span className="ml-1 text-blue-400 font-normal normal-case">
																		({semanticName})
																	</span>
																)}
															</th>
														);
													})}
												</tr>
											</thead>
											<tbody>
												{selectedTable.rows.map((row, idx) => (
													<tr
														key={row.row_index}
														className={`border-b border-slate-700/50 hover:bg-slate-800/50 ${
															idx % 2 === 0 ? "bg-slate-850" : ""
														}`}
													>
														<td className="px-3 py-2 text-slate-500 text-xs">{row.row_index}</td>
														{selectedTable.columns.map((col) => {
															const cellKey = selectedTable.semantic_mapping[col] || col;
															return (
																<td key={col} className="px-3 py-2 text-slate-200">
																	{row.cells[cellKey] ?? row.cells[col] ?? "-"}
																</td>
															);
														})}
													</tr>
												))}
											</tbody>
										</table>
									)}
								</div>

								{/* Pagination footer */}
								{totalPages > 1 && (
									<div className="px-4 py-2 border-t border-slate-700 bg-slate-800/50 flex items-center justify-between">
										<span className="text-xs text-slate-400">
											Showing {(currentPage - 1) * PAGE_SIZE + 1}–
											{Math.min(currentPage * PAGE_SIZE, selectedTable.row_count)} of{" "}
											{selectedTable.row_count}
										</span>
										<div className="flex items-center gap-2">
											<button
												onClick={() => handlePageChange(currentPage - 1)}
												disabled={currentPage <= 1 || pageLoading}
												className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
											>
												Previous
											</button>
											<span className="text-xs text-slate-400">
												{currentPage} / {totalPages}
											</span>
											<button
												onClick={() => handlePageChange(currentPage + 1)}
												disabled={currentPage >= totalPages || pageLoading}
												className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
											>
												Next
											</button>
										</div>
									</div>
								)}
							</>
						) : (
							<div className="flex-1 flex items-center justify-center text-slate-400">
								{loading ? "Loading..." : "Select a table to view"}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-3 border-t border-slate-700 flex justify-end">
					<button
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}
