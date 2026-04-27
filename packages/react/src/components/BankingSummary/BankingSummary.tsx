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

			{data.accounts.map((a, i) => (
				<div
					key={a.account_id != null && a.account_id !== "" ? a.account_id : i}
					className={styles.account}
				>
					<div className={styles.accountHeader}>
						<span>
							{a.account_holder_name
								? `${a.account_holder_name} · ${a.account_id ?? "—"}`
								: `Account ${a.account_id ?? "—"}`}
						</span>
						<span>{a.months_covered != null ? `${a.months_covered} months` : ""}</span>
					</div>
					<div className={styles.accountStats}>
						<div>
							<div className={styles.totalLabel}>Gross Deposits</div>
							<div className={styles.totalValue}>{fmt(a.gross_deposits_aggressive)}</div>
						</div>
						<div>
							<div className={styles.totalLabel}>Avg Monthly</div>
							<div className={styles.totalValue}>{fmt(a.average_monthly_deposits)}</div>
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
