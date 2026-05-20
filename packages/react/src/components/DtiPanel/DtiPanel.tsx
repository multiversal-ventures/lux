import type { DtiData } from "@multiversal-ventures/lux-core";
import styles from "./DtiPanel.module.css";

export interface DtiPanelProps {
	dti?: DtiData;
	scenarioName?: string;
	isLoading?: boolean;
}

function fmtPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function fmtCurrency(n: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

export function DtiPanel({ dti, scenarioName, isLoading }: DtiPanelProps) {
	if (isLoading) {
		return (
			<div className={styles.root}>
				<div className={styles.grid}>
					{[1, 2, 3].map((i) => (
						<div key={i} className={styles.skeletonCard}>
							<div className={`${styles.skeleton}`} style={{ height: 10, width: "60%" }} />
							<div className={`${styles.skeleton}`} style={{ height: 28, width: "40%" }} />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!dti) {
		return (
			<div className={styles.emptyState}>
				<p className={styles.emptyText}>No DTI data available.</p>
			</div>
		);
	}

	return (
		<div className={styles.root}>
			{scenarioName && (
				<div className={styles.header}>
					<h3 className={styles.title}>DTI</h3>
					<span className={styles.scenarioLabel}>{scenarioName}</span>
				</div>
			)}
			<div className={styles.grid}>
				<div className={styles.card}>
					<div className={styles.cardLabel}>Front-end DTI</div>
					<div className={styles.cardValue}>
						{dti.front_end_dti != null ? fmtPercent(dti.front_end_dti) : "—"}
					</div>
					<div className={styles.cardSub}>Housing / Income</div>
				</div>
				<div className={styles.card}>
					<div className={styles.cardLabel}>Back-end DTI</div>
					<div className={styles.cardValue}>
						{dti.back_end_dti != null ? fmtPercent(dti.back_end_dti) : "—"}
					</div>
					<div className={styles.cardSub}>All Obligations / Income</div>
				</div>
				<div className={styles.card}>
					<div className={styles.cardLabel}>Total Monthly Debt</div>
					<div className={`${styles.cardValue} ${styles.cardValueMuted}`}>
						{dti.total_monthly_debt != null ? fmtCurrency(dti.total_monthly_debt) : "—"}
					</div>
					<div className={styles.cardSub}>Credit obligations /mo</div>
				</div>
			</div>
		</div>
	);
}
