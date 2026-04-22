import { useRef, useState } from "react";
import type { InlineEditPanelProps } from "./types";

/**
 * Floating inline edit panel that appears next to the bounding box
 * Starts collapsed, can be expanded and dragged to any position
 */
export function InlineEditPanel({
	edit,
	containerRef,
	onFieldNameChange,
	onValueChange,
	onSave,
	onCancel,
	saving,
}: InlineEditPanelProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [panelOffset, setPanelOffset] = useState({ x: 0, y: 0 });
	const [isDraggingPanel, setIsDraggingPanel] = useState(false);
	const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
	const panelRef = useRef<HTMLDivElement>(null);

	// Calculate initial position relative to the container
	const getInitialPosition = () => {
		if (!containerRef) return { top: "50%", left: "50%" };

		const bboxRight = edit.bbox.x2 * 100;
		const bboxCenterY = ((edit.bbox.y1 + edit.bbox.y2) / 2) * 100;

		// Position to the right of bbox, vertically centered
		if (bboxRight < 60) {
			return {
				top: `${bboxCenterY}%`,
				left: `${bboxRight + 2}%`,
			};
		}

		// Position to the left if bbox is on the right side
		return {
			top: `${bboxCenterY}%`,
			left: `${Math.max(2, edit.bbox.x1 * 100 - 25)}%`,
		};
	};

	const basePosition = getInitialPosition();

	// Panel drag handlers
	const handlePanelDragStart = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		setIsDraggingPanel(true);
		dragStartRef.current = {
			x: e.clientX,
			y: e.clientY,
			offsetX: panelOffset.x,
			offsetY: panelOffset.y,
		};

		const handleMouseMove = (moveEvent: MouseEvent) => {
			const dx = moveEvent.clientX - dragStartRef.current.x;
			const dy = moveEvent.clientY - dragStartRef.current.y;
			setPanelOffset({
				x: dragStartRef.current.offsetX + dx,
				y: dragStartRef.current.offsetY + dy,
			});
		};

		const handleMouseUp = () => {
			setIsDraggingPanel(false);
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

	// Collapsed view - small pill
	if (!isExpanded) {
		return (
			<div
				className={`absolute z-50 flex items-center gap-1.5 px-2 py-1 rounded-full shadow-lg cursor-pointer select-none transition-all hover:scale-105 ${
					edit.isNew ? "bg-green-600 text-white" : "bg-orange-500 text-white"
				}`}
				style={{
					top: basePosition.top,
					left: basePosition.left,
					transform: `translate(${panelOffset.x}px, calc(-50% + ${panelOffset.y}px))`,
				}}
				onClick={(e) => {
					e.stopPropagation();
					setIsExpanded(true);
				}}
				onMouseDown={handlePanelDragStart}
			>
				<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
				<span className="text-[11px] font-medium max-w-[100px] truncate">
					{edit.fieldName || (edit.isNew ? "New" : "Edit")}
				</span>
				<svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</div>
		);
	}

	// Expanded view
	return (
		<div
			ref={panelRef}
			className={`absolute z-50 w-56 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-lg shadow-2xl animate-fade-in ${
				isDraggingPanel ? "cursor-grabbing" : ""
			}`}
			style={{
				top: basePosition.top,
				left: basePosition.left,
				transform: `translate(${panelOffset.x}px, calc(-50% + ${panelOffset.y}px))`,
			}}
			onClick={(e) => e.stopPropagation()}
		>
			{/* Drag handle header */}
			<div
				className={`flex items-center justify-between px-2.5 py-1.5 border-b border-slate-700 rounded-t-lg cursor-grab active:cursor-grabbing ${
					edit.isNew ? "bg-green-600/20" : "bg-orange-500/20"
				}`}
				onMouseDown={handlePanelDragStart}
			>
				<div className="flex items-center gap-1.5">
					<svg className="w-3 h-3 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
						<circle cx="5" cy="6" r="2" />
						<circle cx="12" cy="6" r="2" />
						<circle cx="19" cy="6" r="2" />
						<circle cx="5" cy="12" r="2" />
						<circle cx="12" cy="12" r="2" />
						<circle cx="19" cy="12" r="2" />
					</svg>
					<span
						className={`text-[10px] font-semibold ${edit.isNew ? "text-green-400" : "text-orange-400"}`}
					>
						{edit.isNew ? "New Fact" : "Edit Fact"}
					</span>
				</div>
				<div className="flex items-center gap-0.5">
					<button
						onClick={() => setIsExpanded(false)}
						className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-700"
						title="Collapse"
					>
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 15l7-7 7 7"
							/>
						</svg>
					</button>
					<button
						onClick={onCancel}
						className="p-0.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-700"
						title="Cancel"
					>
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>

			<div className="p-2.5 space-y-2">
				{/* Field Name */}
				<div>
					<label className="block text-[9px] text-slate-500 font-medium mb-0.5 uppercase tracking-wide">
						Field
					</label>
					<input
						type="text"
						value={edit.fieldName}
						onChange={(e) => onFieldNameChange(e.target.value)}
						placeholder="e.g., gross_income"
						className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
						autoFocus={edit.isNew}
					/>
				</div>

				{/* Value */}
				<div>
					<label className="block text-[9px] text-slate-500 font-medium mb-0.5 uppercase tracking-wide">
						Value
					</label>
					<input
						type="text"
						value={edit.value}
						onChange={(e) => onValueChange(e.target.value)}
						placeholder="Enter value"
						className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
						autoFocus={!edit.isNew}
					/>
				</div>

				{/* Compact metadata row with provenance */}
				{(edit.fact.provenance || edit.fact.data_type) && (
					<div className="flex items-center gap-1.5 text-[9px] text-slate-500">
						{edit.fact.provenance && (
							<span
								className={`px-1.5 py-0.5 rounded truncate max-w-[120px] ${
									edit.fact.provenance.type === "mismo"
										? "bg-blue-900/50 text-blue-300"
										: edit.fact.provenance.type === "extension"
											? "bg-orange-900/50 text-orange-300"
											: "bg-slate-700 text-slate-400"
								}`}
								title={edit.fact.provenance.element || edit.fact.provenance.source}
							>
								{edit.fact.provenance.type === "mismo"
									? "MISMO"
									: edit.fact.provenance.type === "extension"
										? "EXT"
										: "CUSTOM"}
							</span>
						)}
						{edit.fact.data_type && (
							<span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
								{edit.fact.data_type}
							</span>
						)}
					</div>
				)}

				{/* Action buttons */}
				<div className="flex items-center gap-1.5 pt-1">
					<button
						onClick={onCancel}
						className="flex-1 px-2 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
					>
						Cancel
					</button>
					<button
						onClick={onSave}
						disabled={saving || (!edit.isNew && !edit.fieldName.trim())}
						className={`flex-1 px-2 py-1 text-[11px] rounded transition-colors flex items-center justify-center gap-1 ${
							saving || (!edit.isNew && !edit.fieldName.trim())
								? "bg-slate-600 text-slate-400 cursor-not-allowed"
								: edit.isNew
									? "bg-green-600 text-white hover:bg-green-700"
									: "bg-orange-500 text-white hover:bg-orange-600"
						}`}
					>
						{saving ? (
							<svg
								className="w-3 h-3 animate-spin"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
						) : (
							<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M5 13l4 4L19 7"
								/>
							</svg>
						)}
						{saving ? "Saving" : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}
