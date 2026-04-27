import type { DocumentResponse } from "@fenero/lux-core";
import styles from "./DocumentList.module.css";

export interface DocumentListProps {
	documents: DocumentResponse[];
	selectedDocId?: string | null;
	onSelect?: (docId: string) => void;
	className?: string;
}

function formatPages(pages: number[] | null | undefined): string {
	if (!pages || pages.length === 0) return "";
	const first = pages[0];
	const last = pages[pages.length - 1];
	return first === last ? `Page ${first}` : `Pages ${first}–${last}`;
}

function formatPeriod(start?: string | null, end?: string | null): string {
	if (!start && !end) return "";
	const s = start ? new Date(start).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : "";
	const e = end ? new Date(end).toLocaleDateString(undefined, { month: "short", year: "2-digit" }) : "";
	if (s && e) return `${s} – ${e}`;
	return s || e;
}

export function DocumentList({ documents, selectedDocId, onSelect, className }: DocumentListProps) {
	if (documents.length === 0) {
		return null;
	}
	const As = onSelect ? "button" : "div";
	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			{documents.map((d) => {
				const selected = d.doc_id === selectedDocId;
				return (
					<As
						key={d.doc_id}
						type={onSelect ? "button" : undefined}
						onClick={onSelect ? () => onSelect(d.doc_id) : undefined}
						className={`${styles.card}${selected ? ` ${styles.cardSelected}` : ""}`}
					>
						<span className={styles.icon} aria-hidden>📄</span>
						<div className={styles.body}>
							<div className={styles.filename}>
								{d.original_filename ?? "Unnamed document"}
							</div>
							<div className={styles.meta}>
								<span className={styles.badge}>{d.doc_type ?? "Unknown"}</span>
								<span>{formatPages(d.page_numbers)}</span>
								{(d.effective_period_start || d.effective_period_end) && (
									<span className={styles.period}>
										{formatPeriod(d.effective_period_start, d.effective_period_end)}
									</span>
								)}
							</div>
						</div>
					</As>
				);
			})}
		</div>
	);
}
