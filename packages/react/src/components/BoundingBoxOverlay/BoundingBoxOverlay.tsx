import styles from "./BoundingBoxOverlay.module.css";

export interface BboxNormalized {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BboxHighlight {
	bbox: BboxNormalized;
	id: string;
	label?: string;
	variant?: "default" | "active";
}

export interface BoundingBoxOverlayProps {
	bboxes: BboxHighlight[];
	imageNaturalSize: { width: number; height: number };
	renderedSize?: { width: number; height: number };
	onHighlightClick?: (id: string) => void;
	activeHighlightId?: string | null;
	className?: string;
}

export function BoundingBoxOverlay({
	bboxes,
	// imageNaturalSize and renderedSize are in the prop surface for future
	// pixel-accurate offset support; removing them would be a breaking API change.
	imageNaturalSize: _imageNaturalSize,
	renderedSize: _renderedSize,
	onHighlightClick,
	activeHighlightId,
	className,
}: BoundingBoxOverlayProps) {
	// Normalized bbox values are 0-1 fractions. We emit percentage-based
	// positions so the overlay scales with whatever the <img> is rendered at.

	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			{bboxes.map((b) => {
				const isActive =
					activeHighlightId === b.id || b.variant === "active";
				const style = {
					left: `${b.bbox.x * 100}%`,
					top: `${b.bbox.y * 100}%`,
					width: `${b.bbox.width * 100}%`,
					height: `${b.bbox.height * 100}%`,
				};
				return (
					<div
						key={b.id}
						className={`${styles.box}${isActive ? ` ${styles.boxActive}` : ""}`}
						style={style}
						onClick={() => onHighlightClick?.(b.id)}
						role="button"
						tabIndex={0}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") onHighlightClick?.(b.id);
						}}
					>
						{b.label && <span className={styles.label}>{b.label}</span>}
					</div>
				);
			})}
		</div>
	);
}
