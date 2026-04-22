import { bboxToStyle } from "../../types";
import type { EditableBoundingBoxProps } from "./types";

/**
 * Editable bounding box with drag handles for move/resize
 */
export function EditableBoundingBox({
	bbox,
	factIndex,
	pageNumber,
	isPending,
	isEditing,
	isDragging,
	isNew = false,
	isSaving = false,
	onMouseDown,
	onClick,
	onConfirm,
}: EditableBoundingBoxProps) {
	const style = bboxToStyle(bbox);

	// Handle size (in pixels)
	const handleSize = 8;
	const halfHandle = handleSize / 2;

	return (
		<div
			className={`absolute rounded transition-all ${
				isDragging ? "cursor-grabbing" : "cursor-grab"
			} ${
				isNew
					? "border-2 border-green-400 bg-green-400/20 shadow-[0_0_12px_rgba(74,222,128,0.4)]"
					: isEditing
						? "border-2 border-blue-400 bg-blue-400/20 shadow-[0_0_12px_rgba(96,165,250,0.4)]"
						: isPending
							? "border-2 border-yellow-400 bg-yellow-400/20"
							: "border-2 border-slate-400 bg-slate-400/10 hover:bg-slate-400/20"
			}`}
			style={style}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			onMouseDown={(e) => {
				e.stopPropagation();
				onMouseDown(e, factIndex, pageNumber, "move");
			}}
		>
			{/* Resize handles - only show when this bbox is being edited */}
			{isEditing && (
				<>
					{/* Corner handles */}
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-nw-resize hover:bg-blue-100"
						style={{ width: handleSize, height: handleSize, top: -halfHandle, left: -halfHandle }}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-nw");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-ne-resize hover:bg-blue-100"
						style={{ width: handleSize, height: handleSize, top: -halfHandle, right: -halfHandle }}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-ne");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-sw-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							bottom: -halfHandle,
							left: -halfHandle,
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-sw");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-se-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							bottom: -halfHandle,
							right: -halfHandle,
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-se");
						}}
					/>

					{/* Edge handles */}
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-n-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							top: -halfHandle,
							left: "50%",
							transform: "translateX(-50%)",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-n");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-s-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							bottom: -halfHandle,
							left: "50%",
							transform: "translateX(-50%)",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-s");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-w-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							left: -halfHandle,
							top: "50%",
							transform: "translateY(-50%)",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-w");
						}}
					/>
					<div
						className="absolute bg-white border-2 border-blue-500 rounded-sm cursor-e-resize hover:bg-blue-100"
						style={{
							width: handleSize,
							height: handleSize,
							right: -halfHandle,
							top: "50%",
							transform: "translateY(-50%)",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							onMouseDown(e, factIndex, pageNumber, "resize-e");
						}}
					/>
				</>
			)}

			{/* Status indicator with confirm button */}
			{isPending && !isNew && (
				<div className="absolute -top-7 left-0 flex items-center gap-1">
					<div className="px-1.5 py-0.5 bg-yellow-500 text-white text-[10px] rounded font-medium">
						Modified
					</div>
					{onConfirm && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onConfirm();
							}}
							disabled={isSaving}
							className={`flex items-center justify-center w-5 h-5 rounded transition-all ${
								isSaving
									? "bg-green-400 cursor-wait"
									: "bg-green-500 hover:bg-green-600 hover:scale-110 cursor-pointer"
							} text-white shadow-md`}
							title="Confirm bbox change"
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
				</div>
			)}
			{isNew && (
				<div className="absolute -top-6 left-0 px-1.5 py-0.5 bg-green-500 text-white text-[10px] rounded font-medium">
					New
				</div>
			)}
		</div>
	);
}
