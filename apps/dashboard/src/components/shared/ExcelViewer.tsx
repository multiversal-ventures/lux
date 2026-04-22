/**
 * ExcelViewer - In-browser Excel file viewer using SheetJS
 *
 * Opens as a full-screen modal when clicking Excel buttons in sidebar.
 * Uses cellStyles: true + manual mapping to apply Excel styles (fill, font, etc.)
 * to the rendered HTML table.
 */

import { Download, Eye, EyeOff, FileSpreadsheet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { read, utils } from "xlsx";
import { sheetToHtmlWithStyles } from "../../lib/excelSheet";

interface ExcelViewerProps {
	signedUrl: string;
	filename: string;
	stage: string;
	onClose: () => void;
}

interface WorkbookState {
	workbook: ReturnType<typeof read>;
	sheetNames: string[];
}

export function ExcelViewer({ signedUrl, filename, stage, onClose }: ExcelViewerProps) {
	const [workbookState, setWorkbookState] = useState<WorkbookState | null>(null);
	const [activeSheet, setActiveSheet] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showHidden, setShowHidden] = useState(false);

	// Fetch and parse Excel file
	useEffect(() => {
		let cancelled = false;

		async function loadExcel() {
			try {
				setLoading(true);
				setError(null);

				const response = await fetch(signedUrl);
				if (!response.ok) {
					throw new Error(`Failed to fetch Excel file: ${response.status}`);
				}

				const arrayBuffer = await response.arrayBuffer();
				const wb = read(arrayBuffer, { type: "array", cellStyles: true });

				if (cancelled) return;

				setWorkbookState({ workbook: wb, sheetNames: wb.SheetNames });
				setActiveSheet(wb.SheetNames[0] || "");
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Failed to load Excel file");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadExcel();

		return () => {
			cancelled = true;
		};
	}, [signedUrl]);

	// Handle download
	const handleDownload = useCallback(() => {
		const link = document.createElement("a");
		link.href = signedUrl;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}, [signedUrl, filename]);

	// Handle escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const activeWorksheet = workbookState?.workbook.Sheets[activeSheet];
	const sheetHtml = activeWorksheet
		? sheetToHtmlWithStyles(activeWorksheet as Record<string, unknown>)
		: "";
	const sheetStats = activeWorksheet
		? (() => {
				const rows = utils.sheet_to_json<unknown[]>(activeWorksheet, { header: 1, defval: "" });
				const numCols =
					rows.length > 0 ? Math.max(...rows.map((r) => (r as unknown[]).length), 1) : 0;
				return { rows: rows.length, cols: numCols };
			})()
		: null;

	const hiddenRowCount = useMemo(() => {
		if (!activeWorksheet) return 0;
		const rowMeta = (activeWorksheet as Record<string, unknown>)["!rows"] as
			| Array<{ hidden?: boolean } | undefined>
			| undefined;
		if (!rowMeta) return 0;
		return rowMeta.filter((m) => m?.hidden).length;
	}, [activeWorksheet]);

	return (
		<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
			<div className="bg-white rounded-xl shadow-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
				{/* Header */}
				<div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
					<div className="flex items-center gap-3">
						<FileSpreadsheet className="w-5 h-5 text-emerald-600" />
						<div>
							<h2 className="text-sm font-semibold text-slate-900">{filename}</h2>
							<p className="text-xs text-slate-500 capitalize">{stage} Stage</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{hiddenRowCount > 0 && (
							<button
								onClick={() => setShowHidden((v) => !v)}
								className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
									showHidden
										? "text-indigo-700 bg-indigo-50 border-indigo-300 hover:bg-indigo-100"
										: "text-slate-700 bg-white border-slate-300 hover:bg-slate-50"
								}`}
								title={showHidden ? "Hide empty sections" : "Show empty sections"}
							>
								{showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								{hiddenRowCount} hidden
							</button>
						)}
						<button
							onClick={handleDownload}
							className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
						>
							<Download className="w-4 h-4" />
							Download
						</button>
						<button
							onClick={onClose}
							className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
							title="Close (Esc)"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Sheet Tabs */}
				{workbookState && workbookState.sheetNames.length > 1 && (
					<div className="px-4 py-2 border-b border-slate-200 bg-white shrink-0">
						<div className="flex gap-1 overflow-x-auto">
							{workbookState.sheetNames.map((name) => (
								<button
									key={name}
									onClick={() => setActiveSheet(name)}
									className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
										activeSheet === name
											? "bg-slate-900 text-white"
											: "text-slate-600 hover:bg-slate-100"
									}`}
								>
									{name}
								</button>
							))}
						</div>
					</div>
				)}

				{/* Content */}
				<div className="flex-1 overflow-auto p-4">
					{loading ? (
						<div className="h-full flex items-center justify-center">
							<div className="flex items-center gap-3">
								<svg
									className="w-6 h-6 animate-spin text-slate-400"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										className="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										strokeWidth="4"
									/>
									<path
										className="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									/>
								</svg>
								<span className="text-slate-600">Loading spreadsheet...</span>
							</div>
						</div>
					) : error ? (
						<div className="h-full flex items-center justify-center">
							<div className="text-center">
								<p className="text-red-600 font-medium">{error}</p>
								<button
									onClick={onClose}
									className="mt-4 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
								>
									Close
								</button>
							</div>
						</div>
					) : sheetHtml ? (
						<>
							{showHidden && (
								<style>{`.excel-sheet-container .xlsx-hidden { display: table-row !important; opacity: 0.45; }`}</style>
							)}
							<div
								className="excel-sheet-container overflow-auto rounded-lg border border-slate-200 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:whitespace-nowrap [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold"
								dangerouslySetInnerHTML={{ __html: sheetHtml }}
							/>
						</>
					) : (
						<div className="h-full flex items-center justify-center text-slate-500">
							No data available
						</div>
					)}
				</div>

				{/* Footer */}
				{sheetStats && workbookState && !loading && !error && (
					<div className="px-4 py-2 border-t border-slate-200 bg-slate-50 shrink-0">
						<div className="flex items-center justify-between text-sm text-slate-600">
							<span>
								{sheetStats.rows} row{sheetStats.rows !== 1 ? "s" : ""} &middot; {sheetStats.cols}{" "}
								column
								{sheetStats.cols !== 1 ? "s" : ""}
							</span>
							<span className="text-xs text-slate-400">
								Sheet {workbookState.sheetNames.indexOf(activeSheet) + 1} of{" "}
								{workbookState.sheetNames.length}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
