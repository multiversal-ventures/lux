/**
 * SemanticTable - Reusable table component for income/spec component display.
 *
 * Supports:
 * - Dynamic column headers from table_config
 * - Collapsible groups for pivot-like tables
 * - Role-based styling (data_row, subtotal, grand_total, metric, outcome, header, hidden)
 * - Multiple data types (currency, percentage, boolean, number, integer, string)
 * - Source refs with navigation
 * - Render hints for special formatting (badge, outcome, percentage)
 */

import React, { useState, useCallback, useMemo } from "react";
import type { SourceRef } from "../../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Column definition from table_config.
 */
export interface TableColumn {
	id: string;
	type: string; // label, currency, percentage, sign, etc.
	source: string; // Field to get value from
	header_template?: string | null; // Header text override
	visible_when?: string | null; // Condition for visibility
	emphasis?: string | null; // primary, secondary, tertiary
}

/**
 * Table group for pivot-like aggregation.
 */
export interface TableGroup {
	id: string;
	label: string;
	includes: string[];
	aggregation?: string; // sum, avg, count
	collapsible: boolean;
}

/**
 * Sub-row for pivot-like grouping (v0.9.1+).
 */
export interface TableSubRow {
	id: string;
	label: string;
	sign?: string;
	column_values?: Record<string, number | string | null>;
}

/**
 * Aggregation metadata for multi-entity summary components.
 */
export interface ComponentAggregation {
	source: string;
	render_hint?: string;
}

/**
 * Type for column values - supports single values or arrays for aggregation.
 */
export type ColumnValue = number | string | null | (number | string | null)[];

/**
 * Component to render in the table.
 * Supports both IncomeComponent and SpecComponentOutput shapes.
 */
export interface TableComponent {
	// Identity
	id?: string; // Component ID for group matching
	name: string;

	// Display
	source_line?: string;
	sign?: string;
	data_type?: string; // currency, percentage, boolean, number, string

	// Column values dict for arbitrary columns (v0.9.1+)
	// Keys match column IDs from table_config (e.g., "y1", "y2", "ytd")
	// Can contain arrays for aggregation (e.g., "array": [0.35, 0.35])
	column_values?: Record<string, ColumnValue>;

	// Legacy values - backward compat
	y1?: number | string | null;
	y2?: number | string | null;
	ytd?: number | null;

	// Semantic hints
	role?: string; // data_row, subtotal, grand_total, metric, outcome, header, hidden
	emphasis?: string; // primary, secondary, tertiary
	render_hint?: string; // summary_row, single_value, percentage, badge, outcome, percentage_array, currency_array
	group_id?: string; // Group this component belongs to

	// Sub-rows for pivot pattern (v0.9.1+)
	sub_rows?: TableSubRow[];

	// Aggregation metadata (for multi-entity summary)
	aggregation?: string | ComponentAggregation; // "sum", "avg", "count" OR full object with source/render_hint

	// Source navigation
	source_refs?: SourceRef[];
	column_source_refs?: Record<string, SourceRef[]>;
}

/**
 * Props for SemanticTable component.
 */
export interface SemanticTableProps {
	/** Components to render as rows */
	components: TableComponent[];

	/** Optional column definitions from table_config */
	columns?: TableColumn[];

	/** Optional groups for pivot-like display */
	groups?: TableGroup[];

	/** Column header overrides - fallback if columns not provided */
	columnHeaders?: {
		component?: string;
		source_line?: string;
		sign?: string;
		y1?: string;
		y2?: string;
	};

	/** Callback when source ref is clicked */
	onSourceClick?: (sourceRef: SourceRef) => void;

	/** Whether to show the source column */
	showSourceColumn?: boolean;

	/** Whether to show the sign column */
	showSignColumn?: boolean;

	/** Custom class for the table container */
	className?: string;
}

// =============================================================================
// VALUE FORMATTING
// =============================================================================

/**
 * Format a single percentage value.
 * Handles both decimal (0.40 for 40%) and whole number (40 for 40%) conventions.
 */
function formatPercentageValue(value: number, decimals: number = 1): string {
	// If value > 1, assume it's already a whole number percentage
	const displayValue = Math.abs(value) > 1 ? value : value * 100;
	return `${displayValue.toFixed(decimals)}%`;
}

/**
 * Format a single currency value.
 */
function formatCurrencyValue(value: number): string {
	if (value === 0) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(value);
}

/**
 * Format an array of values for display (aggregation summary).
 */
export function formatArrayValue(
	values: (number | string | null)[],
	renderHint?: string,
	dataType?: string,
): string {
	if (!values || values.length === 0) return "—";

	// Determine formatting based on render_hint or data_type
	const hint = renderHint || dataType;

	if (hint === "percentage_array" || hint === "percentage") {
		const formatted = values.map((v) => {
			if (v == null) return "—";
			if (typeof v === "number") {
				// For percentage arrays, assume values are decimals (0.35 = 35%)
				return `${(v * 100).toFixed(0)}%`;
			}
			return String(v);
		});
		return `[${formatted.join(", ")}]`;
	}

	if (hint === "currency_array" || hint === "currency") {
		const formatted = values.map((v) => {
			if (v == null) return "—";
			if (typeof v === "number") {
				return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
			}
			return String(v);
		});
		return `[${formatted.join(", ")}]`;
	}

	if (hint === "number_array" || hint === "number") {
		const formatted = values.map((v) => {
			if (v == null) return "—";
			if (typeof v === "number") {
				return v.toLocaleString("en-US");
			}
			return String(v);
		});
		return `[${formatted.join(", ")}]`;
	}

	// Default: string representation
	const formatted = values.map((v) => (v == null ? "—" : String(v)));
	return `[${formatted.join(", ")}]`;
}

/**
 * Format a value based on its data type.
 */
export function formatValue(
	value: unknown,
	dataType: string = "currency",
	renderHint?: string,
): string {
	if (value == null) return "—";

	// Handle array values (aggregation summary)
	if (Array.isArray(value)) {
		return formatArrayValue(value, renderHint, dataType);
	}

	// Handle render hints that override data type
	if (renderHint === "percentage") {
		if (typeof value === "number") {
			return `${value.toFixed(1)}%`;
		}
		return String(value);
	}

	// Handle percentage_array/currency_array for single values (shouldn't happen but be safe)
	if (renderHint === "percentage_array" && typeof value === "number") {
		return formatPercentageValue(value, 0);
	}
	if (renderHint === "currency_array" && typeof value === "number") {
		return formatCurrencyValue(value);
	}

	switch (dataType) {
		case "currency":
			if (typeof value === "number") {
				return formatCurrencyValue(value);
			}
			return String(value);

		case "percentage":
			if (typeof value === "number") {
				return formatPercentageValue(value);
			}
			return String(value);

		case "boolean":
			if (typeof value === "boolean") {
				return value ? "Yes" : "No";
			}
			return String(value);

		case "number":
			if (typeof value === "number") {
				return new Intl.NumberFormat("en-US").format(value);
			}
			return String(value);

		case "integer":
			if (typeof value === "number") {
				return Math.round(value).toLocaleString("en-US");
			}
			return String(value);

		case "string":
		default:
			return String(value);
	}
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SemanticTable({
	components,
	columns,
	groups = [],
	columnHeaders: headerOverrides,
	onSourceClick,
	showSourceColumn = true,
	showSignColumn = true,
	className = "",
}: SemanticTableProps) {
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

	// Toggle group collapse state
	const toggleGroup = useCallback((groupId: string) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			return next;
		});
	}, []);

	// Build column definitions from table_config or use defaults
	// Note: Columns are rendered in the order defined in table_config
	const effectiveColumns = useMemo((): TableColumn[] => {
		if (columns && columns.length > 0) {
			return columns;
		}
		// Default columns if none provided
		return [
			{ id: "component", type: "label", source: "display_name" },
			{ id: "source_line", type: "label", source: "source_line" },
			{ id: "sign", type: "sign", source: "sign" },
			{ id: "y2", type: "currency", source: "y2", header_template: "Y2" },
			{ id: "y1", type: "currency", source: "y1", header_template: "Y1" },
		];
	}, [columns]);

	// Default headers for common column IDs
	const defaultHeaders: Record<string, string> = {
		component: "Component",
		source_line: "Source",
		sign: "",
		y1: "Y1",
		y2: "Y2",
		y3: "Y3",
		ytd: "YTD",
	};

	// Build column headers
	const headers = useMemo(() => {
		const result: Record<string, string> = {};
		for (const col of effectiveColumns) {
			// Use header_template if provided, then default headers, then col.id
			result[col.id] = col.header_template ?? defaultHeaders[col.id] ?? col.id;
		}
		// Apply header overrides for backward compat
		if (headerOverrides) {
			Object.assign(result, headerOverrides);
		}
		return result;
	}, [effectiveColumns, headerOverrides]);

	// Get value for a column from component
	const getColumnValue = useCallback((comp: TableComponent, columnId: string): ColumnValue => {
		// First try column_values dict (v0.9.1+)
		if (comp.column_values) {
			// Check for array aggregation (Summary view) - special key "array"
			if (columnId in comp.column_values) {
				return comp.column_values[columnId];
			}
			// For summary views, the API may put arrays in an "array" key
			if (comp.column_values.array && Array.isArray(comp.column_values.array)) {
				return comp.column_values.array;
			}
		}
		// Fall back to legacy fields
		if (columnId === "y1") return comp.y1 ?? null;
		if (columnId === "y2") return comp.y2 ?? null;
		if (columnId === "ytd") return comp.ytd ?? null;
		return null;
	}, []);

	// Organize rows with group headers
	const organizedRows = useMemo(() => {
		type TableRow =
			| { type: "group_header"; group: TableGroup }
			| { type: "component"; component: TableComponent; hidden: boolean };

		const rows: TableRow[] = [];
		const groupMap = new Map<string, TableGroup>();
		const seenGroups = new Set<string>();

		// Build group map
		for (const group of groups) {
			groupMap.set(group.id, group);
		}

		for (const comp of components) {
			// Skip hidden components
			if (comp.role === "hidden") continue;

			const groupId = comp.group_id;

			// Insert group header if this is the first component of a group
			if (groupId && groupMap.has(groupId) && !seenGroups.has(groupId)) {
				const group = groupMap.get(groupId)!;
				rows.push({ type: "group_header", group });
				seenGroups.add(groupId);
			}

			// Add component (mark as hidden if its group is collapsed)
			const isHidden = groupId ? collapsedGroups.has(groupId) : false;
			rows.push({ type: "component", component: comp, hidden: isHidden });
		}

		return rows;
	}, [components, groups, collapsedGroups]);

	// Get row styling based on role and emphasis
	const getRowClassName = (comp: TableComponent): string => {
		const classes = ["border-b"];

		switch (comp.role) {
			case "subtotal":
				classes.push("font-semibold", "bg-slate-50");
				break;
			case "grand_total":
				classes.push("font-bold", "bg-slate-100");
				break;
			case "header":
				classes.push("bg-slate-50", "font-medium");
				break;
			case "metric":
				classes.push("bg-blue-50/50");
				break;
			case "outcome":
				classes.push("bg-purple-50/50");
				break;
			default:
				classes.push("hover:bg-slate-50");
		}

		if (comp.emphasis === "primary") {
			classes.push("text-slate-900");
		} else if (comp.emphasis === "tertiary") {
			classes.push("text-slate-500", "text-sm");
		}

		return classes.join(" ");
	};

	// Render sign badge
	const renderSign = (sign?: string) => {
		if (!sign) return null;

		let colorClass = "bg-slate-100 text-slate-600";
		if (sign === "+") {
			colorClass = "bg-green-100 text-green-700";
		} else if (sign === "-") {
			colorClass = "bg-red-100 text-red-700";
		} else if (sign === "=" || sign.includes("%")) {
			colorClass = "bg-blue-100 text-blue-700";
		}

		return (
			<span
				className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${colorClass}`}
			>
				{sign}
			</span>
		);
	};

	if (organizedRows.length === 0) {
		return (
			<div className={`bg-white rounded-lg border border-slate-200 p-4 ${className}`}>
				<p className="text-sm text-slate-500 italic">No components to display</p>
			</div>
		);
	}

	// Filter columns based on visibility and show flags
	// Note: visible_when conditions are evaluated in the backend - columns not meeting
	// the condition are simply not included in the response
	const visibleColumns = useMemo(() => {
		return effectiveColumns.filter((col) => {
			if (col.id === "source_line" && !showSourceColumn) return false;
			if (col.id === "sign" && !showSignColumn) return false;
			return true;
		});
	}, [effectiveColumns, showSourceColumn, showSignColumn]);

	// Calculate colspan for group headers
	const colSpan = visibleColumns.length;

	// Get column alignment based on type
	const getColumnAlignment = (col: TableColumn): string => {
		switch (col.type) {
			case "currency":
			case "percentage":
			case "number":
				return "text-right";
			case "sign":
				return "text-center";
			default:
				return "text-left";
		}
	};

	return (
		<div className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="bg-slate-50 border-b">
							{visibleColumns.map((col) => (
								<th
									key={col.id}
									className={`px-3 py-2 font-medium text-slate-600 ${getColumnAlignment(col)}`}
								>
									{headers[col.id] || col.id}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{organizedRows.map((row, idx) => {
							// Group header row
							if (row.type === "group_header") {
								const group = row.group;
								const isCollapsed = collapsedGroups.has(group.id);
								return (
									<tr
										key={`group-${group.id}`}
										className="bg-blue-50 border-b cursor-pointer hover:bg-blue-100 transition-colors"
										onClick={() => group.collapsible && toggleGroup(group.id)}
									>
										<td colSpan={colSpan} className="px-3 py-2">
											<div className="flex items-center gap-2">
												{group.collapsible && (
													<span className="text-blue-600 text-xs">{isCollapsed ? "▶" : "▼"}</span>
												)}
												<span className="font-semibold text-blue-800">{group.label}</span>
												{group.aggregation && (
													<span className="text-xs text-blue-500 ml-2">({group.aggregation})</span>
												)}
											</div>
										</td>
									</tr>
								);
							}

							// Component row
							const comp = row.component;
							if (row.hidden) return null;

							// Render cell for a column
							const renderCell = (col: TableColumn) => {
								// Special handling for component column
								if (col.id === "component" || col.source === "display_name") {
									return (
										<td key={col.id} className="px-3 py-2">
											<div className="text-slate-700">{comp.name}</div>
											{/* Source refs */}
											{onSourceClick && comp.source_refs && comp.source_refs.length > 0 && (
												<div className="flex items-center gap-1 mt-1">
													{comp.source_refs.slice(0, 2).map((ref, refIdx) => (
														<button
															key={refIdx}
															onClick={() =>
																onSourceClick({
																	...ref,
																	fact_field_name: ref.fact_field_name ?? ref.field_name,
																})
															}
															className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
															title={`View ${ref.document_class} page ${ref.page_number}${ref.fact_field_name || ref.field_name ? ` - ${ref.fact_field_name || ref.field_name}` : ""}`}
														>
															{ref.canonical_key || `📄 p${ref.page_number}`}
														</button>
													))}
												</div>
											)}
										</td>
									);
								}

								// Source line column
								if (col.id === "source_line" || col.source === "source_line") {
									return (
										<td key={col.id} className="px-3 py-2 text-slate-500 text-xs">
											{comp.render_hint !== "badge" && comp.render_hint !== "outcome"
												? comp.source_line || "-"
												: ""}
										</td>
									);
								}

								// Sign column
								if (col.id === "sign" || col.type === "sign") {
									return (
										<td key={col.id} className="px-3 py-2 text-center">
											{comp.render_hint !== "badge" && comp.render_hint !== "outcome"
												? renderSign(comp.sign)
												: null}
										</td>
									);
								}

								// Value columns (y1, y2, ytd, or any other)
								const value = getColumnValue(comp, col.id);
								const alignment = getColumnAlignment(col);

								// Special rendering for badges/outcomes on Y1 column
								if (col.id === "y1" && comp.render_hint === "badge") {
									let badgeClass = "bg-slate-100 text-slate-600";
									if (comp.source_line === "Stable") {
										badgeClass = "bg-green-100 text-green-700";
									} else if (comp.source_line === "Increasing") {
										badgeClass = "bg-blue-100 text-blue-700";
									} else if (comp.source_line === "Declining") {
										badgeClass = "bg-amber-100 text-amber-700";
									}
									return (
										<td key={col.id} className={`px-3 py-2 ${alignment}`}>
											<span className={`px-2 py-0.5 rounded text-xs font-medium ${badgeClass}`}>
												{comp.source_line}
											</span>
										</td>
									);
								}

								if (col.id === "y1" && comp.render_hint === "outcome") {
									const label = comp.source_line?.replace("method_", "").replace(/_/g, " ");
									return (
										<td key={col.id} className={`px-3 py-2 ${alignment}`}>
											<span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
												{label}
											</span>
										</td>
									);
								}

								if (
									col.id === "y1" &&
									comp.render_hint === "percentage" &&
									typeof value === "number"
								) {
									const colorClass = value < 0 ? "text-red-600" : "text-green-600";
									return (
										<td key={col.id} className={`px-3 py-2 font-mono text-slate-900 ${alignment}`}>
											<span className={colorClass}>{value.toFixed(1)}%</span>
										</td>
									);
								}

								// Skip y2 for special render hints
								if (
									(col.id === "y2" || col.id === "ytd") &&
									(comp.render_hint === "percentage" ||
										comp.render_hint === "badge" ||
										comp.render_hint === "outcome" ||
										comp.render_hint === "single_value")
								) {
									return (
										<td key={col.id} className={`px-3 py-2 font-mono text-slate-900 ${alignment}`}>
											—
										</td>
									);
								}

								// Standard value formatting
								// Use component's data_type if defined, otherwise fall back to column type
								// Special handling for "count" column - should always be integer
								const displayType = col.id === "count" ? "integer" : comp.data_type || col.type;
								return (
									<td key={col.id} className={`px-3 py-2 font-mono text-slate-900 ${alignment}`}>
										{formatValue(value, displayType, comp.render_hint)}
									</td>
								);
							};

							// Check if this component has sub_rows (pivot pattern)
							if (comp.sub_rows && comp.sub_rows.length > 0) {
								// Render sub_rows with aggregation
								const subRowElements: React.ReactNode[] = [];

								// Aggregation accumulators per column
								const columnTotals: Record<string, number> = {};

								// Render each sub-row
								comp.sub_rows.forEach((subRow, subIdx) => {
									// Accumulate values for aggregation
									if (comp.aggregation === "sum" && subRow.column_values) {
										for (const [colId, val] of Object.entries(subRow.column_values)) {
											if (typeof val === "number") {
												columnTotals[colId] = (columnTotals[colId] || 0) + val;
											}
										}
									}

									subRowElements.push(
										<tr key={`comp-${idx}-sub-${subIdx}`} className="border-b hover:bg-slate-50">
											{visibleColumns.map((col) => {
												if (col.id === "component" || col.source === "display_name") {
													return (
														<td key={col.id} className="px-3 py-2 pl-6 text-slate-700">
															{subRow.label}
														</td>
													);
												}
												if (col.id === "source_line") {
													return (
														<td key={col.id} className="px-3 py-2 text-slate-500 text-xs"></td>
													);
												}
												if (col.id === "sign" || col.type === "sign") {
													return (
														<td key={col.id} className="px-3 py-2 text-center">
															{renderSign(subRow.sign)}
														</td>
													);
												}
												// Value columns
												const subVal = subRow.column_values?.[col.id];
												return (
													<td
														key={col.id}
														className={`px-3 py-2 font-mono text-slate-900 ${getColumnAlignment(col)}`}
													>
														{formatValue(subVal, col.type)}
													</td>
												);
											})}
										</tr>,
									);
								});

								// Render aggregation (total) row if specified
								if (comp.aggregation === "sum") {
									subRowElements.push(
										<tr key={`comp-${idx}-total`} className="border-b font-semibold bg-slate-50">
											{visibleColumns.map((col) => {
												if (col.id === "component" || col.source === "display_name") {
													return (
														<td key={col.id} className="px-3 py-2 text-slate-900">
															Total
														</td>
													);
												}
												if (col.id === "source_line") {
													return <td key={col.id} className="px-3 py-2"></td>;
												}
												if (col.id === "sign" || col.type === "sign") {
													return <td key={col.id} className="px-3 py-2"></td>;
												}
												// Value columns - show aggregated total
												const totalVal = columnTotals[col.id];
												return (
													<td
														key={col.id}
														className={`px-3 py-2 font-mono text-slate-900 ${getColumnAlignment(col)}`}
													>
														{formatValue(totalVal, col.type)}
													</td>
												);
											})}
										</tr>,
									);
								}

								return subRowElements;
							}

							// Standard component row (no sub_rows)
							return (
								<tr key={`comp-${idx}`} className={getRowClassName(comp)}>
									{visibleColumns.map(renderCell)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export default SemanticTable;
