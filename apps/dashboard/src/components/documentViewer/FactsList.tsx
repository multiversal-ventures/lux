import { useState, useMemo, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { trackSearch } from "../../lib/mixpanel";
import { useAuth } from "../../hooks";
import type { Fact } from "../../types";
import { FactCard } from "./FactCard";
import type { PendingFactEdit } from "./types";

/** Props for FactsList component */
export interface FactsListProps {
	/** Sorted facts with their original indices */
	facts: Array<{ fact: Fact; originalIndex: number }>;
	/** Currently selected fact (for highlighting) */
	selectedFact: Fact | null;
	/** Map of pending edits by fact index */
	pendingFactEdits: Map<number, PendingFactEdit>;
	/** Index of fact currently being edited in bbox mode */
	editingFactIndex: number | null;
	/** Index of fact being inline edited */
	inlineEditingFactIndex: number | null;
	/** Whether edit mode is active */
	isEditMode: boolean;
	/** Message to show when facts_count > 0 but facts array is empty */
	loadingMessage?: string;
	/** Message to show when no facts exist */
	emptyMessage?: string;
	/** Ref map for scrolling to facts */
	factRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
	/** Called when a fact is clicked */
	onFactClick: (fact: Fact, originalIndex: number) => void;
	/** Called when fact value changes in edit mode */
	onValueChange?: (originalIndex: number, newValue: string) => void;
}

/** Classify a fact value into a category */
function classifyValue(
	value: string | number | boolean | null | undefined,
): "null" | "zero" | "number" | "string" {
	if (value === null || value === undefined || value === "") return "null";
	if (value === 0 || value === "0") return "zero";
	if (typeof value === "number") return "number";
	return "string";
}

/** Toggle chip component for filter options */
function FilterChip({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			className={`
        px-2 py-0.5 text-xs font-medium rounded-full transition-colors
        ${
					active
						? "bg-blue-500/20 text-blue-400 border border-blue-500"
						: "bg-slate-700/50 text-slate-500 border border-slate-600"
				}
      `}
		>
			{label} ({count})
		</button>
	);
}

/**
 * FactsList - Renders a list of extracted facts using FactCard components
 *
 * Includes search and filter functionality.
 * Handles empty/loading states and delegates click events to parent.
 */
export function FactsList({
	facts,
	selectedFact,
	pendingFactEdits,
	editingFactIndex,
	inlineEditingFactIndex,
	isEditMode,
	// loadingMessage not used - empty state handled by parent
	emptyMessage = "No facts extracted",
	factRefs,
	onFactClick,
	onValueChange,
}: FactsListProps) {
	const { user } = useAuth();
	// Search and filter state
	const [searchQuery, setSearchQuery] = useState("");
	const lastTrackedQuery = useRef<string>("");
	const [showFilters, setShowFilters] = useState(false);
	const [showStrings, setShowStrings] = useState(true);
	const [showNumbers, setShowNumbers] = useState(true);
	const [showNulls, setShowNulls] = useState(false); // Hidden by default
	const [showZeros, setShowZeros] = useState(true);

	// Count facts by category
	const categoryCounts = useMemo(() => {
		const counts = { null: 0, zero: 0, number: 0, string: 0 };
		for (const { fact } of facts) {
			counts[classifyValue(fact.value)]++;
		}
		return counts;
	}, [facts]);

	// Check if filters are non-default (for indicator)
	const hasActiveFilters = !showStrings || !showNumbers || !showNulls || !showZeros;

	// Filter facts based on search and type filters
	const filteredFacts = useMemo(() => {
		return facts.filter(({ fact }) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesName = fact.field_name.toLowerCase().includes(query);
				const matchesValue = String(fact.value ?? "")
					.toLowerCase()
					.includes(query);
				if (!matchesName && !matchesValue) return false;
			}

			// Type filters
			const category = classifyValue(fact.value);
			if (category === "null" && !showNulls) return false;
			if (category === "zero" && !showZeros) return false;
			if (category === "number" && !showNumbers) return false;
			if (category === "string" && !showStrings) return false;

			return true;
		});
	}, [facts, searchQuery, showStrings, showNumbers, showNulls, showZeros]);

	// Track search when user searches (debounced, 2+ chars)
	useEffect(() => {
		const trimmed = searchQuery.trim();
		if (trimmed.length < 2) return;
		if (trimmed === lastTrackedQuery.current) return;
		const timer = setTimeout(() => {
			lastTrackedQuery.current = trimmed;
			trackSearch({
				search_query: trimmed,
				user_id: user?.uid,
				results_count: filteredFacts.length,
			});
		}, 600);
		return () => clearTimeout(timer);
	}, [searchQuery, filteredFacts.length, user?.uid]);

	if (facts.length === 0) {
		return (
			<div className="p-3">
				<p className="text-sm text-slate-400 text-center py-4">{emptyMessage}</p>
			</div>
		);
	}

	return (
		<div className="p-3 space-y-2">
			{/* Search and filter header */}
			<div className="space-y-2">
				<div className="flex items-center gap-2">
					{/* Search input */}
					<div className="relative flex-1">
						<Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							placeholder="Search facts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-8 pr-8 py-1.5 text-sm bg-transparent border border-slate-600 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-400"
						/>
						{searchQuery && (
							<button
								onClick={() => setSearchQuery("")}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
							>
								<X className="w-4 h-4" />
							</button>
						)}
					</div>
					{/* Filter toggle button */}
					<button
						onClick={() => setShowFilters(!showFilters)}
						className={`
              p-1.5 rounded-md border transition-colors relative
              ${
								showFilters
									? "bg-blue-500/20 border-blue-500 text-blue-400"
									: "border-slate-600 text-slate-400 hover:bg-slate-700"
							}
            `}
						title="Toggle filters"
					>
						<SlidersHorizontal className="w-4 h-4" />
						{/* Active filter indicator dot */}
						{hasActiveFilters && !showFilters && (
							<span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
						)}
					</button>
				</div>

				{/* Filter chips (expanded) */}
				{showFilters && (
					<div className="grid grid-cols-2 gap-1.5">
						<FilterChip
							label="Numbers"
							count={categoryCounts.number}
							active={showNumbers}
							onClick={() => setShowNumbers(!showNumbers)}
						/>
						<FilterChip
							label="Strings"
							count={categoryCounts.string}
							active={showStrings}
							onClick={() => setShowStrings(!showStrings)}
						/>
						<FilterChip
							label="Zeros"
							count={categoryCounts.zero}
							active={showZeros}
							onClick={() => setShowZeros(!showZeros)}
						/>
						<FilterChip
							label="Nulls"
							count={categoryCounts.null}
							active={showNulls}
							onClick={() => setShowNulls(!showNulls)}
						/>
					</div>
				)}

				{/* Results count */}
				{(searchQuery || hasActiveFilters) && (
					<p className="text-xs text-slate-400">
						{filteredFacts.length} of {facts.length} facts
					</p>
				)}
			</div>

			{/* Fact cards */}
			{filteredFacts.length === 0 ? (
				<p className="text-sm text-slate-400 text-center py-4">No facts match filters</p>
			) : (
				filteredFacts.map(({ fact, originalIndex }) => {
					const pendingEdit = pendingFactEdits.get(originalIndex);
					const isBeingEdited = isEditMode && editingFactIndex === originalIndex;
					const isInlineEditing = inlineEditingFactIndex === originalIndex;

					return (
						<div
							key={originalIndex}
							ref={(el) => {
								if (el) factRefs.current.set(originalIndex, el);
								else factRefs.current.delete(originalIndex);
							}}
						>
							<FactCard
								fact={pendingEdit?.editedFact ?? fact}
								isSelected={selectedFact === fact || isBeingEdited || isInlineEditing}
								isPending={!!pendingEdit}
								isEditing={isBeingEdited}
								isInlineEditing={isInlineEditing}
								editMode={isEditMode}
								onClick={() => onFactClick(fact, originalIndex)}
								onValueChange={
									isEditMode && onValueChange
										? (newValue) => onValueChange(originalIndex, newValue)
										: undefined
								}
								searchQuery={searchQuery}
							/>
						</div>
					);
				})
			)}
		</div>
	);
}
