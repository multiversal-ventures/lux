import type {
	ExtractionResponse,
	ExtractionSourceResponse,
} from "@fenero/lux-core";
import styles from "./ExtractionTable.module.css";

export interface ExtractionTableProps {
	extractions: ExtractionResponse[];
	activeExtractionId?: string | null;
	onExtractionClick?: (
		extraction: ExtractionResponse,
		source: ExtractionSourceResponse,
	) => void;
	groupBy?: "doc" | "field" | "none";
	className?: string;
}

function groupExtractions(
	extractions: ExtractionResponse[],
	groupBy: "doc" | "field" | "none",
): Array<{ label: string; items: ExtractionResponse[] }> {
	if (groupBy === "none") return [{ label: "Extractions", items: extractions }];

	const groups = new Map<string, ExtractionResponse[]>();
	for (const e of extractions) {
		const key = groupBy === "doc"
			? `${e.doc_type ?? "Unknown"} · ${e.doc_id.slice(0, 8)}`
			: e.field_name ?? "Unnamed field";
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(e);
	}
	return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function ExtractionTable({
	extractions,
	activeExtractionId,
	onExtractionClick,
	groupBy = "doc",
	className,
}: ExtractionTableProps) {
	const groups = groupExtractions(extractions, groupBy);

	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			{groups.map((g) => (
				<div key={g.label} className={styles.group}>
					<div className={styles.groupHeader}>{g.label}</div>
					{g.items.map((e) => {
						const pages = e.sources.map((s) => s.page_number).filter((p): p is number => p != null);
						const primarySource = e.sources[0];
						return (
							<button
								key={e.extraction_id}
								type="button"
								className={`${styles.row}${e.extraction_id === activeExtractionId ? ` ${styles.rowActive}` : ""}`}
								onClick={() => primarySource && onExtractionClick?.(e, primarySource)}
							>
								<span className={styles.field}>{e.field_name}</span>
								<span className={styles.value}>{e.value ?? "—"}</span>
								<span className={styles.confidence}>
									{e.confidence != null ? `${Math.round(e.confidence * 100)}%` : "—"}
								</span>
								<span className={styles.pageChips}>
									{pages.map((p, i) => (
										<span key={i} className={styles.pageChip}>P{p}</span>
									))}
								</span>
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}
