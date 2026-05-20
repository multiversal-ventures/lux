import { useState } from "react";
import type { TradeAccount } from "@multiversal-ventures/lux-core";
import styles from "./CreditSummary.module.css";

export interface TradeAccountsTableProps {
	accounts: TradeAccount[];
}

function fmtCurrency(n: number | undefined): string {
	if (n == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function PortfolioBadge({ type }: { type: string | undefined }) {
	if (!type) return <span>—</span>;
	const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
	const cls =
		normalized === "Revolving"
			? styles.badgePurple
			: normalized === "Installment"
				? styles.badgeBlue
				: normalized === "Mortgage"
					? styles.badgeGreen
					: normalized === "Open"
						? styles.badgeAmber
						: styles.badgeGray;
	return <span className={`${styles.badge} ${cls}`}>{type}</span>;
}

function StatusBadge({ status }: { status: string | undefined }) {
	if (!status) return <span>—</span>;
	const lower = status.toLowerCase();
	const cls =
		lower.includes("open") || lower.includes("current") || lower === "as agreed"
			? styles.badgeOpen
			: lower.includes("closed") || lower.includes("paid")
				? styles.badgeClosed
				: lower.includes("delinquent") || lower.includes("late") || lower.includes("collection")
					? styles.badgeLate
					: styles.badgeGray;
	return <span className={`${styles.badge} ${cls}`}>{status}</span>;
}

export function TradeAccountsTable({ accounts }: TradeAccountsTableProps) {
	const [collapsed, setCollapsed] = useState(false);

	if (accounts.length === 0) return null;

	return (
		<div className={styles.tableCard}>
			<button
				type="button"
				className={styles.tableHeader}
				onClick={() => setCollapsed(!collapsed)}
			>
				<div className={styles.tableHeaderLeft}>
					<span className={styles.tableTitle}>Trade Accounts (Tradelines)</span>
					<span className={styles.tableBadge}>{accounts.length}</span>
				</div>
				<svg
					className={styles.tableChevron}
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					{collapsed ? (
						<path d="M4 6l4 4 4-4" />
					) : (
						<path d="M4 10l4-4 4 4" />
					)}
				</svg>
			</button>

			{!collapsed && (
				<div className={styles.tableWrapper}>
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Company</th>
								<th>Type</th>
								<th className={styles.right}>Balance</th>
								<th className={styles.right}>Monthly Pmt</th>
								<th>Status</th>
								<th>Opened</th>
								<th className={styles.center}>30/60/90</th>
							</tr>
						</thead>
						<tbody>
							{accounts.map((a, idx) => (
								<tr key={idx}>
									<td className={styles.tdPrimary}>{a.company}</td>
									<td>
										<PortfolioBadge type={a.portfolio_type} />
									</td>
									<td className={styles.right}>{fmtCurrency(a.balance)}</td>
									<td className={`${styles.right} ${styles.tdBlue}`}>
										{fmtCurrency(a.monthly_payment_amount)}
									</td>
									<td>
										<StatusBadge status={a.account_status} />
									</td>
									<td>{a.date_opened ?? "—"}</td>
									<td className={styles.center}>
										{a.delinquencies_30 ?? "—"}/{a.delinquencies_60 ?? "—"}/{a.delinquencies_90 ?? "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
