/**
 * ScenarioRefsTab - Refs view for scenario income results.
 * Displays all rows with source references from the income verification result,
 * matching SemanticTable layout: component name with blue underlined refs beneath.
 * View mode: clicking a ref shows compact sidebar + selected row + document canvas.
 */

import { useCallback, useMemo, useState } from "react";
import type { IncomeVerificationResult, IncomeSection } from "../../hooks/useApi";
import type { CaseResult } from "../../types";
import type { SourceRef } from "../../types";
import { getRefYear } from "../../utils/docUtils";
import { ScenarioRefsViewMode } from "./ScenarioRefsViewMode";
import type { RefRow } from "./scenarioRefsTypes";

/** Sort refs by year: Y2 first, then Y1, then unknown. Matches Y2 | Y1 column order. */
function sortRefsByYear(
	refs: SourceRef[],
	caseResult: CaseResult | undefined,
	year1?: number,
	year2?: number,
): SourceRef[] {
	if (!caseResult || refs.length <= 1) return refs;
	return [...refs].sort((a, b) => {
		const ya = getRefYear(caseResult, a);
		const yb = getRefYear(caseResult, b);
		const na = ya == null;
		const nb = yb == null;
		if (na && nb) return 0;
		if (na) return 1;
		if (nb) return -1;
		if (typeof year2 === "number" && typeof year1 === "number") {
			const orderA = ya === year2 ? 0 : ya === year1 ? 1 : 2;
			const orderB = yb === year2 ? 0 : yb === year1 ? 1 : 2;
			return orderA - orderB;
		}
		return ya - yb;
	});
}

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

interface ScenarioRefsTabProps {
	caseId: string;
	productResult: IncomeVerificationResult | null;
	caseResult?: CaseResult | undefined;
}

/** Recursively collect ref rows from sections (including child_sections and entities). */
function collectRefRowsFromSection(section: IncomeSection, partyName: string, out: RefRow[]): void {
	const sectionName = section.table_name ?? section.spec_file ?? "";

	// Flat components
	for (const comp of section.components ?? []) {
		if (comp.source_refs && comp.source_refs.length > 0) {
			const y1 = comp.column_values?.y1 ?? comp.y1;
			const y2 = comp.column_values?.y2 ?? comp.y2;
			out.push({
				partyName,
				sectionName,
				rowLabel: comp.name,
				refs: comp.source_refs,
				sourceLine: comp.source_line,
				sign: comp.sign,
				y1: typeof y1 === "number" ? y1 : null,
				y2: typeof y2 === "number" ? y2 : null,
			});
		}
	}

	// Multi-entity: entities[].components
	for (const entity of section.entities ?? []) {
		const entityLabel = entity.entity_name ? ` (${entity.entity_name})` : "";
		for (const comp of entity.components ?? []) {
			const c = comp as {
				name?: string;
				source_refs?: SourceRef[];
				source_line?: string;
				sign?: string;
				y1?: number;
				y2?: number;
				column_values?: Record<string, unknown>;
			};
			if (c.source_refs && c.source_refs.length > 0) {
				const y1 = c.column_values?.y1 ?? c.y1;
				const y2 = c.column_values?.y2 ?? c.y2;
				out.push({
					partyName,
					sectionName: sectionName + entityLabel,
					rowLabel: c.name ?? "—",
					refs: c.source_refs,
					sourceLine: c.source_line,
					sign: c.sign,
					y1: typeof y1 === "number" ? y1 : null,
					y2: typeof y2 === "number" ? y2 : null,
				});
			}
		}
	}

	// Calculation step inputs with source_ref
	for (const step of section.calculation_steps ?? []) {
		for (const input of step.input_values ?? []) {
			if (input.source_ref?.file_id) {
				const stepLabel = step.display_label ?? step.derivation_name ?? `Step ${step.step_number}`;
				out.push({
					partyName,
					sectionName,
					rowLabel: `${stepLabel}: ${input.name.replace(/_/g, " ").replace(/y(\d)/, "Y$1")}`,
					refs: [input.source_ref],
					sourceLine: input.source_line,
				});
			}
		}
	}

	// Child sections (recursive)
	for (const child of section.child_sections ?? []) {
		collectRefRowsFromSection(child, partyName, out);
	}
}

export function ScenarioRefsTab({ caseId, productResult, caseResult }: ScenarioRefsTabProps) {
	const [selectedRow, setSelectedRow] = useState<RefRow | null>(null);
	const [selectedRef, setSelectedRef] = useState<SourceRef | null>(null);
	const inViewMode = selectedRow != null && selectedRef != null;

	const refRows = useMemo((): RefRow[] => {
		if (!productResult?.parties) return [];
		const out: RefRow[] = [];
		for (const party of productResult.parties) {
			for (const section of party.sections ?? []) {
				collectRefRowsFromSection(section, party.name, out);
			}
		}
		// Sort refs by year (Y2 first, then Y1) using resolved years from getRefYear
		const y1 = productResult.year_1;
		const y2 = productResult.year_2;
		if (caseResult != null) {
			for (const row of out) {
				row.refs = sortRefsByYear(
					row.refs,
					caseResult,
					typeof y1 === "number" ? y1 : undefined,
					typeof y2 === "number" ? y2 : undefined,
				);
			}
		}
		return out;
	}, [productResult, caseResult]);

	const groupedBySection = useMemo(() => {
		const groups: { sectionName: string; rows: RefRow[] }[] = [];
		let current: { sectionName: string; rows: RefRow[] } | null = null;
		for (const row of refRows) {
			if (!current || current.sectionName !== row.sectionName) {
				current = { sectionName: row.sectionName, rows: [] };
				groups.push(current);
			}
			current.rows.push(row);
		}
		return groups;
	}, [refRows]);

	const handleRefClick = useCallback((row: RefRow, ref: SourceRef) => {
		setSelectedRow(row);
		setSelectedRef(ref);
	}, []);

	const handleCloseViewMode = useCallback(() => {
		setSelectedRow(null);
		setSelectedRef(null);
	}, []);

	if (!productResult) {
		return (
			<div className="min-h-[200px] text-sm text-slate-500 italic">
				No income results available.
			</div>
		);
	}

	if (refRows.length === 0) {
		return (
			<div className="min-h-[200px] text-sm text-slate-500 italic">
				No source references available for this product.
			</div>
		);
	}

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

	const renderRowRefs = (row: RefRow) =>
		row.refs.map((ref, refIdx, refs) => {
			const refYear = getRefYear(caseResult, ref);
			const label = ref.canonical_key || `📄 p${ref.page_number ?? "?"}`;
			const yearLabel = refYear != null ? `${label}: ${refYear}` : label;
			return (
				<button
					key={refIdx}
					onClick={() =>
						handleRefClick(row, { ...ref, fact_field_name: ref.fact_field_name ?? ref.field_name })
					}
					className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
					title={`View ${ref.document_class ?? "document"} page ${ref.page_number ?? ""}${ref.fact_field_name || ref.field_name ? ` - ${ref.fact_field_name || ref.field_name}` : ""}`}
				>
					{`${yearLabel}${refIdx === refs.length - 1 ? "" : ", "}`}
				</button>
			);
		});

	if (inViewMode && selectedRow && selectedRef) {
		return (
			<ScenarioRefsViewMode
				caseId={caseId}
				caseResult={caseResult}
				productResult={productResult}
				selectedRow={selectedRow}
				selectedRef={selectedRef}
				refRows={refRows}
				onRefClick={handleRefClick}
				onClose={handleCloseViewMode}
			/>
		);
	}

	// Main view: table of all ref rows
	return (
		<div className="bg-white overflow-auto flex flex-col gap-6 min-h-0 p-4">
			{groupedBySection.map((group, gIdx) => (
				<div key={gIdx}>
					<div className="px-1 py-2 text-sm font-semibold text-slate-800">{group.sectionName}</div>
					<div className="overflow-x-auto">
						<table className="w-full text-sm rounded-lg border border-slate-200">
							<thead>
								<tr className="bg-slate-50 border-b">
									<th className="px-3 py-2 font-medium text-slate-600 text-left">Component</th>
									<th className="px-3 py-2 font-medium text-slate-600 text-left">line</th>
									<th className="px-3 py-2 font-medium text-slate-600 text-center">sign</th>
									<th className="px-3 py-2 font-medium text-slate-600 text-right">
										{productResult.year_2 ?? "Y2"}
									</th>
									<th className="px-3 py-2 font-medium text-slate-600 text-right">
										{productResult.year_1 ?? "Y1"}
									</th>
								</tr>
							</thead>
							<tbody>
								{group.rows.map((row, idx) => (
									<tr key={idx} className="border-b hover:bg-slate-50">
										<td className="px-3 py-2">
											<div className="text-slate-700">{row.rowLabel}</div>
											<div className="flex flex-wrap items-center gap-1 mt-1">
												{renderRowRefs(row)}
											</div>
										</td>
										<td className="px-3 py-2 text-slate-500 text-xs">{row.sourceLine || "—"}</td>
										<td className="px-3 py-2 text-center">{renderSign(row.sign)}</td>
										<td className="px-3 py-2 font-mono text-slate-900 text-right">
											{formatCurrency(row.y2)}
										</td>
										<td className="px-3 py-2 font-mono text-slate-900 text-right">
											{formatCurrency(row.y1)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			))}
		</div>
	);
}

export default ScenarioRefsTab;
