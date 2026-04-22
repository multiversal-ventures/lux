import { bboxToStyle } from "../../types";
import type { BoundingBoxOverlayProps } from "./types";

/**
 * Bounding box overlay component (view-only, clickable to edit)
 * @param isPrimary - If true, uses primary highlight style (orange), otherwise secondary (yellow)
 */
export function BoundingBoxOverlay({ bbox, isPrimary = true, onClick }: BoundingBoxOverlayProps) {
	// Use bboxToStyle helper to convert x1/y1/x2/y2 to CSS percentages
	const style = bboxToStyle(bbox);

	return (
		<div
			className={`absolute rounded transition-all duration-300 ${
				onClick
					? "cursor-pointer hover:shadow-[0_0_16px_rgba(251,146,60,0.6)]"
					: "pointer-events-none"
			} ${
				isPrimary
					? "border-2 border-orange-400 bg-orange-400/20 shadow-[0_0_12px_rgba(251,146,60,0.4)]"
					: "border border-yellow-400/60 bg-yellow-400/10"
			}`}
			style={style}
			onClick={(e) => {
				e.stopPropagation();
				onClick?.();
			}}
			title={onClick ? "Click to edit" : undefined}
		/>
	);
}
