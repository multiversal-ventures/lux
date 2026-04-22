import { bboxToStyle } from "../../types";
import type { InteractiveBoundingBoxProps } from "./types";

/**
 * Interactive bounding box overlay for inline editing (view mode)
 * Shows when a fact is selected and allows direct manipulation
 * Handles are placed outside for small bboxes to make them easier to grab
 */
export function InteractiveBoundingBox({
	bbox,
	pageNumber: _pageNumber,
	isNew,
	isDragging,
	hasChanges = false,
	isSaving = false,
	onDragStart,
	onConfirm,
	onCancel,
}: InteractiveBoundingBoxProps) {
	const style = bboxToStyle(bbox);

	// Calculate bbox dimensions in percentage
	const bboxWidth = (bbox.x2 - bbox.x1) * 100;
	const bboxHeight = (bbox.y2 - bbox.y1) * 100;

	// For small bboxes, use larger handles placed outside
	// Threshold: if either dimension is less than 5%, consider it "small"
	const isSmallWidth = bboxWidth < 8;
	const isSmallHeight = bboxHeight < 3;
	const isSmall = isSmallWidth || isSmallHeight;

	// Handle size scales up for small boxes
	const handleSize = isSmall ? 12 : 8;
	const halfHandle = handleSize / 2;

	// Offset handles further outside for small boxes
	const handleOffset = isSmall ? handleSize + 2 : halfHandle;

	const handleClass = `absolute rounded-full cursor-pointer transition-all duration-150 ${
		isNew
			? "bg-green-400 border-2 border-green-600 shadow-lg shadow-green-500/30"
			: "bg-orange-400 border-2 border-orange-600 shadow-lg shadow-orange-500/30"
	} hover:scale-150 hover:z-10`;

	return (
		<div
			className={`absolute transition-all ${isDragging ? "cursor-grabbing" : "cursor-grab"} ${
				isNew
					? "border-2 border-green-400 bg-green-400/20 shadow-[0_0_16px_rgba(74,222,128,0.5)]"
					: "border-2 border-orange-400 bg-orange-400/20 shadow-[0_0_16px_rgba(251,146,60,0.5)]"
			}`}
			style={{
				...style,
				// Ensure minimum visible size for very small bboxes
				minWidth: "20px",
				minHeight: "12px",
			}}
			onMouseDown={(e) => {
				e.stopPropagation();
				onDragStart(e, "move");
			}}
		>
			{/* Corner handles - positioned outside for small boxes */}
			{/* NW */}
			<div
				className={handleClass}
				style={{
					width: handleSize,
					height: handleSize,
					top: -handleOffset,
					left: -handleOffset,
					cursor: "nw-resize",
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					onDragStart(e, "resize-nw");
				}}
			/>
			{/* NE */}
			<div
				className={handleClass}
				style={{
					width: handleSize,
					height: handleSize,
					top: -handleOffset,
					right: -handleOffset,
					cursor: "ne-resize",
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					onDragStart(e, "resize-ne");
				}}
			/>
			{/* SW */}
			<div
				className={handleClass}
				style={{
					width: handleSize,
					height: handleSize,
					bottom: -handleOffset,
					left: -handleOffset,
					cursor: "sw-resize",
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					onDragStart(e, "resize-sw");
				}}
			/>
			{/* SE */}
			<div
				className={handleClass}
				style={{
					width: handleSize,
					height: handleSize,
					bottom: -handleOffset,
					right: -handleOffset,
					cursor: "se-resize",
				}}
				onMouseDown={(e) => {
					e.stopPropagation();
					onDragStart(e, "resize-se");
				}}
			/>

			{/* Edge handles - only show for larger boxes to reduce clutter on small ones */}
			{!isSmall && (
				<>
					{/* N */}
					<div
						className={handleClass}
						style={{
							width: handleSize,
							height: handleSize,
							top: -halfHandle,
							left: "50%",
							transform: "translateX(-50%)",
							cursor: "n-resize",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onDragStart(e, "resize-n");
						}}
					/>
					{/* S */}
					<div
						className={handleClass}
						style={{
							width: handleSize,
							height: handleSize,
							bottom: -halfHandle,
							left: "50%",
							transform: "translateX(-50%)",
							cursor: "s-resize",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onDragStart(e, "resize-s");
						}}
					/>
					{/* W */}
					<div
						className={handleClass}
						style={{
							width: handleSize,
							height: handleSize,
							left: -halfHandle,
							top: "50%",
							transform: "translateY(-50%)",
							cursor: "w-resize",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onDragStart(e, "resize-w");
						}}
					/>
					{/* E */}
					<div
						className={handleClass}
						style={{
							width: handleSize,
							height: handleSize,
							right: -halfHandle,
							top: "50%",
							transform: "translateY(-50%)",
							cursor: "e-resize",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onDragStart(e, "resize-e");
						}}
					/>
				</>
			)}

			{/* Floating label with action buttons - positioned above and offset to not overlap handles */}
			<div
				className="absolute flex items-center gap-1"
				style={{
					top: isSmall ? -handleOffset - 18 : -20,
					left: isSmall ? -handleOffset : 0,
				}}
			>
				<div
					className={`px-1.5 py-0.5 text-white text-[9px] rounded font-medium whitespace-nowrap pointer-events-none ${
						isNew ? "bg-green-500" : "bg-orange-500"
					}`}
				>
					{isSmall ? "↕ Drag corners" : "Drag to move"}
				</div>

				{/* Green confirm checkmark - shows when there are changes to save */}
				{hasChanges && onConfirm && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onConfirm();
						}}
						disabled={isSaving}
						className={`flex items-center justify-center w-5 h-5 rounded transition-all pointer-events-auto ${
							isSaving
								? "bg-green-400 cursor-wait"
								: "bg-green-500 hover:bg-green-600 hover:scale-110 cursor-pointer"
						} text-white shadow-md`}
						title="Save changes"
					>
						{isSaving ? (
							<svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									className="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									strokeWidth="4"
								/>
								<path
									className="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
						) : (
							<svg
								className="w-3 h-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={3}
							>
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						)}
					</button>
				)}

				{/* Cancel button - always visible to allow going back */}
				{onCancel && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onCancel();
						}}
						disabled={isSaving}
						className={`flex items-center justify-center w-5 h-5 rounded transition-all pointer-events-auto ${
							isSaving
								? "bg-slate-400 cursor-not-allowed"
								: "bg-slate-500 hover:bg-red-500 hover:scale-110 cursor-pointer"
						} text-white shadow-md`}
						title="Cancel"
					>
						<svg
							className="w-3 h-3"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={3}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}
