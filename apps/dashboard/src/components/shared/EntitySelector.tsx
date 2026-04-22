/**
 * EntitySelector - Tab navigation for multi-entity income analysis.
 *
 * Displays a tab bar for switching between:
 * - Individual entity worksheets (one per business entity)
 * - Summary view showing aggregated totals
 *
 * Each entity tab shows the entity's display name (e.g., partnership name)
 * and optionally the identifier (e.g., EIN) as a subtitle.
 */

import { useMemo } from "react";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Entity info from the API response.
 */
export interface EntityInfo {
	/** Unique identifier (e.g., EIN, property address) */
	id: string;
	/** Display name for the tab (e.g., "ABC Partners LLC") */
	name: string;
	/** Entity type from spec (e.g., "partnership", "rental") */
	type?: string;
}

/**
 * Props for EntitySelector component.
 */
export interface EntitySelectorProps {
	/** List of entities to display as tabs */
	entities: EntityInfo[];

	/** Currently selected entity ID, or "summary" for summary view */
	selectedId: string;

	/** Callback when user selects an entity or summary */
	onSelect: (id: string) => void;

	/** Whether to show the summary tab (default: true) */
	showSummary?: boolean;

	/** Custom class for the container */
	className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EntitySelector({
	entities,
	selectedId,
	onSelect,
	showSummary = true,
	className = "",
}: EntitySelectorProps) {
	// Build tab list: entities + optional summary
	const tabs = useMemo(() => {
		const entityTabs = entities.map((entity) => {
			// If name equals id (e.g., "B"), use entity type + id for better display
			// e.g., "Property B" instead of just "B"
			// Exception: Don't add "Borrower" prefix for person entities - use name directly
			let label = entity.name || entity.id;
			if (entity.name === entity.id && entity.type && entity.type !== "borrower") {
				label = `${entity.type.charAt(0).toUpperCase() + entity.type.slice(1)} ${entity.id}`;
			}

			return {
				id: entity.id,
				label,
				subtitle: entity.id !== entity.name ? entity.id : undefined,
				type: entity.type,
			};
		});

		if (showSummary) {
			return [
				{
					id: "summary",
					label: "Summary",
					subtitle: `${entities.length} entities`,
					type: "aggregate",
				},
				...entityTabs,
			];
		}

		return entityTabs;
	}, [entities, showSummary]);

	// Don't render if no entities
	if (entities.length === 0) {
		return null;
	}

	// Don't render tabs if only one entity and no summary
	if (entities.length === 1 && !showSummary) {
		return null;
	}

	return (
		<div className={`border-b border-slate-200 bg-white ${className}`}>
			{/* Entity count badge */}
			<div className="px-4 pt-3 pb-1">
				<span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
					Entities ({entities.length})
				</span>
			</div>

			{/* Tab bar */}
			<div className="flex overflow-x-auto px-2" role="tablist">
				{tabs.map((tab) => {
					const isSelected = selectedId === tab.id;
					const isSummary = tab.id === "summary";

					return (
						<button
							key={tab.id}
							role="tab"
							aria-selected={isSelected}
							onClick={() => onSelect(tab.id)}
							className={`
                flex flex-col items-start px-4 py-2 min-w-[140px] max-w-[200px]
                border-b-2 transition-colors text-left
                ${
									isSelected
										? isSummary
											? "border-purple-600 bg-purple-50/50"
											: "border-blue-600 bg-blue-50/50"
										: "border-transparent hover:bg-slate-50 hover:border-slate-300"
								}
              `}
						>
							{/* Entity type badge */}
							{tab.type && !isSummary && (
								<span
									className={`
                    text-[10px] font-medium uppercase tracking-wide mb-0.5
                    ${isSelected ? "text-blue-600" : "text-slate-400"}
                  `}
								>
									{tab.type}
								</span>
							)}

							{/* Main label */}
							<span
								className={`
                  text-sm font-medium truncate w-full
                  ${
										isSelected
											? isSummary
												? "text-purple-700"
												: "text-blue-700"
											: "text-slate-700"
									}
                `}
							>
								{tab.label}
							</span>

							{/* Subtitle (e.g., EIN or entity count) */}
							{tab.subtitle && (
								<span
									className={`
                    text-xs truncate w-full
                    ${isSelected ? "text-slate-600" : "text-slate-400"}
                  `}
								>
									{tab.subtitle}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export default EntitySelector;
