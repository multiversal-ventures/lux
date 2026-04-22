/**
 * ScenarioRefsViewMode - View mode layout for scenario refs.
 * Shows compact sidebar + selected row + document canvas when a ref is clicked.
 */

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import type { CaseResult, FactSource } from "../../types";
import type { SourceRef } from "../../types";
import { getRefYear } from "../../utils/docUtils";
import { SimpleDocumentCanvas } from "../shared/SimpleDocumentCanvas";
import type { IncomeVerificationResult } from "../../hooks/useApi";
import type { RefRow } from "./scenarioRefsTypes";

function formatCurrency(value: number | null | undefined): string {
	if (value == null) return "—";
	if (value === 0) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

/** Build DocumentPageRef[] from file_id using case artifacts. */
function buildPagesForFile(
	caseResult: CaseResult | undefined,
	fileId: string | undefined,
): { file_id: string; page_number: number }[] {
	if (!fileId || !caseResult?.artifacts?.files) return [];
	const file = caseResult.artifacts.files.find((f) => f.file_id === fileId);
	if (!file || !file.total_pages) return [];
	return Array.from({ length: file.total_pages }, (_, i) => ({
		file_id: file.file_id,
		page_number: i + 1,
	}));
}

/**
 * Find FactSource[] for highlighting by looking up the fact from extraction documents.
 * Prefers document_class match and supports canonical_key fallback for consistent placement.
 */
function findFactSourcesForRef(caseResult: CaseResult | undefined, ref: SourceRef): FactSource[] {
	const pageNum = ref.page_number ?? 1;
	const fieldName = ref.fact_field_name ?? ref.field_name;
	const docClass = ref.document_class;
	const canonicalKey = ref.canonical_key;

	if (!caseResult?.extractions?.documents || !ref.file_id) {
		return [{ page_number: pageNum }];
	}

	const fieldPartFromCanonical = canonicalKey?.includes(".")
		? (canonicalKey.split(".").pop() ?? null)
		: null;
	const searchNames = [fieldName, fieldPartFromCanonical].filter(
		(n): n is string => typeof n === "string" && n.length > 0,
	);

	const matchesDoc = (doc: {
		document_type?: string;
		pages?: Array<{ file_id?: string; page_number?: number }>;
	}) => doc.pages?.some((p) => p.file_id === ref.file_id && p.page_number === pageNum);

	const matchesField = (f: { field_name?: string; canonical_key?: string }) => {
		const fn = (f.field_name ?? "").trim();
		const ck = (f as { canonical_key?: string }).canonical_key ?? "";
		if (!searchNames.length) return false;
		for (const name of searchNames) {
			if (fn === name || fn.toLowerCase() === name.toLowerCase()) return true;
			if (ck === canonicalKey || ck.endsWith(`.${name}`)) return true;
		}
		return false;
	};

	const candidates: Array<{
		doc: { document_type?: string };
		fact: { sources?: FactSource[]; bbox?: { page_number?: number }; source_text?: string };
	}> = [];

	for (const doc of caseResult.extractions.documents) {
		if (!matchesDoc(doc)) continue;
		const fact = doc.facts?.find(matchesField);
		if (!fact) continue;
		candidates.push({ doc, fact });
	}

	if (candidates.length === 0) return [{ page_number: pageNum }];

	const preferred =
		candidates.length > 1 && docClass
			? candidates.find((c) => (c.doc.document_type ?? "").toLowerCase() === docClass.toLowerCase())
			: null;
	const chosen = preferred ?? candidates[0];
	const { fact } = chosen;

	if (fact.sources && fact.sources.length > 0) {
		const onTargetPage = fact.sources.filter((s) => s.page_number === pageNum);
		if (onTargetPage.length > 0) return onTargetPage;
		return [{ page_number: pageNum }];
	}
	const bbox = fact.bbox as
		| { x1?: number; y1?: number; x2?: number; y2?: number; page_number?: number }
		| undefined;
	if (
		bbox &&
		typeof bbox.x1 === "number" &&
		typeof bbox.y1 === "number" &&
		typeof bbox.x2 === "number" &&
		typeof bbox.y2 === "number"
	) {
		const bboxPage = bbox.page_number ?? pageNum;
		return [
			{
				page_number: bboxPage,
				bbox: { x1: bbox.x1, y1: bbox.y1, x2: bbox.x2, y2: bbox.y2, page_number: bbox.page_number },
				source_text: fact.source_text,
			},
		];
	}
	return [{ page_number: pageNum }];
}

export interface ScenarioRefsViewModeProps {
	caseId: string;
	caseResult?: CaseResult;
	productResult?: IncomeVerificationResult | null;
	selectedRow: RefRow;
	selectedRef: SourceRef;
	refRows: RefRow[];
	onRefClick: (row: RefRow, ref: SourceRef) => void;
	onClose: () => void;
}

export function ScenarioRefsViewMode({
	caseId,
	caseResult,
	productResult,
	selectedRow,
	selectedRef,
	refRows,
	onRefClick,
	onClose,
}: ScenarioRefsViewModeProps) {
	const [factClickTag, setFactClickTag] = useState(0);
	const pages = buildPagesForFile(caseResult, selectedRef.file_id);
	const highlightedSources = findFactSourcesForRef(caseResult, selectedRef);
	const highlightedPage = selectedRef.page_number ?? highlightedSources[0]?.page_number ?? null;

	const handleRefClick = useCallback(
		(row: RefRow, ref: SourceRef) => {
			setFactClickTag((t) => t + 1);
			onRefClick(row, { ...ref, fact_field_name: ref.fact_field_name ?? ref.field_name });
		},
		[onRefClick],
	);

	const renderSign = (sign?: string) => {
		if (!sign) return null;
		let colorClass = "bg-slate-100 text-slate-600";
		if (sign === "+") colorClass = "bg-green-100 text-green-700";
		else if (sign === "-") colorClass = "bg-red-100 text-red-700";
		else if (sign === "=" || sign.includes("%")) colorClass = "bg-blue-100 text-blue-700";
		return (
			<span
				className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${colorClass}`}
			>
				{sign}
			</span>
		);
	};

	const isRefSelected = (row: RefRow, ref: SourceRef) =>
		selectedRow === row &&
		selectedRef.file_id === ref.file_id &&
		selectedRef.page_number === ref.page_number;

	const selectedRefIdx = selectedRow.refs.findIndex(
		(r) => r.file_id === selectedRef.file_id && r.page_number === selectedRef.page_number,
	);
	const isY2Selected = selectedRefIdx === 0;
	const isY1Selected = selectedRefIdx === 1;

	return (
		<div className="bg-white overflow-hidden flex flex-1 min-h-0">
			{/* LeftSidebar - compact list */}
			<div className="w-56 shrink-0 border-r border-slate-200 overflow-y-auto min-w-[250px]">
				<div className="p-2 space-y-1">
					{refRows.map((row, idx) => (
						<div key={idx} className="rounded">
							<div className="text-xs font-medium text-slate-700 break-words">{row.rowLabel}</div>
							<div className="mt-0.5">
								{row.refs.map((ref, refIdx) => {
									const refYear = getRefYear(caseResult, ref);
									let value: number | null =
										refYear === productResult?.year_1
											? (row.y1 ?? null)
											: refYear === productResult?.year_2
												? (row.y2 ?? null)
												: null;
									// Fallback: refs are sorted Y2 first, then Y1; for single ref use whichever exists
									if (value == null) {
										value =
											refIdx === 0
												? (row.y2 ?? row.y1 ?? null)
												: refIdx === 1
													? (row.y1 ?? row.y2 ?? null)
													: null;
									}
									return (
										<button
											key={refIdx}
											onClick={() => handleRefClick(row, ref)}
											className={`block text-left text-xs px-1.5 py-0.5 rounded cursor-pointer w-full ${
												isRefSelected(row, ref)
													? "bg-blue-100 text-blue-800 hover:bg-blue-200"
													: "text-blue-600 hover:bg-slate-200 hover:text-blue-800"
											}`}
											title={`View ${ref.document_class ?? "document"} page ${ref.page_number ?? ""}${ref.fact_field_name || ref.field_name ? ` - ${ref.fact_field_name || ref.field_name}` : ""}`}
										>
											{refYear ?? "?"}: {formatCurrency(value)}
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Right column: selected row + canvas */}
			<div className="flex-1 flex flex-col min-w-0 min-h-0">
				{/* Selected row block */}
				<div className="shrink-0 border-t border-b border-r border-slate-200 bg-white px-4 py-2">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-slate-500 text-left">
								<th className="pr-2 font-medium"></th>
								<th className="pr-2 font-medium">line</th>
								<th className="pr-2 font-medium text-center">sign</th>
								<th className="pr-2 font-medium text-right">{productResult?.year_2 ?? "Y2"}</th>
								<th className="font-medium text-right">{productResult?.year_1 ?? "Y1"}</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td className="py-1 pr-2">
									<div className="text-slate-700">{selectedRow.rowLabel}</div>
								</td>
								<td className="py-1 pr-2 text-slate-500 text-xs">
									{selectedRow.sourceLine || "—"}
								</td>
								<td className="py-1 pr-2 text-center">{renderSign(selectedRow.sign)}</td>
								<td
									className={`py-1 pr-2 font-mono text-right text-slate-900 ${isY2Selected ? "font-bold" : ""}`}
								>
									{formatCurrency(selectedRow.y2)}
								</td>
								<td
									className={`py-1 font-mono text-right text-slate-900 ${isY1Selected ? "font-bold" : ""}`}
								>
									{formatCurrency(selectedRow.y1)}
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{/* SimpleDocumentCanvas with close button overlay */}
				<div className="flex-1 min-h-0 flex flex-col relative">
					<button
						onClick={onClose}
						className="absolute top-2 border border-slate-200 right-2 z-10 p-2 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 bg-white/90"
						title="Close"
					>
						<X className="w-4 h-4" />
					</button>
					{pages.length > 0 ? (
						<SimpleDocumentCanvas
							caseId={caseId}
							pages={pages}
							highlightedSources={highlightedSources}
							highlightedPage={highlightedPage}
							scrollToFactTag={factClickTag}
						/>
					) : (
						<div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100">
							{caseResult?.artifacts?.files
								? "Document not found in case artifacts."
								: "No document data available."}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
