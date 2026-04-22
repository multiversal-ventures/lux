import { useEffect, useState } from "react";
import type { BoundingBox } from "../../types";
import type { FactCardProps } from "./types";

/** Highlights matching text with a different text color */
function HighlightText({ text, query }: { text: string; query?: string }) {
	if (!query || !query.trim()) {
		return <>{text}</>;
	}

	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const index = lowerText.indexOf(lowerQuery);

	if (index === -1) {
		return <>{text}</>;
	}

	return (
		<>
			{text.slice(0, index)}
			<span className="text-yellow-400">{text.slice(index, index + query.length)}</span>
			{text.slice(index + query.length)}
		</>
	);
}

/**
 * Individual fact display card - clickable with hover tooltip
 * Supports edit mode for inline value editing
 */
export function FactCard({
	fact,
	isSelected,
	isPending,
	isEditing,
	isInlineEditing,
	editMode,
	onClick,
	onValueChange,
	searchQuery,
}: FactCardProps) {
	const [showTooltip, setShowTooltip] = useState(false);

	const [localValue, setLocalValue] = useState(String(fact.value));

	// Update local value when fact changes (e.g., from external edit)
	useEffect(() => {
		setLocalValue(String(fact.value));
	}, [fact.value]);

	// Build tooltip content - display bbox as x1,y1 → x2,y2 format
	const getSourceDetails = () => {
		const details: string[] = [];

		const formatBbox = (bbox: BoundingBox) => {
			const x1 = (bbox.x1 * 100).toFixed(0);
			const y1 = (bbox.y1 * 100).toFixed(0);
			const x2 = (bbox.x2 * 100).toFixed(0);
			const y2 = (bbox.y2 * 100).toFixed(0);
			return `(${x1}%,${y1}%) → (${x2}%,${y2}%)`;
		};

		if (fact.sources && fact.sources.length > 0) {
			fact.sources.forEach((src, i) => {
				let line = `Source ${i + 1}: Page ${src.page_number}`;
				if (src.bbox) {
					line += ` • ${formatBbox(src.bbox)}`;
				}
				if (src.source_text) {
					line += ` • "${src.source_text.slice(0, 30)}${src.source_text.length > 30 ? "..." : ""}"`;
				}
				details.push(line);
			});
		} else if (fact.bbox) {
			let line = `Page ${fact.bbox.page_number ?? "?"}`;
			line += ` • ${formatBbox(fact.bbox)}`;
			details.push(line);
		}

		if (fact.source_text) {
			details.push(
				`Text: "${fact.source_text.slice(0, 50)}${fact.source_text.length > 50 ? "..." : ""}"`,
			);
		}

		if (details.length === 0) {
			details.push("No source location data available");
		}

		return details;
	};

	const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newValue = e.target.value;
		setLocalValue(newValue);
		onValueChange?.(newValue);
	};

	// Determine border/bg color based on state
	const getCardStyle = () => {
		if (isInlineEditing) {
			return "bg-orange-500/20 border border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.25)]";
		}
		if (isEditing) {
			return "bg-blue-500/15 border border-blue-500/40 shadow-[0_0_8px_rgba(59,130,246,0.2)]";
		}
		if (isPending) {
			return "bg-yellow-500/10 border border-yellow-500/40";
		}
		if (isSelected) {
			return "bg-orange-500/15 border border-orange-500/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]";
		}
		return "bg-slate-700/50 hover:bg-slate-700 border border-transparent";
	};

	return (
		<div
			className="relative"
			onMouseEnter={() => !editMode && !isInlineEditing && setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<div
				onClick={onClick}
				className={`w-full p-2 rounded-lg text-left transition-all duration-200 cursor-pointer ${getCardStyle()}`}
			>
				<div className="flex items-start justify-between gap-2">
					<span className="text-xs text-slate-400 font-medium">
						<HighlightText text={fact.field_name} query={searchQuery} />
					</span>
					<div className="flex items-center gap-1">
						{isInlineEditing && (
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/30 text-orange-400 animate-pulse">
								Editing
							</span>
						)}
						{isPending && !isInlineEditing && (
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
								Modified
							</span>
						)}
						{/* Extraction source indicator for fallback values */}
						{fact.extraction_source &&
							fact.extraction_source !== "llm" &&
							!isPending &&
							!isInlineEditing && (
								<span
									className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400"
									title={`Value from ${fact.extraction_source} - not real LLM extraction`}
								>
									{fact.extraction_source === "mocked" ? "mock" : fact.extraction_source}
								</span>
							)}
					</div>
				</div>

				{/* Editable value field when in edit mode and this card is being edited */}
				{editMode && isEditing ? (
					<input
						type="text"
						value={localValue}
						onChange={handleValueChange}
						onClick={(e) => e.stopPropagation()}
						className="w-full mt-1 px-2 py-1 bg-slate-700 border border-blue-500 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
						autoFocus
					/>
				) : (
					<p className="text-sm text-white mt-1 font-medium">
						<HighlightText text={String(fact.value)} query={searchQuery} />
					</p>
				)}

				{/* Provenance badge */}
				{fact.provenance && (
					<div className="mt-1 flex items-center gap-1">
						<span
							className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
								fact.provenance.type === "mismo"
									? "bg-blue-900/50 text-blue-300"
									: fact.provenance.type === "extension"
										? "bg-orange-900/50 text-orange-300"
										: "bg-slate-700 text-slate-400"
							}`}
							title={`${fact.provenance.source}${fact.provenance.element ? ` • ${fact.provenance.element}` : ""}`}
						>
							{fact.provenance.type === "mismo"
								? "MISMO"
								: fact.provenance.type === "extension"
									? "EXT"
									: "CUSTOM"}
						</span>
						{fact.provenance.element && (
							<span
								className="text-[10px] text-slate-500/70 font-mono truncate"
								title={fact.provenance.element}
							>
								{fact.provenance.element}
							</span>
						)}
					</div>
				)}

				{/* Edit mode hint */}
				{editMode && !isEditing && fact.bbox && (
					<p className="text-[10px] text-slate-500 mt-1">Click to edit • Drag bbox on page</p>
				)}
			</div>

			{/* Hover tooltip showing source reference - positioned below */}
			{showTooltip && (
				<div className="absolute left-0 right-0 top-full mt-1 z-50 animate-fade-in pointer-events-none">
					<div className="bg-slate-900/95 backdrop-blur border border-slate-600 rounded-lg shadow-xl p-2 text-[10px]">
						{/* Tooltip arrow pointing up */}
						<div className="absolute left-4 top-0 -translate-y-full">
							<div
								className="border-6 border-transparent border-b-slate-900/95"
								style={{ borderWidth: "6px" }}
							/>
						</div>
						<div className="flex items-center gap-1.5 text-slate-300 font-medium mb-1">
							<svg
								className="w-3 h-3 text-orange-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							Source Reference
						</div>
						<div className="space-y-0.5 text-slate-400">
							{getSourceDetails().map((line, i) => (
								<p key={i} className="leading-tight">
									{line}
								</p>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
