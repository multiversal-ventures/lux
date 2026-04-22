/**
 * SpecResultCard - Shared component for rendering spec evaluation results.
 *
 * Used by both:
 * - IncomeTab (production income verification display)
 * - SpecWorkshopPage (interactive spec development/testing)
 *
 * Features:
 * - Collapsible header with spec metadata
 * - SemanticTable for component values
 * - Calculation log (expandable)
 * - Proof certificate/trace (expandable)
 * - Deduplication exclusions
 * - Source navigation support
 */

import { useCallback, useState } from "react";
import type {
	CalculationStep as ApiCalculationStep,
	DeduplicationExclusion as ApiDeduplicationExclusion,
} from "../../hooks/useApi";
import type { SourceRef } from "../../types";
import { type AggregateResult, type EntityResult, MultiEntityTable } from "./MultiEntityTable";
import {
	SemanticTable,
	type TableColumn,
	type TableComponent,
	type TableGroup,
} from "./SemanticTable";

// =============================================================================
// TYPES - Re-export API types for convenience
// =============================================================================

export type CalculationStep = ApiCalculationStep;
export type DeduplicationExclusion = ApiDeduplicationExclusion;

export interface SpecResultCardProps {
	/** Unique ID for this result */
	id?: string;

	/** Display name for the table/section */
	tableName: string;

	/** Spec file name (e.g., "07-partnership-k1.yaml") */
	specFile?: string;

	/** Spec version */
	specVersion?: string;

	/** Form section (e.g., "Section VII - Partnership") */
	formSection?: string;

	/** Rule reference (e.g., "Fannie Mae Selling Guide B3-3.3-07") */
	ruleRef?: string;

	/** URL to rule documentation */
	ruleUrl?: string;

	/** Whether this is a summary/aggregator spec */
	isAggregator?: boolean;

	/** Whether this spec was skipped (no matching documents) */
	skipped?: boolean;

	/** Reason why spec was skipped */
	skipReason?: string;

	/** Outcome/determination text */
	outcome?: string;

	/** Additional guidance text */
	guidance?: string;

	/** Components to display in the table */
	components: TableComponent[];

	/** Column definitions */
	columns?: TableColumn[];

	/** Group definitions for pivot tables */
	groups?: TableGroup[];

	/** Year headers */
	y1Year?: string | number;
	y2Year?: string | number;

	/** Subtotals */
	subtotalY1?: number;
	subtotalY2?: number;
	subtotalMonthly?: number;

	/** Calculation steps for inspection */
	calculationSteps?: CalculationStep[];

	/** Proof trace lines */
	proofTrace?: string[];

	/** Evidence raw data */
	evidenceRaw?: Record<string, unknown>;

	/** Matching rules */
	matchingRules?: string[];

	/** Deduplication exclusions */
	dedupExcluded?: DeduplicationExclusion[];

	/** Callback when source ref is clicked */
	onSourceClick?: (ref: SourceRef) => void;

	/** Case ID for navigation (optional) */
	caseId?: string;

	/** Whether to show in compact mode (workshop) */
	compact?: boolean;

	/** Whether to start with details expanded */
	defaultExpanded?: boolean;

	/** Additional CSS classes */
	className?: string;

	// ==========================================================================
	// Multi-Entity Support (v0.10.0)
	// ==========================================================================
	// When entities are provided, uses MultiEntityTable instead of SemanticTable

	/** Per-entity evaluation results */
	entities?: EntityResult[];

	/** Aggregate results for summary tab */
	aggregate?: AggregateResult;

	/** Entity type label (e.g., "partnership", "employer") */
	entityType?: string;
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

function RuleRefBadge({ ruleRef, ruleUrl }: { ruleRef: string; ruleUrl?: string }) {
	const parts = ruleRef.match(/^(.*?)\s*(B\d+-[\d.]+(?:-\d+)?)?$/);
	const section = parts?.[2] || ruleRef;

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		if (ruleUrl) {
			window.open(ruleUrl, "_blank", "noopener,noreferrer");
		} else {
			const searchUrl = `https://selling-guide.fanniemae.com/Selling-Guide/Origination-thru-Closing/Subpart-B3-Underwriting-Borrowers/Chapter-B3-3-Income-Assessment/?q=${encodeURIComponent(section)}`;
			window.open(searchUrl, "_blank", "noopener,noreferrer");
		}
	};

	return (
		<button
			className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer"
			onClick={handleClick}
			title={`Click to open in new tab`}
		>
			<span>📘</span>
			<span className="font-medium">{section}</span>
			<svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
				/>
			</svg>
		</button>
	);
}

function CalculationLog({
	steps,
	defaultOpen = false,
}: { steps: CalculationStep[]; defaultOpen?: boolean }) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	if (steps.length === 0) return null;

	return (
		<div className="border-t border-slate-200">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
			>
				<span className="flex items-center gap-2">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
						/>
					</svg>
					Calculation Log ({steps.length} steps)
				</span>
				<span className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
			</button>

			{isOpen && (
				<div className="px-4 pb-3 space-y-2 bg-slate-50/50">
					{steps.map((step, idx) => {
						const stepNum = step.step_number ?? idx + 1;
						const label = step.display_label || step.derivation_name || "—";
						const resultDisplay =
							step.result_formatted ??
							(step.result != null && step.result !== "" ? String(step.result) : "—");
						return (
							<div key={`step-${idx}`} className="flex items-start gap-2 text-xs font-mono">
								<span className="text-slate-400 w-6 shrink-0">#{stepNum}</span>
								<div className="flex-1 min-w-0">
									<div className="font-medium text-slate-700">{label}</div>
									<div className="text-slate-500 truncate">
										{step.formula_display || step.formula}
									</div>
									<div className="text-blue-600 font-semibold">= {resultDisplay}</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ProofCertificate({
	proofTrace,
	evidenceRaw,
	matchingRules,
	outcome,
	ruleRef,
	defaultOpen = false,
}: {
	proofTrace?: string[];
	evidenceRaw?: Record<string, unknown>;
	matchingRules?: string[];
	outcome?: string;
	ruleRef?: string;
	defaultOpen?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	const hasContent =
		(proofTrace && proofTrace.length > 0) ||
		evidenceRaw ||
		(matchingRules && matchingRules.length > 0);
	if (!hasContent) return null;

	return (
		<div className="border-t border-slate-200">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
			>
				<span className="flex items-center gap-2">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
					Proof Certificate
				</span>
				<span className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
			</button>

			{isOpen && (
				<div className="px-4 pb-3 space-y-3 bg-slate-50/50 text-xs">
					{outcome && (
						<div>
							<div className="font-medium text-slate-500 mb-1">Determination</div>
							<div className="text-slate-700">{outcome}</div>
						</div>
					)}

					{proofTrace && proofTrace.length > 0 && (
						<div>
							<div className="font-medium text-slate-500 mb-1">Proof Trace</div>
							<ul className="space-y-1 text-slate-600">
								{proofTrace.map((line, idx) => (
									<li key={idx} className="flex items-start gap-2">
										<span className="text-green-500">✓</span>
										<span>{line}</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{matchingRules && matchingRules.length > 0 && (
						<div>
							<div className="font-medium text-slate-500 mb-1">Matching Rules</div>
							<div className="flex flex-wrap gap-1">
								{matchingRules.map((rule, idx) => (
									<span key={idx} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
										{rule}
									</span>
								))}
							</div>
						</div>
					)}

					{evidenceRaw && Object.keys(evidenceRaw).length > 0 && (
						<div>
							<div className="font-medium text-slate-500 mb-1">Evidence</div>
							<div className="bg-white p-2 rounded border border-slate-200 space-y-1">
								{/* Upper bounds (true conditions) */}
								{Array.isArray((evidenceRaw as { upper?: string[] }).upper) &&
									(evidenceRaw as { upper: string[] }).upper.map((item, idx) => (
										<div key={`upper-${idx}`} className="flex items-center gap-2 text-xs">
											<span className="text-green-600">✓</span>
											<span className="text-slate-700">
												{String(item)
													.replace(/_/g, " ")
													.replace(/\b\w/g, (c) => c.toUpperCase())}
											</span>
										</div>
									))}
								{/* Lower bounds (false conditions) */}
								{Array.isArray((evidenceRaw as { lower?: string[] }).lower) &&
									(evidenceRaw as { lower: string[] }).lower.map((item, idx) => (
										<div key={`lower-${idx}`} className="flex items-center gap-2 text-xs">
											<span className="text-slate-400">✗</span>
											<span className="text-slate-400">
												{String(item)
													.replace(/_/g, " ")
													.replace(/\b\w/g, (c) => c.toUpperCase())}
											</span>
										</div>
									))}
								{/* Fallback for other evidence formats */}
								{!Array.isArray((evidenceRaw as { upper?: string[] }).upper) &&
									!Array.isArray((evidenceRaw as { lower?: string[] }).lower) &&
									Object.entries(evidenceRaw).map(([key, value]) => (
										<div key={key} className="flex items-center gap-2 text-xs">
											<span className="text-slate-500 font-medium">{key}:</span>
											<span className="text-slate-700">{String(value)}</span>
										</div>
									))}
							</div>
						</div>
					)}

					{ruleRef && (
						<div>
							<div className="font-medium text-slate-500 mb-1">Rule Reference</div>
							<div className="text-slate-600">{ruleRef}</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

function DeduplicationExclusions({
	exclusions,
	defaultOpen = false,
}: {
	exclusions: DeduplicationExclusion[];
	defaultOpen?: boolean;
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	if (exclusions.length === 0) return null;

	return (
		<div className="border-t border-purple-200 bg-purple-50/50">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-purple-700 hover:bg-purple-100/50 transition-colors"
			>
				<span className="flex items-center gap-2">
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
						/>
					</svg>
					Deduplication ({exclusions.length} fields deferred)
				</span>
				<span className={`transform transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
			</button>

			{isOpen && (
				<div className="px-4 pb-3 space-y-2">
					{exclusions.map((excl, idx) => (
						<div key={idx} className="flex items-center justify-between text-xs">
							<div>
								<span className="font-medium text-purple-800">{excl.input_name}</span>
								{excl.year_suffix && (
									<span className="text-purple-500 ml-1">({excl.year_suffix})</span>
								)}
							</div>
							<div className="text-purple-600">
								{excl.original_value != null && `$${excl.original_value.toLocaleString()} → `}
								{excl.captured_by_spec}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SpecResultCard({
	tableName,
	specFile,
	specVersion,
	formSection: _formSection,
	ruleRef,
	ruleUrl,
	isAggregator = false,
	skipped = false,
	skipReason,
	outcome,
	guidance,
	components,
	columns,
	groups,
	y1Year = "Y1",
	y2Year = "Y2",
	subtotalY1,
	subtotalY2,
	subtotalMonthly,
	calculationSteps = [],
	proofTrace,
	evidenceRaw,
	matchingRules,
	dedupExcluded = [],
	onSourceClick,
	compact = true,
	defaultExpanded = false,
	className = "",
	// Multi-entity props
	entities,
	aggregate,
	entityType,
}: SpecResultCardProps) {
	// Check if this is a multi-entity section
	const isMultiEntity = entities && entities.length > 0;
	const [isExpanded, setIsExpanded] = useState(!skipped && defaultExpanded);

	// Card border styling
	const borderClass = isAggregator
		? skipped
			? "border-indigo-200 opacity-70"
			: "border-indigo-300 ring-1 ring-indigo-100"
		: skipped
			? "border-slate-200 opacity-60"
			: "border-slate-200";

	// Header styling
	const headerClass = isAggregator
		? skipped
			? "bg-indigo-50 border-indigo-200"
			: "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200"
		: skipped
			? "bg-slate-100 border-slate-200"
			: "bg-slate-50 border-slate-200";

	const handleHeaderClick = useCallback(() => {
		if (components.length > 0 || calculationSteps.length > 0) {
			setIsExpanded(!isExpanded);
		}
	}, [components.length, calculationSteps.length, isExpanded]);

	return (
		<div className={`border rounded-lg overflow-hidden ${borderClass} ${className}`}>
			{/* Header */}
			<div
				className={`px-4 py-3 border-b ${headerClass} ${components.length > 0 ? "cursor-pointer" : ""}`}
				onClick={handleHeaderClick}
			>
				<div className="flex items-center justify-between">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							{/* Aggregator icon */}
							{isAggregator && (
								<span className="text-indigo-500" title="Summary/Analysis">
									<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
										/>
									</svg>
								</span>
							)}

							{/* Expand/collapse indicator */}
							{components.length > 0 && (
								<span
									className={`text-slate-400 text-xs transition-transform ${isExpanded ? "rotate-90" : ""}`}
								>
									▶
								</span>
							)}

							{/* Table name */}
							<h4
								className={`font-medium truncate ${
									isAggregator
										? skipped
											? "text-indigo-400"
											: "text-indigo-800"
										: skipped
											? "text-slate-500"
											: "text-slate-800"
								}`}
							>
								{tableName}
							</h4>

							{/* Badges */}
							{isAggregator && !skipped && (
								<span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 rounded shrink-0">
									Summary
								</span>
							)}
							{skipped && (
								<span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-500 rounded shrink-0">
									N/A
								</span>
							)}
						</div>

						{/* Metadata row */}
						{!compact && (
							<div className="flex items-center gap-2 mt-0.5">
								{specFile && <span className="text-xs text-slate-400">{specFile}</span>}
								{specVersion && <span className="text-xs text-slate-400">v{specVersion}</span>}
								{ruleRef && !skipped && <RuleRefBadge ruleRef={ruleRef} ruleUrl={ruleUrl} />}
							</div>
						)}
					</div>

					{/* Subtotals */}
					<div className="text-right shrink-0 ml-4">
						<div className={`text-sm ${skipped ? "text-slate-400" : "text-slate-600"}`}>
							{skipped
								? "—"
								: subtotalMonthly != null && subtotalMonthly > 0
									? `$${subtotalMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`
									: "—"}
						</div>
						{!skipped && (subtotalY1 != null || subtotalY2 != null) && (
							<div className="text-xs text-slate-400">
								{y2Year}: {subtotalY2 != null ? `$${subtotalY2.toLocaleString("en-US")}` : "—"} |{" "}
								{y1Year}: {subtotalY1 != null ? `$${subtotalY1.toLocaleString("en-US")}` : "—"}
							</div>
						)}
					</div>
				</div>

				{/* Outcome / determination */}
				{outcome && (
					<div
						className={`mt-2 p-2 rounded text-xs ${
							skipped
								? "bg-slate-100 border border-slate-200"
								: isAggregator
									? "bg-indigo-50 border border-indigo-200"
									: "bg-blue-50 border border-blue-100"
						}`}
					>
						<span
							className={`font-medium ${
								skipped ? "text-slate-500" : isAggregator ? "text-indigo-800" : "text-blue-800"
							}`}
						>
							{skipped ? "Status: " : isAggregator ? "Analysis: " : "Determination: "}
						</span>
						<span
							className={
								skipped ? "text-slate-500" : isAggregator ? "text-indigo-700" : "text-blue-700"
							}
						>
							{outcome}
						</span>

						{skipped && skipReason && (
							<p className="mt-1 text-amber-600 font-medium">Why: {skipReason}</p>
						)}

						{guidance && (
							<p
								className={`mt-1 ${
									skipped ? "text-slate-400" : isAggregator ? "text-indigo-600" : "text-blue-600"
								}`}
							>
								{guidance}
							</p>
						)}
					</div>
				)}
			</div>

			{/* Components Table - Multi-Entity or Single-Entity */}
			{isExpanded && !skipped && isMultiEntity && (
				<>
					{/* Entity count badge */}
					{entities.length > 1 && (
						<div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
							<span className="text-xs font-medium text-indigo-700">
								{entities.length} {entityType || "entities"}
							</span>
						</div>
					)}
					<MultiEntityTable
						entities={entities}
						aggregate={aggregate}
						columns={columns}
						groups={groups}
						columnHeaders={{
							y1: String(y1Year),
							y2: String(y2Year),
						}}
						onSourceClick={onSourceClick}
						className="rounded-none border-0"
					/>
				</>
			)}

			{/* Single-entity table */}
			{isExpanded && !skipped && !isMultiEntity && components.length > 0 && (
				<SemanticTable
					components={components}
					columns={columns}
					groups={groups}
					columnHeaders={{
						y1: String(y1Year),
						y2: String(y2Year),
					}}
					onSourceClick={onSourceClick}
					className="rounded-none border-0"
				/>
			)}

			{/* Empty state */}
			{isExpanded && !skipped && !isMultiEntity && components.length === 0 && (
				<div className="p-4 text-sm text-slate-500 italic">
					No component values extracted. Check that the document contains the required fields.
				</div>
			)}

			{/* Expandable sections */}
			{isExpanded && !skipped && (
				<>
					{/* Proof Certificate */}
					<ProofCertificate
						proofTrace={proofTrace}
						evidenceRaw={evidenceRaw}
						matchingRules={matchingRules}
						outcome={outcome}
						ruleRef={ruleRef}
						defaultOpen={defaultExpanded}
					/>

					{/* Calculation Log */}
					<CalculationLog steps={calculationSteps} defaultOpen={defaultExpanded} />

					{/* Deduplication */}
					<DeduplicationExclusions exclusions={dedupExcluded} defaultOpen={defaultExpanded} />
				</>
			)}
		</div>
	);
}

export default SpecResultCard;
