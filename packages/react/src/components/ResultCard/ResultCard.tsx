import type { QualifyResult } from "@multiversal-ventures/lux-core";
import styles from "./ResultCard.module.css";

export interface ResultCardProps {
	result: QualifyResult;
	className?: string;
}

function formatMoney(n: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

export function ResultCard({ result, className }: ResultCardProps) {
	const qualifies = result.total_monthly > 0;
	const isCustom = result.product === "custom";
	const rootClass = `${styles.root} ${qualifies ? styles.rootQualifies : styles.rootDenies}${className ? ` ${className}` : ""}`;

	return (
		<div className={rootClass}>
			<div className={styles.header}>
				<span className={`${styles.outcome} ${qualifies ? styles.outcomePass : styles.outcomeFail}`}>
					{qualifies ? "QUALIFIES" : "DOES NOT QUALIFY"}
				</span>
				<span className={styles.productLabel}>
					{isCustom ? "Custom spec" : result.product.replace(/_/g, " ")}
				</span>
			</div>
			<div className={styles.grid}>
				<div>
					<div className={styles.label}>Monthly Income</div>
					<div className={styles.value}>{formatMoney(result.total_monthly)}</div>
				</div>
				<div>
					<div className={styles.label}>Specs Run</div>
					<div className={styles.value}>{result.specs_run}</div>
				</div>
			</div>
		</div>
	);
}
