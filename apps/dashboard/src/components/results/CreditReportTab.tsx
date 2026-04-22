/**
 * CreditReportTab - Display extracted credit report data from PDFs
 *
 * Shows credit report data extracted via the AEU pipeline including:
 * - Borrower information
 * - Credit scores
 * - Trade accounts (tradelines) for DTI calculation
 * - Collections, public records, inquiries
 *
 * This is different from CreditTab which shows credit verification API data.
 */

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
	AlertCircle,
	ChevronDown,
	ChevronUp,
	CreditCard,
	ShieldCheck,
	Upload,
	Loader2,
	FileText,
	X,
} from "lucide-react";
import {
	useAdaptiveRefetchInterval,
	useCaseQueryInvalidation,
	useEffectiveCreditReportExtraction,
	useCaseStatus,
	useWorkflowStatus,
	useCreditPullStatus,
} from "../../hooks/useCaseQueries";
import { cancelWorkflows } from "../../hooks/useApi";
import type {
	CreditReportExtraction,
	CreditReportTradeAccount,
	CreditReportCollection,
	CreditReportPublicRecord,
	CreditReportInquiry,
} from "../../hooks/useApi";
import { PullCreditModal } from "./PullCreditModal";
import { UploadModal } from "../shared";
import { api } from "../../lib/api";

/**
 * Upload state machine for tracking extraction progress.
 * - idle: No upload in progress
 * - extracting: Extraction workflow running
 */
type UploadPhase = "idle" | "extracting";

interface UploadState {
	phase: UploadPhase;
	fileNames: string[];
}

interface CreditReportTabProps {
	caseId: string;
}

/** Skeleton pulse animation component */
function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/** Format currency amount */
function formatCurrency(amount: number | null | undefined): string {
	if (amount == null) return "-";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

/** Loading skeleton for the entire tab */
function CreditReportSkeleton() {
	return (
		<div className="p-6 space-y-6">
			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<div className="flex items-center justify-between mb-4">
					<Skeleton className="h-6 w-48" />
				</div>
				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="bg-slate-50 rounded-lg p-4">
							<Skeleton className="h-4 w-24 mb-2" />
							<Skeleton className="h-8 w-16" />
						</div>
					))}
				</div>
			</div>

			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<Skeleton className="h-6 w-40 mb-4" />
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-20 ml-auto" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** Empty state when no credit reports found */
function EmptyState({
	onPullCredit,
	onUpload,
	isExtracting,
	extractionStatus,
	extractionProgress,
	fileNames,
	onCancelExtraction,
	isCanceling,
}: {
	onPullCredit: () => void;
	onUpload: () => void;
	isExtracting: boolean;
	extractionStatus?: string;
	extractionProgress?: number;
	fileNames: string[];
	onCancelExtraction: () => void;
	isCanceling: boolean;
}) {
	if (isExtracting) {
		return (
			<div className="p-6">
				<div className="bg-white rounded-xl border border-slate-200 p-6">
					{/* Header with status and cancel button */}
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Loader2 className="w-4 h-4 animate-spin text-amber-600" />
							<span className="text-sm font-medium text-amber-700">
								{extractionStatus || "Extracting credit report..."}
							</span>
						</div>
						<button
							onClick={onCancelExtraction}
							disabled={isCanceling}
							className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
							title="Cancel extraction"
						>
							<X className="w-3.5 h-3.5" />
							{isCanceling ? "Canceling..." : "Cancel"}
						</button>
					</div>

					{/* Progress bar */}
					{extractionProgress !== undefined && (
						<div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-4">
							<div
								className="h-full bg-amber-500 rounded-full transition-all duration-300"
								style={{ width: `${extractionProgress}%` }}
							/>
						</div>
					)}

					{/* Show uploaded file names */}
					<div className="space-y-2">
						{fileNames.map((filename, idx) => (
							<div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
								<FileText className="w-5 h-5 text-amber-500 animate-pulse" />
								<div className="flex-1 min-w-0">
									<span className="text-sm font-medium text-slate-700 truncate block">
										{filename}
									</span>
									<span className="text-xs text-slate-500">Extracting credit data...</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6">
			<div className="bg-white rounded-xl border border-slate-200 h-72 flex items-center justify-center">
				<div className="text-center max-w-sm px-4">
					<div className="w-9 h-9 mx-auto mb-4 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
						<ShieldCheck className="w-4 h-4 text-slate-500" />
					</div>
					<h2 className="text-sm font-semibold text-slate-700">Credit Data Required</h2>
					<p className="text-xs text-slate-500 mt-2">
						Credit data is required to populate report scores, tradelines, balances, and monthly
						liabilities.
					</p>
					<div className="mt-4 flex items-center justify-center gap-2">
						<button
							onClick={onUpload}
							className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 bg-orange-600 text-white hover:bg-orange-700 transition-colors"
						>
							<Upload className="h-3 w-3" />
							Upload Credit Report
						</button>
						<button
							onClick={onPullCredit}
							className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
						>
							<CreditCard className="h-3 w-3" />
							Pull Credit
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

/** Summary card with totals */
function SummaryCard({
	reportCount,
	tradeAccountCount,
	totalMonthlyPayments,
	totalBalance,
}: {
	reportCount: number;
	tradeAccountCount: number;
	totalMonthlyPayments: number;
	totalBalance: number;
}) {
	return (
		<div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
			<h2 className="text-lg font-semibold text-blue-900 mb-4">Credit Report Extraction</h2>
			<div className="grid grid-cols-4 gap-4">
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-blue-700 mb-1">Reports</div>
					<div className="text-2xl font-bold text-blue-900">{reportCount}</div>
				</div>
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-blue-700 mb-1">Trade Accounts</div>
					<div className="text-2xl font-bold text-blue-900">{tradeAccountCount}</div>
				</div>
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-blue-700 mb-1">Total Monthly Payments</div>
					<div className="text-2xl font-bold text-blue-900">
						{formatCurrency(totalMonthlyPayments)}
					</div>
				</div>
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-blue-700 mb-1">Total Balance</div>
					<div className="text-2xl font-bold text-blue-900">{formatCurrency(totalBalance)}</div>
				</div>
			</div>
		</div>
	);
}

/** Credit score display */
function ScoreDisplay({ scores }: { scores: CreditReportExtraction["credit_scores"] }) {
	if (scores.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<h3 className="text-lg font-semibold text-slate-800 mb-4">Credit Scores</h3>
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{scores.map((score, idx) => (
					<div key={idx} className="bg-slate-50 rounded-lg p-4 text-center">
						<div className="text-sm text-slate-500 mb-1">{score.score_model}</div>
						{score.score ? (
							<div
								className={`text-3xl font-bold ${
									score.score >= 700
										? "text-emerald-600"
										: score.score >= 620
											? "text-amber-600"
											: "text-red-600"
								}`}
							>
								{score.score}
							</div>
						) : (
							<div className="text-sm text-slate-400">{score.no_score_reason || "No score"}</div>
						)}
						{score.reason_codes && (
							<div className="mt-2 text-xs text-slate-500 truncate" title={score.reason_codes}>
								{score.reason_codes}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

/** Portfolio type badge */
function PortfolioBadge({ type }: { type: string | null }) {
	if (!type) return <span className="text-slate-400">-</span>;

	const colors: Record<string, string> = {
		Revolving: "bg-purple-100 text-purple-700",
		Installment: "bg-blue-100 text-blue-700",
		Mortgage: "bg-emerald-100 text-emerald-700",
		Open: "bg-amber-100 text-amber-700",
	};

	const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
	const colorClass = colors[normalized] || "bg-slate-100 text-slate-600";

	return <span className={`px-2 py-0.5 text-xs rounded-full ${colorClass}`}>{type}</span>;
}

/** Account status badge */
function StatusBadge({ status }: { status: string | null }) {
	if (!status) return <span className="text-slate-400">-</span>;

	const lower = status.toLowerCase();
	let colorClass = "bg-slate-100 text-slate-600";

	if (lower.includes("open") || lower.includes("current") || lower === "as agreed") {
		colorClass = "bg-emerald-100 text-emerald-700";
	} else if (lower.includes("closed") || lower.includes("paid")) {
		colorClass = "bg-blue-100 text-blue-700";
	} else if (
		lower.includes("delinquent") ||
		lower.includes("late") ||
		lower.includes("collection")
	) {
		colorClass = "bg-red-100 text-red-700";
	}

	return <span className={`px-2 py-0.5 text-xs rounded-full ${colorClass}`}>{status}</span>;
}

/** Trade accounts table */
function TradeAccountsTable({ accounts }: { accounts: CreditReportTradeAccount[] }) {
	const [collapsed, setCollapsed] = useState(false);

	if (accounts.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="flex items-center gap-2">
					<h3 className="text-lg font-semibold text-slate-800">Trade Accounts (Tradelines)</h3>
					<span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
						{accounts.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="w-5 h-5 text-slate-400" />
				) : (
					<ChevronUp className="w-5 h-5 text-slate-400" />
				)}
			</button>

			{!collapsed && (
				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<th className="text-left py-3 px-4 font-medium text-slate-600">Company</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
								<th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
								<th className="text-right py-3 px-4 font-medium text-slate-600">Limit</th>
								<th className="text-right py-3 px-4 font-medium text-slate-600">Monthly Payment</th>
								<th className="text-center py-3 px-4 font-medium text-slate-600">30/60/90</th>
							</tr>
						</thead>
						<tbody>
							{accounts.map((account, idx) => (
								<tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
									<td className="py-3 px-4 font-medium text-slate-900">{account.company}</td>
									<td className="py-3 px-4">
										<PortfolioBadge type={account.portfolio_type} />
									</td>
									<td className="py-3 px-4">
										<StatusBadge status={account.account_status} />
									</td>
									<td className="py-3 px-4 text-right text-slate-700">
										{formatCurrency(account.balance)}
									</td>
									<td className="py-3 px-4 text-right text-slate-700">
										{formatCurrency(account.credit_limit)}
									</td>
									<td className="py-3 px-4 text-right font-medium text-blue-700">
										{formatCurrency(account.monthly_payment_amount)}
									</td>
									<td className="py-3 px-4 text-center text-slate-600">
										{account.delinquencies_30 ?? "-"}/{account.delinquencies_60 ?? "-"}/
										{account.delinquencies_90 ?? "-"}
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

/** Collections table */
function CollectionsTable({ collections }: { collections: CreditReportCollection[] }) {
	const [collapsed, setCollapsed] = useState(true);

	if (collections.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-red-200 p-6">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="flex items-center gap-2">
					<AlertCircle className="w-5 h-5 text-red-500" />
					<h3 className="text-lg font-semibold text-slate-800">Collections</h3>
					<span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
						{collections.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="w-5 h-5 text-slate-400" />
				) : (
					<ChevronUp className="w-5 h-5 text-slate-400" />
				)}
			</button>

			{!collapsed && (
				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<th className="text-left py-3 px-4 font-medium text-slate-600">Agency</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">
									Original Creditor
								</th>
								<th className="text-right py-3 px-4 font-medium text-slate-600">Balance</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
							</tr>
						</thead>
						<tbody>
							{collections.map((collection, idx) => (
								<tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
									<td className="py-3 px-4 font-medium text-slate-900">
										{collection.collection_agency}
									</td>
									<td className="py-3 px-4 text-slate-700">
										{collection.original_creditor || "-"}
									</td>
									<td className="py-3 px-4 text-right text-red-600 font-medium">
										{formatCurrency(collection.balance)}
									</td>
									<td className="py-3 px-4">
										<StatusBadge status={collection.status} />
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

/** Public records table */
function PublicRecordsTable({ records }: { records: CreditReportPublicRecord[] }) {
	const [collapsed, setCollapsed] = useState(true);

	if (records.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-amber-200 p-6">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="flex items-center gap-2">
					<AlertCircle className="w-5 h-5 text-amber-500" />
					<h3 className="text-lg font-semibold text-slate-800">Public Records</h3>
					<span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
						{records.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="w-5 h-5 text-slate-400" />
				) : (
					<ChevronUp className="w-5 h-5 text-slate-400" />
				)}
			</button>

			{!collapsed && (
				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<th className="text-left py-3 px-4 font-medium text-slate-600">Type</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Court</th>
								<th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Filed</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Status</th>
							</tr>
						</thead>
						<tbody>
							{records.map((record, idx) => (
								<tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
									<td className="py-3 px-4 font-medium text-slate-900">{record.record_type}</td>
									<td className="py-3 px-4 text-slate-700">{record.court || "-"}</td>
									<td className="py-3 px-4 text-right text-slate-700">
										{formatCurrency(record.amount)}
									</td>
									<td className="py-3 px-4 text-slate-600">{record.date_filed || "-"}</td>
									<td className="py-3 px-4">
										<StatusBadge status={record.status} />
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

/** Inquiries table */
function InquiriesTable({ inquiries }: { inquiries: CreditReportInquiry[] }) {
	const [collapsed, setCollapsed] = useState(true);

	if (inquiries.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="flex items-center gap-2">
					<h3 className="text-lg font-semibold text-slate-800">Inquiries</h3>
					<span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
						{inquiries.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="w-5 h-5 text-slate-400" />
				) : (
					<ChevronUp className="w-5 h-5 text-slate-400" />
				)}
			</button>

			{!collapsed && (
				<div className="mt-4 overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<th className="text-left py-3 px-4 font-medium text-slate-600">Company</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Industry</th>
							</tr>
						</thead>
						<tbody>
							{inquiries.map((inquiry, idx) => (
								<tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
									<td className="py-3 px-4 font-medium text-slate-900">{inquiry.company}</td>
									<td className="py-3 px-4 text-slate-600">{inquiry.date}</td>
									<td className="py-3 px-4 text-slate-600">{inquiry.industry || "-"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

/** Borrower info card */
function BorrowerInfoCard({ report }: { report: CreditReportExtraction }) {
	const { borrower_info, report_type, date_pulled, bureau } = report;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<div className="flex items-start justify-between">
				<div>
					<h3 className="text-lg font-semibold text-slate-800">
						{borrower_info.borrower_name || "Unknown Borrower"}
					</h3>
					{borrower_info.ssn && (
						<div className="text-sm text-slate-500 mt-1">SSN: {borrower_info.ssn}</div>
					)}
					{borrower_info.date_of_birth && (
						<div className="text-sm text-slate-500">DOB: {borrower_info.date_of_birth}</div>
					)}
					{borrower_info.current_address && (
						<div className="text-sm text-slate-500 mt-2">{borrower_info.current_address}</div>
					)}
				</div>
				<div className="text-right">
					{report_type && <div className="text-sm font-medium text-slate-700">{report_type}</div>}
					{bureau && <div className="text-sm text-slate-500">{bureau}</div>}
					{date_pulled && <div className="text-sm text-slate-500">Pulled: {date_pulled}</div>}
				</div>
			</div>
		</div>
	);
}

/** Report summary stats - shows extracted summary fields including delinquencies */
function ReportSummaryStats({ report }: { report: CreditReportExtraction }) {
	const { report_summary } = report;

	// Parse delinquencies from the "3/0/0" format
	const parseDelinquencies = (value: string | null | undefined) => {
		if (!value) return { d30: 0, d60: 0, d90: 0 };
		const parts = value.split("/").map((n) => parseInt(n) || 0);
		return { d30: parts[0] || 0, d60: parts[1] || 0, d90: parts[2] || 0 };
	};

	const delinquencies = parseDelinquencies(report_summary.delinquencies_30_60_90);
	const hasDelinquencies = delinquencies.d30 > 0 || delinquencies.d60 > 0 || delinquencies.d90 > 0;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<h3 className="text-lg font-semibold text-slate-800 mb-4">Report Summary</h3>
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
				<div className="bg-slate-50 rounded-lg p-3">
					<div className="text-xs text-slate-500 uppercase">Total Accounts</div>
					<div className="text-xl font-bold text-slate-800 mt-1">
						{report_summary.total_accounts ?? "-"}
					</div>
				</div>
				<div className="bg-slate-50 rounded-lg p-3">
					<div className="text-xs text-slate-500 uppercase">Total Balance</div>
					<div className="text-xl font-bold text-slate-800 mt-1">
						{formatCurrency(report_summary.total_balance)}
					</div>
				</div>
				<div className="bg-slate-50 rounded-lg p-3">
					<div className="text-xs text-slate-500 uppercase">Monthly Payments</div>
					<div className="text-xl font-bold text-blue-700 mt-1">
						{formatCurrency(report_summary.total_monthly_payments)}
					</div>
				</div>
				<div className="bg-slate-50 rounded-lg p-3">
					<div className="text-xs text-slate-500 uppercase">Inquiries</div>
					<div className="text-xl font-bold text-slate-800 mt-1">
						{report_summary.inquiries_count ?? "-"}
					</div>
				</div>
				<div
					className={`rounded-lg p-3 ${report_summary.collections_count ? "bg-red-50" : "bg-slate-50"}`}
				>
					<div className="text-xs text-slate-500 uppercase">Collections</div>
					<div
						className={`text-xl font-bold mt-1 ${report_summary.collections_count ? "text-red-600" : "text-slate-800"}`}
					>
						{report_summary.collections_count ?? 0}
					</div>
				</div>
				<div
					className={`rounded-lg p-3 ${report_summary.public_records_count ? "bg-amber-50" : "bg-slate-50"}`}
				>
					<div className="text-xs text-slate-500 uppercase">Public Records</div>
					<div
						className={`text-xl font-bold mt-1 ${report_summary.public_records_count ? "text-amber-600" : "text-slate-800"}`}
					>
						{report_summary.public_records_count ?? 0}
					</div>
				</div>
			</div>

			{/* Delinquency breakdown */}
			{report_summary.delinquencies_30_60_90 && (
				<div className="mt-4 pt-4 border-t border-slate-100">
					<div className="flex items-center gap-2 mb-3">
						<h4 className="text-sm font-medium text-slate-700">Delinquencies (30/60/90+ days)</h4>
						{hasDelinquencies && <AlertCircle className="w-4 h-4 text-amber-500" />}
					</div>
					<div className="flex gap-4">
						<div
							className={`flex items-center gap-2 px-3 py-2 rounded-lg ${delinquencies.d30 > 0 ? "bg-amber-50" : "bg-slate-50"}`}
						>
							<div
								className={`w-3 h-3 rounded-full ${delinquencies.d30 > 0 ? "bg-amber-500" : "bg-green-500"}`}
							/>
							<span className="text-sm text-slate-600">30 days:</span>
							<span
								className={`font-semibold ${delinquencies.d30 > 0 ? "text-amber-700" : "text-slate-700"}`}
							>
								{delinquencies.d30}
							</span>
						</div>
						<div
							className={`flex items-center gap-2 px-3 py-2 rounded-lg ${delinquencies.d60 > 0 ? "bg-orange-50" : "bg-slate-50"}`}
						>
							<div
								className={`w-3 h-3 rounded-full ${delinquencies.d60 > 0 ? "bg-orange-500" : "bg-green-500"}`}
							/>
							<span className="text-sm text-slate-600">60 days:</span>
							<span
								className={`font-semibold ${delinquencies.d60 > 0 ? "text-orange-700" : "text-slate-700"}`}
							>
								{delinquencies.d60}
							</span>
						</div>
						<div
							className={`flex items-center gap-2 px-3 py-2 rounded-lg ${delinquencies.d90 > 0 ? "bg-red-50" : "bg-slate-50"}`}
						>
							<div
								className={`w-3 h-3 rounded-full ${delinquencies.d90 > 0 ? "bg-red-500" : "bg-green-500"}`}
							/>
							<span className="text-sm text-slate-600">90+ days:</span>
							<span
								className={`font-semibold ${delinquencies.d90 > 0 ? "text-red-700" : "text-slate-700"}`}
							>
								{delinquencies.d90}
							</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export function CreditReportTab({ caseId }: CreditReportTabProps) {
	const adaptiveRefetchInterval = useAdaptiveRefetchInterval();
	const { invalidateAll, invalidateStatus, invalidateWorkflows } = useCaseQueryInvalidation();
	const { data: summary, isLoading } = useEffectiveCreditReportExtraction(caseId);
	const [showPullCreditModal, setShowPullCreditModal] = useState(false);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [creditPullWorkflowId, setCreditPullWorkflowId] = useState<string | null>(null);

	// Upload state machine
	const [uploadState, setUploadState] = useState<UploadState>({
		phase: "idle",
		fileNames: [],
	});

	const isExtracting = uploadState.phase === "extracting";

	// Fetch case status for progress info (poll faster when extracting)
	const { data: caseStatus } = useCaseStatus(caseId, {
		refetchInterval: isExtracting || !!creditPullWorkflowId ? 2000 : adaptiveRefetchInterval,
	});

	// Check for running add-files workflows
	const { data: workflowStatus } = useWorkflowStatus(caseId, {
		enabled: true,
		refetchInterval: isExtracting || !!creditPullWorkflowId ? 2000 : adaptiveRefetchInterval,
	});

	const addFilesWorkflowRunning = useMemo(() => {
		if (!workflowStatus?.workflows) return false;
		return workflowStatus.workflows.some(
			(wf) => wf.workflow_type === "add_files" && wf.status === "running",
		);
	}, [workflowStatus]);

	// Track workflow completion
	const prevAddFilesRunningRef = useRef(false);

	useEffect(() => {
		const wasRunning = prevAddFilesRunningRef.current;
		const isRunning = addFilesWorkflowRunning;
		prevAddFilesRunningRef.current = isRunning;

		// Workflow just completed: extracting → idle, refetch data
		if (wasRunning && !isRunning && uploadState.phase === "extracting") {
			invalidateAll(caseId);
			setUploadState({ phase: "idle", fileNames: [] });
		}
	}, [addFilesWorkflowRunning, uploadState.phase, caseId, invalidateAll]);

	const handleUploadComplete = (fileNames: string[]) => {
		// Transition to extracting phase
		setUploadState({
			phase: "extracting",
			fileNames,
		});
		setShowUploadModal(false);
		// Start polling for updates
		invalidateAll(caseId);
		invalidateWorkflows(caseId);
	};

	const handleCancelExtraction = async () => {
		if (isCanceling) return;
		setIsCanceling(true);
		try {
			await cancelWorkflows(caseId, ["AUEAddFilesWorkflow"]);
			setUploadState({ phase: "idle", fileNames: [] });
			invalidateStatus(caseId);
			invalidateWorkflows(caseId);
		} catch (err) {
			console.error("Failed to cancel workflow:", err);
		} finally {
			setIsCanceling(false);
		}
	};

	const { data: creditPullStatus } = useCreditPullStatus(caseId, creditPullWorkflowId, {
		enabled: !!creditPullWorkflowId,
		refetchInterval: creditPullWorkflowId ? 2000 : false,
	});

	// Cancel credit pull workflow
	const handleCancelCreditPull = useCallback(async () => {
		if (!creditPullWorkflowId || !caseId || isCanceling) return;
		setIsCanceling(true);
		try {
			await api.post(`/api/v1/case/${caseId}/credit/pull/${creditPullWorkflowId}/cancel`, {});
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
		} catch (err) {
			console.error("Failed to cancel credit pull:", err);
		} finally {
			setIsCanceling(false);
		}
	}, [creditPullWorkflowId, caseId, isCanceling]);

	// Handle credit pull workflow status transitions.
	useEffect(() => {
		if (!creditPullWorkflowId || !creditPullStatus) return;
		const status = creditPullStatus.status;

		if (status === "completed") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			invalidateAll(caseId);
			return;
		}

		if (status === "canceled" || status === "terminated") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			return;
		}

		if (status === "failed" || status.includes("failed") || status.includes("timed_out")) {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
		}
	}, [creditPullWorkflowId, creditPullStatus, caseId, invalidateAll]);

	const handleCreditPullSuccess = useCallback((workflowId: string) => {
		// Store workflow ID to start polling
		setCreditPullWorkflowId(workflowId);
		// Transition to extracting state to show progress
		setUploadState({
			phase: "extracting",
			fileNames: ["Pulling credit report..."],
		});
	}, []);

	// Aggregate data across all reports
	const aggregatedData = useMemo(() => {
		if (!summary || summary.credit_reports.length === 0) {
			return {
				allTradeAccounts: [] as CreditReportTradeAccount[],
				allCollections: [] as CreditReportCollection[],
				allPublicRecords: [] as CreditReportPublicRecord[],
				allInquiries: [] as CreditReportInquiry[],
			};
		}

		const allTradeAccounts: CreditReportTradeAccount[] = [];
		const allCollections: CreditReportCollection[] = [];
		const allPublicRecords: CreditReportPublicRecord[] = [];
		const allInquiries: CreditReportInquiry[] = [];

		for (const report of summary.credit_reports) {
			allTradeAccounts.push(...report.trade_accounts);
			allCollections.push(...report.collections);
			allPublicRecords.push(...report.public_records);
			allInquiries.push(...report.inquiries);
		}

		return {
			allTradeAccounts,
			allCollections,
			allPublicRecords,
			allInquiries,
		};
	}, [summary]);

	if (isLoading) {
		return <CreditReportSkeleton />;
	}

	if (!summary || summary.credit_reports.length === 0) {
		return (
			<>
				<EmptyState
					onPullCredit={() => setShowPullCreditModal(true)}
					onUpload={() => setShowUploadModal(true)}
					isExtracting={isExtracting}
					extractionStatus={creditPullWorkflowId ? "Pulling credit report..." : caseStatus?.message}
					extractionProgress={caseStatus?.progress?.percent}
					fileNames={uploadState.fileNames}
					onCancelExtraction={
						creditPullWorkflowId ? handleCancelCreditPull : handleCancelExtraction
					}
					isCanceling={isCanceling}
				/>
				<PullCreditModal
					caseId={caseId}
					open={showPullCreditModal}
					onClose={() => setShowPullCreditModal(false)}
					onSuccess={handleCreditPullSuccess}
				/>
				<UploadModal
					caseId={caseId}
					isOpen={showUploadModal}
					onClose={() => setShowUploadModal(false)}
					onUploadComplete={handleUploadComplete}
				/>
			</>
		);
	}

	const { allTradeAccounts, allCollections, allPublicRecords, allInquiries } = aggregatedData;

	return (
		<div className="p-6 space-y-6 overflow-y-auto h-full">
			{/* Header with upload button */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-slate-800">Credit Report</h1>
					<p className="text-sm text-slate-500 mt-1">
						Extracted credit report data from uploaded PDFs
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setShowPullCreditModal(true)}
						disabled={isExtracting}
						className="px-4 py-2 rounded-lg font-medium transition-colors bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 inline-flex items-center gap-2"
					>
						<CreditCard className="w-4 h-4" />
						Pull Credit
					</button>
					<button
						onClick={() => setShowUploadModal(true)}
						disabled={isExtracting}
						className="px-4 py-2 rounded-lg font-medium transition-colors bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2"
					>
						<Upload className="w-4 h-4" />
						Upload
					</button>
				</div>
			</div>

			{/* Summary */}
			<SummaryCard
				reportCount={summary.credit_reports.length}
				tradeAccountCount={summary.total_trade_accounts}
				totalMonthlyPayments={summary.total_monthly_payments}
				totalBalance={summary.total_balance}
			/>

			{/* Per-report sections */}
			{summary.credit_reports.map((report, idx) => (
				<div key={report.document_id} className="space-y-4">
					{summary.credit_reports.length > 1 && (
						<div className="text-sm font-medium text-slate-500 uppercase tracking-wide">
							Report {idx + 1} of {summary.credit_reports.length}
						</div>
					)}

					<BorrowerInfoCard report={report} />

					<ScoreDisplay scores={report.credit_scores} />

					<ReportSummaryStats report={report} />
				</div>
			))}

			{/* Aggregated tables */}
			<TradeAccountsTable accounts={allTradeAccounts} />
			<CollectionsTable collections={allCollections} />
			<PublicRecordsTable records={allPublicRecords} />
			<InquiriesTable inquiries={allInquiries} />

			{/* Upload Modal */}
			<UploadModal
				caseId={caseId}
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				onUploadComplete={handleUploadComplete}
			/>

			{/* Pull Credit Modal */}
			<PullCreditModal
				caseId={caseId}
				open={showPullCreditModal}
				onClose={() => setShowPullCreditModal(false)}
				onSuccess={handleCreditPullSuccess}
			/>
		</div>
	);
}
