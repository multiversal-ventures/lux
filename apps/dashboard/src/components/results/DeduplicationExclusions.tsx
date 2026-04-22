import { useState } from "react";
import type { DeduplicationExclusion } from "../../hooks/useApi";

interface DeduplicationExclusionsProps {
	exclusions: DeduplicationExclusion[];
	defaultExpanded?: boolean;
}

/**
 * Format a spec name for display.
 * Converts snake_case to Title Case and makes it human-readable.
 */
function formatSpecName(specName: string): string {
	return specName
		.replace(/_income$/, "")
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format a field name for display.
 * Converts snake_case to Title Case.
 */
function formatFieldName(fieldName: string): string {
	return fieldName
		.replace(/_y\d+$/, "") // Remove year suffix
		.replace(/_/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format currency value for display.
 */
function formatCurrency(value?: number): string {
	if (value === undefined || value === null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

/**
 * Collapsible panel showing income fields that were excluded due to deduplication.
 * Helps users understand why certain income wasn't double-counted.
 */
export function DeduplicationExclusions({
	exclusions,
	defaultExpanded = false,
}: DeduplicationExclusionsProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	// Don't render if no exclusions
	if (!exclusions || exclusions.length === 0) {
		return null;
	}

	return (
		<div className="border-t border-slate-200">
			{/* Collapsible Header */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-2 flex items-center justify-between text-left bg-purple-50 hover:bg-purple-100 transition-colors"
			>
				<div className="flex items-center gap-2">
					<svg
						className={`w-4 h-4 text-purple-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
					<span className="text-sm font-medium text-purple-800">Deduplication</span>
					<span className="text-xs text-purple-600">
						({exclusions.length} field{exclusions.length !== 1 ? "s" : ""} deferred)
					</span>
				</div>
				<span className="text-xs text-purple-600">
					{isExpanded ? "Hide" : "Show"} excluded income
				</span>
			</button>

			{/* Exclusions Content */}
			{isExpanded && (
				<div className="px-4 py-3 bg-purple-50/50 space-y-3">
					{/* Explanation */}
					<div className="text-xs text-purple-700 bg-purple-100 px-3 py-2 rounded">
						These income fields were already counted by upstream specs and excluded here to avoid
						double-counting.
					</div>

					{/* Exclusions List */}
					<div className="p-3 rounded-lg border border-purple-200 bg-white">
						<div className="text-[10px] uppercase text-purple-600 font-semibold mb-2">
							Excluded Fields
						</div>
						<div className="space-y-2">
							{exclusions.map((exclusion, idx) => (
								<div
									key={`${exclusion.input_name}-${idx}`}
									className="flex items-start gap-3 text-sm border-b border-purple-100 last:border-0 pb-2 last:pb-0"
								>
									{/* Icon */}
									<span className="text-purple-500 mt-0.5">
										<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
											/>
										</svg>
									</span>

									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium text-slate-800">
												{formatFieldName(exclusion.canonical_field)}
											</span>
											{exclusion.original_value !== undefined && (
												<span className="text-slate-500">
													({formatCurrency(exclusion.original_value)})
												</span>
											)}
										</div>
										<div className="text-xs text-slate-500 mt-0.5">
											Deferred to{" "}
											<span className="font-medium text-purple-700">
												{formatSpecName(exclusion.captured_by_spec)}
											</span>
										</div>
									</div>

									{/* Year Badge */}
									<span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 text-purple-700 rounded">
										{exclusion.year_suffix.replace("_", "")}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
