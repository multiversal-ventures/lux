import { useState } from "react";
import { useOperatorClient } from "../../providers/OperatorProvider.js";
import { AuthedImage } from "../AuthedImage/index.js";
import { BoundingBoxOverlay, type BboxHighlight } from "../BoundingBoxOverlay/index.js";
import styles from "./DocumentPageImage.module.css";

export interface DocumentPageImageProps {
	caseId: string;
	fileId: string;
	pageNumber: number;
	highlights?: BboxHighlight[];
	activeHighlightId?: string | null;
	onHighlightClick?: (id: string) => void;
	className?: string;
}

export function DocumentPageImage({
	caseId,
	fileId,
	pageNumber,
	highlights = [],
	activeHighlightId,
	onHighlightClick,
	className,
}: DocumentPageImageProps) {
	const client = useOperatorClient();
	const url = client.pagePngUrl(caseId, fileId, pageNumber);
	const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			<AuthedImage
				url={url}
				alt={`Page ${pageNumber}`}
				onLoad={(sz) => setNaturalSize({ width: sz.naturalWidth, height: sz.naturalHeight })}
			/>
			{naturalSize && highlights.length > 0 && (
				<BoundingBoxOverlay
					bboxes={highlights}
					imageNaturalSize={naturalSize}
					activeHighlightId={activeHighlightId}
					onHighlightClick={onHighlightClick}
				/>
			)}
		</div>
	);
}
