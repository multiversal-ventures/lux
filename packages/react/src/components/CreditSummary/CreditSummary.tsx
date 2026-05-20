import { useState } from "react";
import type { CreditReportRegions, CreditCollection, CreditPublicRecord, CreditInquiry } from "@multiversal-ventures/lux-core";
import { CreditScoreDisplay } from "./CreditScoreDisplay.js";
import { TradeAccountsTable } from "./TradeAccountsTable.js";
import styles from "./CreditSummary.module.css";

export interface CreditSummaryProps {
	documents: Array<{
		doc_id: string;
		file_id: string | null;
		regions: CreditReportRegions;
	}>;
	isLoading?: boolean;
	onPullCredit?: () => void;
}

/** Parse "3/1/1" → [{days:30,count:3},{days:60,count:1},{days:90,count:1}] */
function parseDelinquencies(value: string): { label: string; count: number; color: string }[] {
	const parts = value.split("/").map(Number);
	const buckets = [
		{ label: "30 days", color: "#f59e0b" },
		{ label: "60 days", color: "#f97316" },
		{ label: "90+ days", color: "#ef4444" },
	];
	return buckets
		.map((b, i) => ({ ...b, count: parts[i] ?? 0 }))
		.filter((b) => b.count > 0);
}

function DelinquencyBadges({ value }: { value: string }) {
	const buckets = parseDelinquencies(value);
	if (buckets.length === 0) return null;
	return (
		<div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", alignItems: "center", paddingTop: "0.25rem" }}>
			<span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", color: "#94a3b8", letterSpacing: "0.05em" }}>
				Delinquencies (30/60/90+ days)
			</span>
			<div style={{ display: "flex", gap: "0.5rem" }}>
				{buckets.map((b) => (
					<span
						key={b.label}
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							fontSize: "0.75rem",
							fontWeight: 600,
							color: b.color,
						}}
					>
						<span
							style={{
								width: "0.5rem",
								height: "0.5rem",
								borderRadius: "50%",
								backgroundColor: b.color,
								display: "inline-block",
							}}
						/>
						{b.label}: {b.count}
					</span>
				))}
			</div>
		</div>
	);
}

function fmtCurrency(n: number | undefined): string {
	if (n == null) return "—";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function CollapsibleSection({
	title,
	count,
	variant,
	children,
}: {
	title: string;
	count: number;
	variant?: "red" | "amber";
	children: React.ReactNode;
}) {
	const [collapsed, setCollapsed] = useState(true);

	if (count === 0) return null;

	const cardCls = variant === "red"
		? `${styles.tableCard} ${styles.tableCardRed}`
		: variant === "amber"
			? `${styles.tableCard} ${styles.tableCardAmber}`
			: styles.tableCard;

	const badgeCls = variant === "red"
		? `${styles.tableBadge} ${styles.tableBadgeRed}`
		: variant === "amber"
			? `${styles.tableBadge} ${styles.tableBadgeAmber}`
			: styles.tableBadge;

	return (
		<div className={cardCls}>
			<button
				type="button"
				className={styles.tableHeader}
				onClick={() => setCollapsed(!collapsed)}
			>
				<div className={styles.tableHeaderLeft}>
					<span className={styles.tableTitle}>{title}</span>
					<span className={badgeCls}>{count}</span>
				</div>
				<svg
					className={styles.tableChevron}
					viewBox="0 0 16 16"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					{collapsed ? <path d="M4 6l4 4 4-4" /> : <path d="M4 10l4-4 4 4" />}
				</svg>
			</button>
			{!collapsed && (
				<div className={styles.tableWrapper}>{children}</div>
			)}
		</div>
	);
}

function CollectionsTable({ collections }: { collections: CreditCollection[] }) {
	return (
		<CollapsibleSection title="Collections" count={collections.length} variant="red">
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Agency</th>
						<th>Original Creditor</th>
						<th className={styles.right}>Balance</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{collections.map((c, idx) => (
						<tr key={idx}>
							<td className={styles.tdPrimary}>{c.collection_agency}</td>
							<td>{c.original_creditor ?? "—"}</td>
							<td className={styles.right} style={{ color: "#dc2626", fontWeight: 500 }}>
								{fmtCurrency(c.balance)}
							</td>
							<td>{c.status ?? "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</CollapsibleSection>
	);
}

function PublicRecordsTable({ records }: { records: CreditPublicRecord[] }) {
	return (
		<CollapsibleSection title="Public Records" count={records.length} variant="amber">
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Type</th>
						<th>Court</th>
						<th className={styles.right}>Amount</th>
						<th>Filed</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{records.map((r, idx) => (
						<tr key={idx}>
							<td className={styles.tdPrimary}>{r.record_type}</td>
							<td>{r.court ?? "—"}</td>
							<td className={styles.right}>{fmtCurrency(r.amount)}</td>
							<td>{r.date_filed ?? "—"}</td>
							<td>{r.status ?? "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</CollapsibleSection>
	);
}

function InquiriesTable({ inquiries }: { inquiries: CreditInquiry[] }) {
	return (
		<CollapsibleSection title="Inquiries" count={inquiries.length}>
			<table className={styles.table}>
				<thead>
					<tr>
						<th>Company</th>
						<th>Date</th>
						<th>Industry</th>
					</tr>
				</thead>
				<tbody>
					{inquiries.map((inq, idx) => (
						<tr key={idx}>
							<td className={styles.tdPrimary}>{inq.company}</td>
							<td>{inq.date}</td>
							<td>{inq.industry ?? "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</CollapsibleSection>
	);
}

export function CreditSummary({ documents, isLoading, onPullCredit }: CreditSummaryProps) {
	if (isLoading) {
		return (
			<div className={styles.root}>
				{[1, 2].map((i) => (
					<div key={i} className={styles.skeletonBlock}>
						<div className={`${styles.skeleton}`} style={{ height: 16, width: "40%" }} />
						<div className={`${styles.skeleton}`} style={{ height: 12, width: "60%" }} />
						<div className={`${styles.skeleton}`} style={{ height: 12, width: "50%" }} />
					</div>
				))}
			</div>
		);
	}

	if (documents.length === 0) {
		return (
			<div className={styles.emptyState}>
				<div className={styles.emptyInner}>
					<p className={styles.emptyTitle}>No Credit Reports Found</p>
					<p className={styles.emptyBody}>
						Upload a credit report PDF or pull credit to populate this section.
					</p>
					{onPullCredit && (
						<button type="button" className={styles.pullButton} onClick={onPullCredit}>
							Pull Credit
						</button>
					)}
				</div>
			</div>
		);
	}

	const allCollections: CreditCollection[] = [];
	const allPublicRecords: CreditPublicRecord[] = [];
	const allInquiries: CreditInquiry[] = [];

	for (const doc of documents) {
		if (doc.regions.collections) allCollections.push(...(doc.regions.collections as CreditCollection[]));
		if (doc.regions.public_records) allPublicRecords.push(...(doc.regions.public_records as CreditPublicRecord[]));
		if (doc.regions.inquiries) allInquiries.push(...(doc.regions.inquiries as CreditInquiry[]));
	}

	return (
		<div className={styles.root}>
			{documents.map((doc, idx) => {
				const { header, personal_info, credit_scores, report_summary, trade_accounts } = doc.regions;

				return (
					<div key={doc.doc_id} className={styles.docSection}>
						{documents.length > 1 && (
							<div className={styles.docDivider}>
								Report {idx + 1} of {documents.length}
							</div>
						)}

						{/* Header / borrower card */}
						{(personal_info || header) && (
							<div className={styles.headerCard}>
								<div>
									{personal_info?.borrower_name && (
										<p className={styles.borrowerName}>{personal_info.borrower_name}</p>
									)}
									{personal_info?.ssn && (
										<p className={styles.borrowerMeta}>SSN: {personal_info.ssn}</p>
									)}
									{personal_info?.date_of_birth && (
										<p className={styles.borrowerMeta}>DOB: {personal_info.date_of_birth}</p>
									)}
									{personal_info?.current_address && (
										<p className={styles.borrowerMeta}>{personal_info.current_address}</p>
									)}
								</div>
								{(header?.report_type || header?.bureau || header?.date_pulled) && (
									<div className={styles.headerRight}>
										{header.report_type && (
											<div className={styles.reportType}>{header.report_type}</div>
										)}
										{header.bureau && (
											<div className={styles.reportMeta}>{header.bureau}</div>
										)}
										{header.date_pulled && (
											<div className={styles.reportMeta}>Pulled: {header.date_pulled}</div>
										)}
									</div>
								)}
							</div>
						)}

						{/* Scores */}
						{credit_scores && credit_scores.length > 0 && (
							<CreditScoreDisplay scores={credit_scores} />
						)}

						{/* Report summary stats */}
						{report_summary && (
							<div className={styles.summaryCard}>
								<h3 className={styles.cardTitle}>Report Summary</h3>
								<div className={styles.statsGrid}>
									<div className={styles.statItem}>
										<div className={styles.statLabel}>Accounts</div>
										<div className={styles.statValue}>{report_summary.total_accounts ?? "—"}</div>
									</div>
									<div className={styles.statItem}>
										<div className={styles.statLabel}>Total Balance</div>
										<div className={styles.statValue}>{fmtCurrency(report_summary.total_balance)}</div>
									</div>
									<div className={styles.statItem}>
										<div className={styles.statLabel}>Monthly Pmts</div>
										<div className={`${styles.statValue} ${styles.tdBlue}`}>
											{fmtCurrency(report_summary.total_monthly_payments)}
										</div>
									</div>
									<div className={styles.statItem}>
										<div className={styles.statLabel}>Inquiries</div>
										<div className={styles.statValue}>{report_summary.inquiries_count ?? "—"}</div>
									</div>
									<div className={styles.statItem}>
										<div className={styles.statLabel}>Collections</div>
										<div
											className={`${styles.statValue} ${(report_summary.collections_count ?? 0) > 0 ? styles.statAlert : ""}`}
										>
											{report_summary.collections_count ?? 0}
										</div>
									</div>
								<div className={styles.statItem}>
									<div className={styles.statLabel}>Public Records</div>
									<div
										className={`${styles.statValue} ${(report_summary.public_records_count ?? 0) > 0 ? styles.statWarn : ""}`}
									>
										{report_summary.public_records_count ?? 0}
									</div>
								</div>
							{report_summary.delinquencies_30_60_90 && report_summary.delinquencies_30_60_90 !== "0/0/0" && (
								<DelinquencyBadges value={report_summary.delinquencies_30_60_90} />
							)}
							</div>
						</div>
					)}

						{/* Trade accounts for this doc */}
						{trade_accounts && trade_accounts.length > 0 && (
							<TradeAccountsTable accounts={trade_accounts} />
						)}
					</div>
				);
			})}

			{/* Aggregated collections, public records, inquiries */}
			<CollectionsTable collections={allCollections} />
			<PublicRecordsTable records={allPublicRecords} />
			<InquiriesTable inquiries={allInquiries} />
		</div>
	);
}
