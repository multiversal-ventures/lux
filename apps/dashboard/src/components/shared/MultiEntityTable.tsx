/**
 * MultiEntityTable - Combines EntitySelector with SemanticTable for multi-entity display.
 *
 * When multiple entities are present:
 * - Shows entity tabs at the top
 * - Renders the selected entity's worksheet
 * - Summary tab shows aggregate totals
 *
 * For single entity or no entities:
 * - Falls back to standard SemanticTable behavior
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SourceRef } from "../../types";
import { type EntityInfo, EntitySelector } from "./EntitySelector";
import {
	SemanticTable,
	type TableColumn,
	type TableComponent,
	type TableGroup,
} from "./SemanticTable";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Per-entity evaluation result from the API.
 */
export interface EntityResult {
	/** Entity identifier (e.g., EIN) */
	id: string;
	/** Entity display name */
	name: string;
	/** Entity type from spec */
	type?: string;
	/** Components for this entity's worksheet */
	components: TableComponent[];
	/** Derivation values for this entity */
	derivations: Record<string, unknown>;
}

/**
 * Aggregate result computed across all entities.
 */
export interface AggregateResult {
	/** Aggregate output values */
	values: Record<string, unknown>;
	/** Summary components for the aggregate view */
	components: TableComponent[];
}

/**
 * Props for MultiEntityTable component.
 */
export interface MultiEntityTableProps {
	/** Per-entity results (optional - if not provided, falls back to single entity) */
	entities?: EntityResult[];

	/** Aggregate results (optional - for summary tab) */
	aggregate?: AggregateResult;

	/** Fallback components for single-entity mode */
	components?: TableComponent[];

	/** Column definitions from table_config */
	columns?: TableColumn[];

	/** Groups for pivot-like display */
	groups?: TableGroup[];

	/** Column header overrides */
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

	/** Custom class for the container */
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MultiEntityTable({
	entities = [],
	aggregate,
	components = [],
	columns,
	groups,
	columnHeaders,
	onSourceClick,
	showSourceColumn = true,
	showSignColumn = true,
	className = "",
}: MultiEntityTableProps) {
	// Track selected entity (default to summary for multi-entity, first entity for single)
	const [selectedEntityId, setSelectedEntityId] = useState<string>(() => {
		// Always default to summary tab for multi-entity views
		return "summary";
	});

	// Reset selection when entities change (e.g., new evaluation results)
	useEffect(() => {
		if (entities.length > 0) {
			// Check if current selection is still valid
			const currentEntityExists = entities.some((e) => e.id === selectedEntityId);
			if (!currentEntityExists && selectedEntityId !== "summary") {
				// Reset to first entity if current selection is invalid
				setSelectedEntityId(entities[0].id);
			}
		} else if (selectedEntityId !== "summary") {
			// No entities - reset to summary
			setSelectedEntityId("summary");
		}
	}, [entities, selectedEntityId]);

	// Build entity info for selector
	const entityInfoList = useMemo((): EntityInfo[] => {
		return entities.map((entity) => ({
			id: entity.id,
			name: entity.name,
			type: entity.type,
		}));
	}, [entities]);

	// Get components for selected entity
	const selectedComponents = useMemo((): TableComponent[] => {
		// Summary view
		if (selectedEntityId === "summary") {
			if (aggregate?.components && aggregate.components.length > 0) {
				return aggregate.components;
			}
			// Fallback: show aggregate values as simple rows
			if (aggregate?.values) {
				return Object.entries(aggregate.values).map(([key, value]) => ({
					name: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
					y1: value as number | string | null,
					role: "grand_total",
					emphasis: "primary",
					data_type: typeof value === "number" ? "currency" : "string",
				}));
			}
			// No aggregate data - return empty
			return [];
		}

		// Find selected entity
		const selectedEntity = entities.find((e) => e.id === selectedEntityId);
		if (selectedEntity) {
			return selectedEntity.components;
		}

		// Fallback to single-entity components
		return components;
	}, [selectedEntityId, entities, aggregate, components]);

	// Handle entity selection
	const handleEntitySelect = useCallback((id: string) => {
		setSelectedEntityId(id);
	}, []);

	// Determine if we're in multi-entity mode
	const isMultiEntity = entities.length > 0;

	// Get display title for current view
	const viewTitle = useMemo(() => {
		if (selectedEntityId === "summary") {
			return "Summary (All Entities)";
		}
		const entity = entities.find((e) => e.id === selectedEntityId);
		if (entity) {
			return entity.name;
		}
		return "Worksheet";
	}, [selectedEntityId, entities]);

	return (
		<div className={`flex flex-col ${className}`}>
			{/* Entity Selector - only show if multi-entity */}
			{isMultiEntity && (
				<EntitySelector
					entities={entityInfoList}
					selectedId={selectedEntityId}
					onSelect={handleEntitySelect}
					showSummary={!!aggregate}
					className="mb-4 rounded-t-lg"
				/>
			)}

			{/* View title for selected entity */}
			{isMultiEntity && (
				<div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
					<h3 className="text-sm font-medium text-slate-700">{viewTitle}</h3>
					{selectedEntityId !== "summary" && (
						<p className="text-xs text-slate-500">Entity ID: {selectedEntityId}</p>
					)}
				</div>
			)}

			{/* Table */}
			<SemanticTable
				components={selectedComponents}
				columns={columns}
				groups={groups}
				columnHeaders={columnHeaders}
				onSourceClick={onSourceClick}
				showSourceColumn={showSourceColumn}
				showSignColumn={showSignColumn}
				className={isMultiEntity ? "rounded-t-none" : ""}
			/>

			{/* Entity count footer for summary view */}
			{isMultiEntity && selectedEntityId === "summary" && (
				<div className="px-4 py-2 bg-purple-50 border-t border-purple-200 rounded-b-lg">
					<p className="text-xs text-purple-700">
						Aggregate totals from {entities.length} entities
					</p>
				</div>
			)}
		</div>
	);
}

export default MultiEntityTable;
