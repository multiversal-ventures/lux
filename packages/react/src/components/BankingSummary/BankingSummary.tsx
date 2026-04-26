import type { BankingResponse } from "@fenero/lux-core";
import styles from "./BankingSummary.module.css";

export interface BankingSummaryProps {
	data: BankingResponse;
	className?: string;
}

function fmt(n: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

export function BankingSummary({ data, className }: BankingSummaryProps) {
	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			<div className={styles.totals}>
				<div>
					<div className={styles.totalLabel}>Gross Deposits</div>
					<div className={styles.totalValue}>{fmt(data.total_gross_deposits)}</div>
				</div>
				<div>
					<div className={styles.totalLabel}>Avg Monthly</div>
					<div className={styles.totalValue}>{fmt(data.total_average_monthly)}</div>
				</div>
				<div>
					<div className={styles.totalLabel}>Accounts</div>
					<div className={styles.totalValue}>{data.accounts.length}</div>
				</div>
			</div>

			{data.accounts.map((a) => (
				<div key={a.account_id ?? Math.random()} className={styles.account}>
					<div className={styles.accountHeader}>
						<span>Account {a.account_id ?? "—"}</span>
						<span>{a.months_covered != null ? `${a.months_covered} months` : ""}</span>
					</div>
					<div className={styles.accountStats}>
						<div>
							<div className={styles.totalLabel}>Gross Deposits</div>
							<div className={styles.totalValue}>{fmt(a.gross_deposits)}</div>
						</div>
						<div>
							<div className={styles.totalLabel}>Avg Monthly</div>
							<div className={styles.totalValue}>{fmt(a.average_monthly)}</div>
						</div>
					</div>
					{a.streams.map((s, i) => (
						<div key={i} className={styles.stream}>
							<span className={styles.classification}>
								{s.classification ?? "—"}
							</span>
							<span className={styles.streamPattern}>
								{s.description_pattern ?? "—"}
							</span>
							<span className={styles.streamFreq}>{s.frequency ?? ""}</span>
							<span className={styles.streamAmount}>
								{s.average_amount != null ? fmt(s.average_amount) : "—"}
							</span>
						</div>
					))}
				</div>
			))}
		</div>
	);
}
