import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
	ChevronDown,
	ChevronUp,
	Download,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	ArrowLeftRight,
	AlertTriangle,
	DollarSign,
	Ban,
	List,
	ClipboardCheck,
	Check,
	Loader2,
	FileText,
	RefreshCw,
	Eye,
	XCircle,
} from "lucide-react";
import {
	caseKeys,
	useBankStatementSummary,
	useBankTransactions,
	useBankReviewTransactions,
	useWorkflowStatus,
	usePageExtractionStats,
	useReviewDecisions,
} from "../../hooks/useCaseQueries";
import { useQueryClient } from "@tanstack/react-query";
import {
	getStageExcelUrl,
	reclassifyTransactions,
	reextractBankStatementPages,
	submitReviewDecisions,
	type BankAccount,
	type GrossDepositsResult,
	type BankTransaction,
	type BankTransactionsOptions,
	type ReviewTransaction,
	type BankStatementValidationIssue,
	type PageExtractionStat,
	type ReviewDecision,
} from "../../hooks/useApi";
import { BSReviewAgentModal } from "./BSReviewAgentModal";

interface BankStatementsTabProps {
	caseId: string;
}

/** Skeleton pulse animation component */
function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/** Format currency amount */
function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(amount);
}

/** Loading skeleton for the entire tab */
function BankStatementsSkeleton() {
	return (
		<div className="p-6 space-y-6">
			{/* Summary card skeleton */}
			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<div className="flex items-center justify-between mb-4">
					<Skeleton className="h-6 w-48" />
				</div>
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="bg-slate-50 rounded-lg p-4">
							<Skeleton className="h-4 w-24 mb-2" />
							<Skeleton className="h-8 w-16" />
						</div>
					))}
				</div>
			</div>

			{/* Gross deposits skeleton */}
			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<Skeleton className="h-6 w-40 mb-4" />
				<div className="space-y-3">
					{[1, 2].map((i) => (
						<div key={i} className="flex items-center gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-20 ml-auto" />
						</div>
					))}
				</div>
			</div>

			{/* Accounts skeleton */}
			<div className="bg-white rounded-xl border border-slate-200 p-6">
				<Skeleton className="h-6 w-24 mb-4" />
				<div className="grid grid-cols-3 gap-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="border border-slate-200 rounded-lg p-4">
							<Skeleton className="h-5 w-32 mb-2" />
							<Skeleton className="h-4 w-24 mb-2" />
							<Skeleton className="h-4 w-20" />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** Empty state when no bank statements found, or loading state during unification */
function EmptyState({ isProcessing }: { isProcessing?: boolean }) {
	if (isProcessing) {
		return (
			<div className="p-6 flex items-center justify-center h-full">
				<div className="max-w-md p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
					<Loader2 className="w-10 h-10 mx-auto mb-4 text-blue-500 animate-spin" />
					<h2 className="text-lg font-semibold text-slate-800 mb-2">Processing Bank Statements</h2>
					<p className="text-slate-600">
						Extracting transactions, classifying deposits, and calculating gross deposits. This may
						take a minute.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 flex items-center justify-center h-full">
			<div className="max-w-md p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
				<div className="text-4xl mb-4">🏦</div>
				<h2 className="text-lg font-semibold text-slate-800 mb-2">No Bank Statements Found</h2>
				<p className="text-slate-600">
					Upload bank statement PDFs to see gross deposits, transactions, and qualifying income
					analysis.
				</p>
			</div>
		</div>
	);
}

/** Summary card with counts */
function SummaryCard({
	statementCount,
	transactionCount,
	accountCount,
}: {
	statementCount: number;
	transactionCount: number;
	accountCount: number;
}) {
	return (
		<div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-6">
			<h2 className="text-lg font-semibold text-emerald-900 mb-4">Bank Statement Analysis</h2>
			<div className="grid grid-cols-3 gap-4">
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-emerald-700 mb-1">Statements</div>
					<div className="text-2xl font-bold text-emerald-900">{statementCount}</div>
				</div>
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-emerald-700 mb-1">Transactions</div>
					<div className="text-2xl font-bold text-emerald-900">
						{transactionCount.toLocaleString()}
					</div>
				</div>
				<div className="bg-white/60 rounded-lg p-4">
					<div className="text-sm text-emerald-700 mb-1">Accounts</div>
					<div className="text-2xl font-bold text-emerald-900">{accountCount}</div>
				</div>
			</div>
		</div>
	);
}

function WorkbookActionsCard({
	downloading,
	message,
	error,
	onDownloadLatest,
}: {
	downloading: boolean;
	message: string | null;
	error: string | null;
	onDownloadLatest: () => void;
}) {
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-slate-800">Unified &amp; Pivots Workbook</h2>
					<p className="text-sm text-slate-500 mt-1">
						Download the latest bank statement workbook with `unified` and `Pivots` sheets.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={onDownloadLatest}
						disabled={downloading}
						className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Download latest Unified/Pivots workbook"
					>
						<Download className={`w-4 h-4 ${downloading ? "animate-spin" : ""}`} />
						{downloading ? "Downloading..." : "Download Unified + Pivots"}
					</button>
				</div>
			</div>
			{error && (
				<div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{error}
				</div>
			)}
			{!error && message && (
				<div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
					{message}
				</div>
			)}
		</div>
	);
}

/** Gross deposits table by borrower */
function GrossDepositsCard({ deposits }: { deposits: GrossDepositsResult[] }) {
	if (deposits.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<h3 className="text-lg font-semibold text-slate-800 mb-4">Gross Deposits by Borrower</h3>
			<div className="overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-slate-200">
							<th className="text-left py-3 px-4 font-medium text-slate-600">Borrower</th>
							<th className="text-right py-3 px-4 font-medium text-slate-600">Eligible Deposits</th>
							<th className="text-right py-3 px-4 font-medium text-slate-600">Avg Monthly</th>
							<th className="text-right py-3 px-4 font-medium text-slate-600">Transfers</th>
							<th className="text-right py-3 px-4 font-medium text-slate-600">Large Deposits</th>
							<th className="text-center py-3 px-4 font-medium text-slate-600">Months</th>
						</tr>
					</thead>
					<tbody>
						{deposits.map((deposit) => (
							<tr key={deposit.borrower_id} className="border-b border-slate-100 hover:bg-slate-50">
								<td className="py-3 px-4 font-medium text-slate-900">
									{deposit.borrower_name || deposit.borrower_id}
								</td>
								<td className="py-3 px-4 text-right text-slate-700">
									{formatCurrency(deposit.gross_deposits)}
								</td>
								<td className="py-3 px-4 text-right font-medium text-emerald-700">
									{formatCurrency(deposit.avg_monthly)}
								</td>
								<td className="py-3 px-4 text-right text-slate-500">
									{deposit.transfer_count > 0 ? (
										<span title={`${deposit.transfer_count} transfers`}>
											-{formatCurrency(deposit.transfer_amount)}
										</span>
									) : (
										<span className="text-slate-300">—</span>
									)}
								</td>
								<td className="py-3 px-4 text-right text-amber-600">
									{deposit.large_deposit_count > 0 ? (
										<span title={`${deposit.large_deposit_count} large deposits (excluded)`}>
											{formatCurrency(deposit.large_deposit_amount)}
										</span>
									) : (
										<span className="text-slate-300">—</span>
									)}
								</td>
								<td className="py-3 px-4 text-center text-slate-600">{deposit.months_covered}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

/** Group accounts by account number (last 4 digits + type + institution) */
interface GroupedAccount {
	key: string;
	institution_name: string;
	account_type: string;
	account_number: string;
	borrower_name: string | null;
	latest_closing: number;
	statement_count: number;
	statements: BankAccount[];
}

function groupAccounts(accounts: BankAccount[]): GroupedAccount[] {
	const groups: Record<string, GroupedAccount> = {};
	for (const acct of accounts) {
		const last4 = acct.account_number.slice(-4);
		const key = `${acct.institution_name}_${acct.account_type}_${last4}`;
		if (!groups[key]) {
			groups[key] = {
				key,
				institution_name: acct.institution_name,
				account_type: acct.account_type,
				account_number: acct.account_number,
				borrower_name: acct.borrower_name,
				latest_closing: acct.closing_balance,
				statement_count: 0,
				statements: [],
			};
		}
		groups[key].statements.push(acct);
		groups[key].statement_count += 1;
		groups[key].latest_closing = acct.closing_balance;
	}
	return Object.values(groups);
}

/** Account cards grid -- grouped by account number */
function AccountsGrid({ caseId, accounts }: { caseId: string; accounts: BankAccount[] }) {
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = useState(true);

	const grouped = useMemo(() => groupAccounts(accounts), [accounts]);

	if (grouped.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between text-left"
			>
				<div className="flex items-center gap-2">
					<h3 className="text-lg font-semibold text-slate-800">Accounts</h3>
					<span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
						{grouped.length}
					</span>
				</div>
				{collapsed ? (
					<ChevronDown className="w-5 h-5 text-slate-400" />
				) : (
					<ChevronUp className="w-5 h-5 text-slate-400" />
				)}
			</button>

			{!collapsed && (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
					{grouped.map((group) => {
						const latestStmt = group.statements[group.statements.length - 1];
						const fileId = latestStmt?.statement_file_id;
						return (
							<div
								key={group.key}
								className={`border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors ${fileId ? "cursor-pointer" : ""}`}
								onClick={() => {
									if (fileId) navigate(`/case/${caseId}/view?file=${fileId}`);
								}}
							>
								<div className="flex items-start justify-between mb-2">
									<div>
										<div className="font-medium text-slate-900">
											{group.institution_name}
											{fileId && <Eye className="w-3.5 h-3.5 inline-block ml-1 text-blue-400" />}
										</div>
										<div className="text-sm text-slate-500">
											{group.account_type} ****{group.account_number.slice(-4)}
										</div>
									</div>
									{group.statement_count > 1 && (
										<span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
											{group.statement_count} stmts
										</span>
									)}
								</div>
								{group.borrower_name && (
									<div className="text-sm text-slate-600 mb-2">{group.borrower_name}</div>
								)}
								<div className="flex items-center justify-between text-sm">
									<span className="text-slate-500">Latest Balance</span>
									<span className="font-medium text-slate-900">
										{formatCurrency(group.latest_closing)}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

/** Sort field type */
type SortField = "transaction_date" | "amount" | "classification";

/** Sort direction type */
type SortDir = "asc" | "desc";

/** Transaction filters */
interface TransactionFilters {
	accountId: string | null;
	classification: string | null;
	creditDebit: string | null;
	sortBy: SortField;
	sortDir: SortDir;
}

/** Classification badge */
function ClassificationBadge({ classification }: { classification: string | null }) {
	if (!classification) return <span className="text-slate-400">-</span>;

	const colors: Record<string, string> = {
		// Income categories
		Payroll: "bg-emerald-100 text-emerald-700",
		"Self-Employed Business Revenue": "bg-emerald-100 text-emerald-800",
		"Government Benefits": "bg-blue-100 text-blue-700",
		"Rental Income": "bg-purple-100 text-purple-700",
		"Qualified Other Income": "bg-teal-100 text-teal-700",
		// Transfer/P2P categories
		P2P: "bg-pink-100 text-pink-700",
		Transfer: "bg-amber-100 text-amber-700",
		Gift: "bg-rose-100 text-rose-700",
		Loan: "bg-orange-100 text-orange-700",
		// Refunds/Returns
		"Tax Refund": "bg-indigo-100 text-indigo-700",
		"Merchant Refund": "bg-lime-100 text-lime-700",
		"Insurance Claim": "bg-sky-100 text-sky-700",
		// Other deposits
		"Cash Deposit Unverified": "bg-yellow-100 text-yellow-700",
		"Credit Card Advance": "bg-red-100 text-red-700",
		"Employer Reimbursement": "bg-green-100 text-green-700",
		"Investment Liquidation": "bg-violet-100 text-violet-700",
		Stimulus: "bg-blue-100 text-blue-800",
		Interest: "bg-cyan-100 text-cyan-700",
		// Fallback
		Unknown: "bg-slate-100 text-slate-600",
	};

	const colorClass = colors[classification] || "bg-slate-100 text-slate-600";

	return <span className={`px-2 py-0.5 text-xs rounded-full ${colorClass}`}>{classification}</span>;
}

/** Sortable column header */
function SortableHeader({
	label,
	field,
	currentSortBy,
	currentSortDir,
	onSort,
	align = "left",
}: {
	label: string;
	field: SortField;
	currentSortBy: SortField;
	currentSortDir: SortDir;
	onSort: (field: SortField) => void;
	align?: "left" | "right" | "center";
}) {
	const isActive = currentSortBy === field;
	const alignClass =
		align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

	return (
		<th
			className={`py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-50 select-none text-${align}`}
			onClick={() => onSort(field)}
		>
			<div className={`flex items-center gap-1 ${alignClass}`}>
				<span>{label}</span>
				{isActive ? (
					currentSortDir === "asc" ? (
						<ArrowUp className="w-3.5 h-3.5 text-blue-600" />
					) : (
						<ArrowDown className="w-3.5 h-3.5 text-blue-600" />
					)
				) : (
					<ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
				)}
			</div>
		</th>
	);
}

/** Loading skeleton for transactions table */
function TransactionsTableSkeleton() {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b border-slate-200">
						<th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
						<th className="text-left py-3 px-4 font-medium text-slate-600">Account</th>
						<th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
						<th className="text-right py-3 px-4 font-medium text-slate-600">Amount</th>
						<th className="text-center py-3 px-4 font-medium text-slate-600">Classification</th>
						<th className="text-center py-3 px-4 font-medium text-slate-600">Flags</th>
					</tr>
				</thead>
				<tbody>
					{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
						<tr key={i} className="border-b border-slate-100">
							<td className="py-3 px-4">
								<Skeleton className="h-4 w-20" />
							</td>
							<td className="py-3 px-4">
								<Skeleton className="h-4 w-16" />
							</td>
							<td className="py-3 px-4">
								<Skeleton className="h-4 w-48" />
							</td>
							<td className="py-3 px-4">
								<Skeleton className="h-4 w-20 ml-auto" />
							</td>
							<td className="py-3 px-4">
								<Skeleton className="h-5 w-16 mx-auto rounded-full" />
							</td>
							<td className="py-3 px-4">
								<Skeleton className="h-5 w-12 mx-auto" />
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Transaction view tabs */
type TransactionViewTab =
	| "all"
	| "eligible"
	| "transfers"
	| "large_deposits"
	| "excluded"
	| "review";

/** Review sub-tabs */
type ReviewSubTab = "extraction" | "transactions" | "reviewed";

const VIEW_TABS: {
	id: TransactionViewTab;
	label: string;
	icon: typeof List;
	color: string;
	activeColor: string;
}[] = [
	{
		id: "review",
		label: "Review",
		icon: ClipboardCheck,
		color: "text-violet-500",
		activeColor: "border-violet-500 text-violet-700",
	},
	{
		id: "all",
		label: "All",
		icon: List,
		color: "text-slate-500",
		activeColor: "border-blue-500 text-blue-700",
	},
	{
		id: "eligible",
		label: "Eligible",
		icon: DollarSign,
		color: "text-emerald-500",
		activeColor: "border-emerald-500 text-emerald-700",
	},
	{
		id: "transfers",
		label: "Transfers",
		icon: ArrowLeftRight,
		color: "text-amber-500",
		activeColor: "border-amber-500 text-amber-700",
	},
	{
		id: "large_deposits",
		label: "Large Deposits",
		icon: AlertTriangle,
		color: "text-orange-500",
		activeColor: "border-orange-500 text-orange-700",
	},
	{
		id: "excluded",
		label: "Excluded",
		icon: Ban,
		color: "text-red-400",
		activeColor: "border-red-500 text-red-700",
	},
];

const REVIEW_SUB_TABS: { id: ReviewSubTab; label: string }[] = [
	{ id: "extraction", label: "Extraction" },
	{ id: "transactions", label: "Transactions" },
	{ id: "reviewed", label: "Reviewed" },
];

const INCLUDED_CLASSIFICATIONS = new Set([
	"Payroll",
	"Self-Employed Business Revenue",
	"Government Benefits",
	"Rental Income",
	"Qualified Other Income",
	"P2P",
	"Unknown",
]);

const EXCLUDED_CLASSIFICATIONS = [
	"Transfer",
	"Gift",
	"Loan",
	"Tax Refund",
	"Merchant Refund",
	"Insurance Claim",
	"Cash Deposit Unverified",
	"Credit Card Advance",
	"Employer Reimbursement",
	"Investment Liquidation",
	"Stimulus",
	"Interest",
];

/** Transactions table with filtering and sorting */
function TransactionsTable({
	caseId,
	transactions,
	accounts,
	filters,
	onFilterChange,
	totalCount,
	isLoading,
	activeTab,
}: {
	caseId: string;
	transactions: BankTransaction[];
	accounts: BankAccount[];
	filters: TransactionFilters;
	onFilterChange: (filters: TransactionFilters) => void;
	totalCount: number;
	isLoading?: boolean;
	activeTab: TransactionViewTab;
}) {
	const classifications =
		activeTab === "excluded"
			? EXCLUDED_CLASSIFICATIONS
			: activeTab === "eligible"
				? [...INCLUDED_CLASSIFICATIONS]
				: [
						"Payroll",
						"Self-Employed Business Revenue",
						"Government Benefits",
						"Rental Income",
						"Qualified Other Income",
						"P2P",
						"Unknown",
						"Transfer",
						"Gift",
						"Loan",
						"Tax Refund",
						"Merchant Refund",
						"Insurance Claim",
						"Cash Deposit Unverified",
						"Credit Card Advance",
						"Employer Reimbursement",
						"Investment Liquidation",
						"Stimulus",
						"Interest",
					];

	const handleSort = (field: SortField) => {
		if (filters.sortBy === field) {
			onFilterChange({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc" });
		} else {
			onFilterChange({ ...filters, sortBy: field, sortDir: "desc" });
		}
	};

	const tabLabel = VIEW_TABS.find((t) => t.id === activeTab)?.label ?? "Transactions";

	return (
		<div className="px-6 py-4">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-base font-semibold text-slate-800">{tabLabel}</h3>
				<div className="text-sm text-slate-500">{totalCount.toLocaleString()} total</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 mb-4 flex-wrap">
				<select
					value={filters.accountId || ""}
					onChange={(e) => onFilterChange({ ...filters, accountId: e.target.value || null })}
					className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value="">All Accounts</option>
					{accounts.map((account) => (
						<option key={account.account_id} value={account.account_id}>
							{account.institution_name} ****{account.account_number.slice(-4)}
						</option>
					))}
				</select>

				{activeTab === "all" && (
					<select
						value={filters.creditDebit || ""}
						onChange={(e) => onFilterChange({ ...filters, creditDebit: e.target.value || null })}
						className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="">All Types</option>
						<option value="CR">Credits (Deposits)</option>
						<option value="DR">Debits (Withdrawals)</option>
					</select>
				)}

				{(activeTab === "all" || activeTab === "eligible" || activeTab === "excluded") && (
					<select
						value={filters.classification || ""}
						onChange={(e) => onFilterChange({ ...filters, classification: e.target.value || null })}
						className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="">All Classifications</option>
						{classifications.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				)}
			</div>

			{/* Table */}
			{isLoading ? (
				<TransactionsTableSkeleton />
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<SortableHeader
									label="Date"
									field="transaction_date"
									currentSortBy={filters.sortBy}
									currentSortDir={filters.sortDir}
									onSort={handleSort}
								/>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Account</th>
								<th className="text-left py-3 px-4 font-medium text-slate-600">Description</th>
								<SortableHeader
									label="Amount"
									field="amount"
									currentSortBy={filters.sortBy}
									currentSortDir={filters.sortDir}
									onSort={handleSort}
									align="right"
								/>
								<SortableHeader
									label="Classification"
									field="classification"
									currentSortBy={filters.sortBy}
									currentSortDir={filters.sortDir}
									onSort={handleSort}
									align="center"
								/>
								<th className="text-center py-3 px-4 font-medium text-slate-600">Flags</th>
								<th className="text-center py-3 px-4 font-medium text-slate-600">Source</th>
							</tr>
						</thead>
						<tbody>
							{transactions.length === 0 ? (
								<tr>
									<td colSpan={7} className="py-8 text-center text-slate-500">
										No {tabLabel.toLowerCase()} found
									</td>
								</tr>
							) : (
								transactions.map((txn) => {
									const account = accounts.find((a) => a.account_id === txn.account_id);
									return (
										<tr
											key={txn.transaction_id}
											className="border-b border-slate-100 hover:bg-slate-50"
										>
											<td className="py-3 px-4 text-slate-600">{txn.transaction_date}</td>
											<td className="py-3 px-4 text-slate-600 text-xs">
												{account ? (
													<span title={`${account.institution_name} - ${account.account_type}`}>
														****{account.account_number.slice(-4)}
													</span>
												) : (
													<span className="text-slate-400">{txn.account_id.slice(0, 8)}...</span>
												)}
											</td>
											<td
												className="py-3 px-4 text-slate-900 max-w-xs truncate"
												title={txn.description}
											>
												{txn.description}
											</td>
											<td
												className={`py-3 px-4 text-right font-medium ${
													txn.credit_debit === "CR" ? "text-emerald-600" : "text-slate-700"
												}`}
											>
												{txn.credit_debit === "CR" ? "+" : "-"}
												{formatCurrency(txn.amount)}
											</td>
											<td className="py-3 px-4 text-center">
												<ClassificationBadge classification={txn.deposit_classification} />
											</td>
											<td className="py-3 px-4 text-center">
												<div className="flex items-center justify-center gap-1">
													{txn.large_deposit_flag && (
														<span
															className="px-1.5 py-0.5 text-xs rounded bg-orange-100 text-orange-700"
															title="Large Deposit"
														>
															Large
														</span>
													)}
													{txn.is_transfer && (
														<span
															className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700"
															title="Transfer"
														>
															Transfer
														</span>
													)}
												</div>
											</td>
											<td className="py-3 px-4 text-center">
												<SourcePageLink
													caseId={caseId}
													fileId={txn.source_file_id}
													pageNumber={txn.source_page_number}
												/>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

/** Pagination controls */
function PaginationControls({
	currentPage,
	totalPages,
	totalCount,
	pageSize,
	onPageChange,
	isLoading,
}: {
	currentPage: number;
	totalPages: number;
	totalCount: number;
	pageSize: number;
	onPageChange: (page: number) => void;
	isLoading?: boolean;
}) {
	if (totalPages <= 1) return null;

	const startItem = (currentPage - 1) * pageSize + 1;
	const endItem = Math.min(currentPage * pageSize, totalCount);

	return (
		<div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg">
			<div className="text-sm text-slate-600">
				Showing {startItem}-{endItem} of {totalCount.toLocaleString()}
			</div>
			<div className="flex items-center gap-2">
				<button
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage <= 1 || isLoading}
					className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Previous
				</button>
				<span className="text-sm text-slate-600">
					Page {currentPage} of {totalPages}
				</span>
				<button
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage >= totalPages || isLoading}
					className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Next
				</button>
			</div>
		</div>
	);
}

/** All classifications that count towards gross deposits */
const ALL_CLASSIFICATIONS = [
	"Payroll",
	"Self-Employed Business Revenue",
	"Government Benefits",
	"Rental Income",
	"Qualified Other Income",
	"P2P",
	"Unknown",
	"Transfer",
	"Gift",
	"Loan",
	"Tax Refund",
	"Merchant Refund",
	"Insurance Claim",
	"Cash Deposit Unverified",
	"Credit Card Advance",
	"Employer Reimbursement",
	"Investment Liquidation",
	"Stimulus",
	"Interest",
];

/** Reason badge for review */
function ReviewReasonBadge({ reason }: { reason: string }) {
	const styles: Record<string, string> = {
		excluded_classification: "bg-red-50 text-red-700 border-red-200",
		large_deposit: "bg-orange-50 text-orange-700 border-orange-200",
		unknown_large_amount: "bg-yellow-50 text-yellow-700 border-yellow-200",
	};
	const labels: Record<string, string> = {
		excluded_classification: "Excluded Classification",
		large_deposit: "Large Deposit",
		unknown_large_amount: "Unknown (Large)",
	};
	return (
		<span
			className={`px-2 py-0.5 text-xs rounded border ${styles[reason] || "bg-slate-50 text-slate-600 border-slate-200"}`}
		>
			{labels[reason] || reason}
		</span>
	);
}

/** Source page link badge */
function SourcePageLink({
	caseId,
	fileId,
	pageNumber,
}: {
	caseId: string;
	fileId?: string;
	pageNumber?: number;
}) {
	const navigate = useNavigate();
	if (!fileId) return <span className="text-slate-300">-</span>;
	const label = pageNumber != null ? `p.${pageNumber}` : "file";
	return (
		<button
			onClick={() => {
				const params = new URLSearchParams({ file: fileId });
				if (pageNumber != null) params.set("page", String(pageNumber));
				navigate(`/case/${caseId}/view?${params.toString()}`);
			}}
			className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
			title={`View ${fileId} page ${pageNumber ?? ""}`}
		>
			<FileText className="w-3 h-3" />
			{label}
		</button>
	);
}

/** Extraction quality issues + page-level stats */
function ExtractionIssuesPanel({
	caseId,
	validationIssues,
	pageStats,
	accounts,
	isLoadingPages,
	dismissedSet,
	onDismiss,
	onDismissAll,
}: {
	caseId: string;
	validationIssues: BankStatementValidationIssue[];
	pageStats: PageExtractionStat[];
	accounts: BankAccount[];
	isLoadingPages: boolean;
	dismissedSet: Set<string>;
	onDismiss: (decisions: ReviewDecision[]) => void;
	onDismissAll: (decisions: ReviewDecision[]) => void;
}) {
	const queryClient = useQueryClient();
	const [collapsed, setCollapsed] = useState(false);
	const [reextractingPages, setReextractingPages] = useState<Set<string>>(new Set());
	const [reextractMsg, setReextractMsg] = useState<string | null>(null);
	const [expandedPage, setExpandedPage] = useState<string | null>(null);

	const emptyPages = pageStats.filter((p) => p.status === "empty");
	const lowPages = pageStats.filter((p) => p.status === "low");
	const allProblemPages = [...emptyPages, ...lowPages];
	const visiblePages = allProblemPages.filter(
		(p) => !dismissedSet.has(`page:${p.file_id}:${p.page_number}`),
	);
	const visibleIssues = validationIssues.filter(
		(issue) => !dismissedSet.has(`validation_issue:${issue.code}`),
	);
	const problemCount = visibleIssues.length + visiblePages.length;

	if (problemCount === 0 && !isLoadingPages) return null;

	const handleDismissPage = (fileId: string, pageNumber: number) => {
		onDismiss([
			{
				target_type: "page",
				target_id: `${fileId}:${pageNumber}`,
				action: "dismiss",
			},
		]);
	};

	const handleDismissAllPages = () => {
		onDismissAll(
			allProblemPages.map((p) => ({
				target_type: "page" as const,
				target_id: `${p.file_id}:${p.page_number}`,
				action: "dismiss" as const,
			})),
		);
	};

	const handleDismissIssue = (issue: BankStatementValidationIssue) => {
		onDismiss([
			{
				target_type: "validation_issue",
				target_id: issue.code,
				action: "dismiss",
			},
		]);
	};

	const handleDismissAllIssues = () => {
		onDismissAll(
			validationIssues.map((issue) => ({
				target_type: "validation_issue" as const,
				target_id: issue.code,
				action: "dismiss" as const,
			})),
		);
	};

	const handleReextractPage = async (fileId: string, pageNumber: number) => {
		const key = `${fileId}_${pageNumber}`;
		setReextractingPages((prev) => new Set(prev).add(key));
		setReextractMsg(null);
		try {
			await reextractBankStatementPages(caseId, [{ file_id: fileId, page_number: pageNumber }]);
			setReextractMsg(`Re-extraction started for page ${pageNumber}`);
			setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: ["case", caseId] });
			}, 5000);
		} catch (e) {
			setReextractMsg(`Error: ${e instanceof Error ? e.message : "Re-extraction failed"}`);
		} finally {
			setReextractingPages((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		}
	};

	const severityIcon = (severity: string) => {
		if (severity === "error") return <XCircle className="w-4 h-4 text-red-500" />;
		return <AlertTriangle className="w-4 h-4 text-amber-500" />;
	};

	return (
		<div className="mb-4">
			<button
				onClick={() => setCollapsed(!collapsed)}
				className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
			>
				<div className="flex items-center gap-2">
					<AlertTriangle className="w-4 h-4 text-amber-600" />
					<span className="text-sm font-medium text-amber-900">
						{problemCount} extraction {problemCount === 1 ? "issue" : "issues"}
					</span>
					{emptyPages.length > 0 && (
						<span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
							{emptyPages.length} empty {emptyPages.length === 1 ? "page" : "pages"}
						</span>
					)}
				</div>
				{collapsed ? (
					<ChevronDown className="w-4 h-4 text-amber-500" />
				) : (
					<ChevronUp className="w-4 h-4 text-amber-500" />
				)}
			</button>

			{!collapsed && (
				<div className="mt-2 space-y-3">
					{reextractMsg && (
						<div
							className={`text-xs px-3 py-2 rounded-lg ${reextractMsg.startsWith("Error") ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}
						>
							{reextractMsg}
						</div>
					)}

					{/* Validation issues */}
					{visibleIssues.length > 0 && (
						<div className="rounded-lg border border-slate-200 overflow-hidden">
							<div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
								<span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
									Validation Issues
								</span>
								{visibleIssues.length > 1 && (
									<button
										onClick={handleDismissAllIssues}
										className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
									>
										Dismiss all
									</button>
								)}
							</div>
							<div className="divide-y divide-slate-100">
								{visibleIssues.map((issue, idx) => (
									<div key={idx} className="flex items-start gap-2 px-3 py-2 text-sm">
										{severityIcon(issue.severity)}
										<div className="flex-1">
											<span className="text-slate-800">{issue.message}</span>
											{issue.affected_accounts.length > 0 && (
												<div className="flex items-center gap-1 mt-1">
													{issue.affected_accounts.map((acctId) => {
														const acct = accounts.find((a) => a.account_id === acctId);
														const fileId = acct?.statement_file_id;
														return (
															<SourcePageLink
																key={acctId}
																caseId={caseId}
																fileId={fileId || acctId}
															/>
														);
													})}
												</div>
											)}
										</div>
										<span className="px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-500 font-mono">
											{issue.code}
										</span>
										<button
											onClick={() => handleDismissIssue(issue)}
											className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
											title="Dismiss"
										>
											<XCircle className="w-4 h-4" />
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Page extraction quality */}
					{visiblePages.length > 0 && (
						<div className="rounded-lg border border-slate-200 overflow-hidden">
							<div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
								<span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
									Page Extraction Quality — {emptyPages.length} empty, {lowPages.length} low
								</span>
								{visiblePages.length > 1 && (
									<button
										onClick={handleDismissAllPages}
										className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
									>
										Dismiss all
									</button>
								)}
							</div>
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50">
											<th className="text-left py-2 px-3 text-xs font-medium text-slate-500">
												File
											</th>
											<th className="text-center py-2 px-3 text-xs font-medium text-slate-500">
												Page
											</th>
											<th className="text-center py-2 px-3 text-xs font-medium text-slate-500">
												Rows
											</th>
											<th className="text-center py-2 px-3 text-xs font-medium text-slate-500">
												Status
											</th>
											<th className="text-center py-2 px-3 text-xs font-medium text-slate-500">
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{visiblePages.map((page) => {
											const key = `${page.file_id}_${page.page_number}`;
											const isReextracting = reextractingPages.has(key);
											const isExpanded = expandedPage === key;
											return (
												<React.Fragment key={key}>
													<tr
														className={`${page.status === "empty" ? "bg-red-50" : "bg-yellow-50"} cursor-pointer`}
														onClick={() => setExpandedPage(isExpanded ? null : key)}
													>
														<td
															className="py-2 px-3 text-xs font-mono text-slate-600 truncate max-w-[120px]"
															title={page.file_id}
														>
															{isExpanded ? (
																<ChevronUp className="w-3 h-3 inline mr-1" />
															) : (
																<ChevronDown className="w-3 h-3 inline mr-1" />
															)}
															...{page.file_id.slice(-8)}
														</td>
														<td className="py-2 px-3 text-center text-xs">{page.page_number}</td>
														<td className="py-2 px-3 text-center text-xs font-medium">
															{page.txn_count}
														</td>
														<td className="py-2 px-3 text-center">
															<span
																className={`px-1.5 py-0.5 text-xs rounded-full ${
																	page.status === "empty"
																		? "bg-red-100 text-red-700"
																		: "bg-yellow-100 text-yellow-700"
																}`}
															>
																{page.status}
															</span>
														</td>
														<td
															className="py-2 px-3 text-center"
															onClick={(e) => e.stopPropagation()}
														>
															<div className="flex items-center justify-center gap-1">
																<SourcePageLink
																	caseId={caseId}
																	fileId={page.file_id}
																	pageNumber={page.page_number}
																/>
																<button
																	onClick={() =>
																		handleReextractPage(page.file_id, page.page_number)
																	}
																	disabled={isReextracting}
																	className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 transition-colors"
																	title="Re-extract this page"
																>
																	<RefreshCw
																		className={`w-3 h-3 ${isReextracting ? "animate-spin" : ""}`}
																	/>
																	Re-extract
																</button>
																<button
																	onClick={() => handleDismissPage(page.file_id, page.page_number)}
																	className="text-slate-300 hover:text-slate-500 transition-colors"
																	title="Dismiss"
																>
																	<XCircle className="w-3.5 h-3.5" />
																</button>
															</div>
														</td>
													</tr>
													{isExpanded && (
														<tr className="bg-slate-50">
															<td colSpan={5} className="p-4">
																<div className="flex gap-4 items-start">
																	<img
																		src={`/api/v1/case/${caseId}/page/${page.file_id}/${page.page_number}/image`}
																		alt={`Page ${page.page_number}`}
																		className="w-48 rounded border border-slate-200 shadow-sm bg-white"
																		loading="lazy"
																	/>
																	<div className="flex-1 text-sm text-slate-600">
																		<p className="font-medium text-slate-800 mb-1">
																			Page {page.page_number} Preview
																		</p>
																		<p>
																			File:{" "}
																			<span className="font-mono text-xs">{page.file_id}</span>
																		</p>
																		<p>
																			Transactions extracted:{" "}
																			<span className="font-medium">{page.txn_count}</span>
																		</p>
																		<p className="mt-2 text-xs text-slate-400">
																			Click row again to collapse. Use actions to dismiss or
																			re-extract.
																		</p>
																	</div>
																</div>
															</td>
														</tr>
													)}
												</React.Fragment>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/** Review table with inline reclassification + dismiss */
function ReviewTable({
	caseId,
	transactions,
	isLoading,
}: {
	caseId: string;
	transactions: ReviewTransaction[];
	isLoading: boolean;
}) {
	const queryClient = useQueryClient();
	const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [savedMessage, setSavedMessage] = useState<string | null>(null);
	const [dismissedTxns, setDismissedTxns] = useState<Set<string>>(new Set());

	const hasChanges = Object.keys(pendingUpdates).length > 0;

	const handleDismissTxn = async (txnId: string) => {
		setDismissedTxns((prev) => new Set(prev).add(txnId));
		try {
			await submitReviewDecisions(caseId, [
				{
					target_type: "transaction",
					target_id: txnId,
					action: "acknowledge",
					reason: "Reviewed and accepted",
				},
			]);
			queryClient.invalidateQueries({ queryKey: ["case", caseId, "bankReviewDecisions"] });
		} catch {
			setDismissedTxns((prev) => {
				const n = new Set(prev);
				n.delete(txnId);
				return n;
			});
		}
	};

	const handleDismissAll = async () => {
		const ids = visibleTxns.map((t) => t.transaction_id);
		setDismissedTxns(new Set(ids));
		try {
			await submitReviewDecisions(
				caseId,
				ids.map((id) => ({
					target_type: "transaction" as const,
					target_id: id,
					action: "acknowledge" as const,
					reason: "Bulk reviewed and accepted",
				})),
			);
			queryClient.invalidateQueries({ queryKey: ["case", caseId, "bankReviewDecisions"] });
		} catch {
			setDismissedTxns(new Set());
		}
	};

	const visibleTxns = transactions.filter((t) => !dismissedTxns.has(t.transaction_id));

	const handleClassificationChange = (txnId: string, newClassification: string) => {
		setPendingUpdates((prev) => {
			const updated = { ...prev };
			const original = transactions.find((t) => t.transaction_id === txnId);
			if (original && original.classification === newClassification) {
				delete updated[txnId];
			} else {
				updated[txnId] = newClassification;
			}
			return updated;
		});
		setSavedMessage(null);
	};

	const handleSave = async () => {
		if (!hasChanges) return;
		setSaving(true);
		setSavedMessage(null);
		try {
			const updates = Object.entries(pendingUpdates).map(([transaction_id, classification]) => ({
				transaction_id,
				classification,
			}));
			const result = await reclassifyTransactions(caseId, updates);
			setSavedMessage(
				`Updated ${result.updated_count} transaction(s). Gross deposits recalculated.`,
			);
			setPendingUpdates({});
			queryClient.invalidateQueries({ queryKey: caseKeys.bankReview(caseId) });
			queryClient.invalidateQueries({ queryKey: caseKeys.bankStatements(caseId) });
			queryClient.invalidateQueries({
				queryKey: ["case", caseId, "bankTransactions"],
				exact: false,
			});
		} catch (error) {
			setSavedMessage(`Error: ${error instanceof Error ? error.message : "Failed to save"}`);
		} finally {
			setSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="px-6 py-8">
				<TransactionsTableSkeleton />
			</div>
		);
	}

	return (
		<div className="px-6 py-4">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h3 className="text-base font-semibold text-slate-800">Review Queue</h3>
					<p className="text-xs text-slate-500 mt-0.5">
						Reclassify, acknowledge (looks ok), or let AI handle it.
					</p>
				</div>
				<div className="flex items-center gap-3">
					{savedMessage && (
						<span
							className={`text-xs ${savedMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}
						>
							{savedMessage}
						</span>
					)}
					{visibleTxns.length > 1 && (
						<button
							onClick={handleDismissAll}
							className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
						>
							Acknowledge all
						</button>
					)}
					<button
						onClick={handleSave}
						disabled={!hasChanges || saving}
						className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
					>
						{saving ? (
							<Loader2 className="w-3.5 h-3.5 animate-spin" />
						) : (
							<Check className="w-3.5 h-3.5" />
						)}
						{saving
							? "Saving..."
							: `Save${hasChanges ? ` (${Object.keys(pendingUpdates).length})` : ""}`}
					</button>
				</div>
			</div>

			{visibleTxns.length === 0 ? (
				<div className="py-12 text-center text-slate-500">
					<ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-slate-300" />
					No transactions need review
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200">
								<th className="text-left py-3 px-3 font-medium text-slate-600">Date</th>
								<th className="text-left py-3 px-3 font-medium text-slate-600">Description</th>
								<th className="text-right py-3 px-3 font-medium text-slate-600">Amount</th>
								<th className="text-center py-3 px-3 font-medium text-slate-600">Current</th>
								<th className="text-center py-3 px-3 font-medium text-slate-600">Reason</th>
								<th className="text-center py-3 px-2 font-medium text-slate-600">Source</th>
								<th className="text-center py-3 px-2 font-medium text-slate-600">Class</th>
								<th className="text-center py-3 px-2 font-medium text-slate-600"></th>
							</tr>
						</thead>
						<tbody>
							{visibleTxns.map((txn) => {
								const isPending = txn.transaction_id in pendingUpdates;
								const displayClassification = isPending
									? pendingUpdates[txn.transaction_id]
									: txn.classification;
								return (
									<tr
										key={txn.transaction_id}
										className={`border-b border-slate-100 ${isPending ? "bg-violet-50" : "hover:bg-slate-50"}`}
									>
										<td className="py-3 px-3 text-slate-600 whitespace-nowrap">
											{txn.transaction_date}
										</td>
										<td
											className="py-3 px-2 text-slate-900 max-w-[180px] truncate"
											title={txn.description}
										>
											{txn.description}
										</td>
										<td className="py-3 px-2 text-right font-medium text-emerald-600 whitespace-nowrap">
											+{formatCurrency(txn.amount)}
										</td>
										<td className="py-3 px-3 text-center">
											<ClassificationBadge classification={txn.classification} />
										</td>
										<td className="py-3 px-3 text-center">
											<ReviewReasonBadge reason={txn.review_reason} />
										</td>
										<td className="py-3 px-3 text-center">
											<SourcePageLink
												caseId={caseId}
												fileId={txn.source_file_id}
												pageNumber={txn.source_page_number}
											/>
										</td>
										<td className="py-3 px-2 text-center">
											<select
												value={displayClassification}
												onChange={(e) =>
													handleClassificationChange(txn.transaction_id, e.target.value)
												}
												className={`px-1.5 py-1 text-xs border rounded-lg max-w-[120px] focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${
													isPending
														? "border-violet-400 bg-violet-50 font-medium"
														: "border-slate-200"
												}`}
											>
												{ALL_CLASSIFICATIONS.map((c) => (
													<option key={c} value={c}>
														{c}
													</option>
												))}
											</select>
										</td>
										<td className="py-3 px-3 text-center">
											<button
												onClick={() => handleDismissTxn(txn.transaction_id)}
												className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
												title="Looks OK -- acknowledge and dismiss from review"
											>
												<Check className="w-3 h-3" />
												OK
											</button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

const PAGE_SIZE = 50;

export function BankStatementsTab({ caseId }: BankStatementsTabProps) {
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<TransactionViewTab>("all");
	const [initialTabSet, setInitialTabSet] = useState(false);
	const [reviewSubTab, setReviewSubTab] = useState<ReviewSubTab>("extraction");
	const [filters, setFilters] = useState<TransactionFilters>({
		accountId: null,
		classification: null,
		creditDebit: null,
		sortBy: "transaction_date",
		sortDir: "desc",
	});
	const [currentPage, setCurrentPage] = useState(1);
	const [downloadingWorkbook, setDownloadingWorkbook] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const handleTabChange = (tab: TransactionViewTab) => {
		setActiveTab(tab);
		setCurrentPage(1);
		setFilters({
			accountId: filters.accountId,
			classification: null,
			creditDebit: null,
			sortBy: "transaction_date",
			sortDir: "desc",
		});
	};

	const handleFilterChange = (newFilters: TransactionFilters) => {
		const filterOnlyChanged =
			newFilters.accountId !== filters.accountId ||
			newFilters.classification !== filters.classification ||
			newFilters.creditDebit !== filters.creditDebit;
		setFilters(newFilters);
		if (filterOnlyChanged) {
			setCurrentPage(1);
		}
	};

	// Build filter options for API — tab determines base filters
	const filterOptions: BankTransactionsOptions = useMemo(() => {
		const opts: BankTransactionsOptions = {
			limit: PAGE_SIZE,
			offset: (currentPage - 1) * PAGE_SIZE,
			sortBy: filters.sortBy,
			sortDir: filters.sortDir,
		};
		if (filters.accountId) opts.accountId = filters.accountId;
		if (filters.classification) opts.classification = filters.classification;

		switch (activeTab) {
			case "eligible":
				opts.creditDebit = "CR";
				opts.isTransfer = false;
				opts.largeDepositFlag = false;
				break;
			case "transfers":
				opts.isTransfer = true;
				break;
			case "large_deposits":
				opts.largeDepositFlag = true;
				break;
			case "excluded":
				opts.creditDebit = "CR";
				opts.isTransfer = false;
				opts.largeDepositFlag = false;
				if (!filters.classification) {
					opts.classification = EXCLUDED_CLASSIFICATIONS.join(",");
				}
				break;
			default:
				if (filters.creditDebit) opts.creditDebit = filters.creditDebit;
				break;
		}
		return opts;
	}, [filters, currentPage, activeTab]);

	// Fetch data
	const { data: summary, isLoading: summaryLoading } = useBankStatementSummary(caseId);
	const { data: workflowStatus } = useWorkflowStatus(caseId);
	const { data: transactionsData, isLoading: transactionsLoading } = useBankTransactions(
		caseId,
		filterOptions,
	);
	const { data: reviewData, isLoading: reviewLoading } = useBankReviewTransactions(caseId, {
		enabled: activeTab === "review",
	});
	const { data: pageStatsData, isLoading: pageStatsLoading } = usePageExtractionStats(caseId, {
		enabled: activeTab === "review",
	});
	const { data: reviewDecisionsData } = useReviewDecisions(caseId, {
		enabled: activeTab === "review",
	});

	const dismissedSet = useMemo(() => {
		const set = new Set<string>();
		for (const d of reviewDecisionsData?.decisions ?? []) {
			if (d.action === "dismiss") {
				set.add(`${d.target_type}:${d.target_id}`);
			}
		}
		return set;
	}, [reviewDecisionsData]);

	const handleDismiss = useCallback(
		async (decisions: ReviewDecision[]) => {
			try {
				await submitReviewDecisions(caseId, decisions);
				queryClient.invalidateQueries({ queryKey: ["case", caseId, "bankReviewDecisions"] });
			} catch (e) {
				console.error("Failed to save review decision:", e);
			}
		},
		[caseId, queryClient],
	);

	// Auto-switch to Review tab if there are items to review
	useEffect(() => {
		if (initialTabSet || summaryLoading) return;
		const hasIssues = (summary?.validation_issues?.length ?? 0) > 0;
		if (hasIssues) {
			setActiveTab("review");
		}
		setInitialTabSet(true);
	}, [summary, summaryLoading, initialTabSet]);

	const openUnifiedWorkbook = useCallback(async () => {
		const excel = await getStageExcelUrl(caseId, "unified_bank_statement");
		window.location.assign(excel.signed_url);
	}, [caseId]);

	const handleDownloadLatest = useCallback(async () => {
		setActionError(null);
		setActionMessage(null);
		setDownloadingWorkbook(true);
		try {
			await openUnifiedWorkbook();
			setActionMessage("Opened latest Unified/Pivots workbook.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to download workbook";
			setActionError(message);
		} finally {
			setDownloadingWorkbook(false);
		}
	}, [openUnifiedWorkbook]);

	if (summaryLoading) {
		return <BankStatementsSkeleton />;
	}

	const hasStatements = Boolean(summary && summary.statement_count > 0);
	const isProcessing = Boolean(workflowStatus?.has_running);

	return (
		<div className="p-6 space-y-6 overflow-y-auto h-full">
			<WorkbookActionsCard
				downloading={downloadingWorkbook}
				message={actionMessage}
				error={actionError}
				onDownloadLatest={handleDownloadLatest}
			/>

			{!hasStatements ? (
				<EmptyState isProcessing={isProcessing} />
			) : (
				<>
					{/* Summary */}
					<SummaryCard
						statementCount={summary?.statement_count ?? 0}
						transactionCount={summary?.transaction_count ?? 0}
						accountCount={summary?.accounts.length ?? 0}
					/>

					{/* Gross Deposits */}
					<GrossDepositsCard deposits={summary?.gross_deposits ?? []} />

					{/* Accounts */}
					<AccountsGrid caseId={caseId} accounts={summary?.accounts ?? []} />

					{/* Tab bar */}
					<div className="bg-white rounded-xl border border-slate-200">
						<div className="flex items-center border-b border-slate-200 overflow-x-auto">
							<div className="flex flex-1 min-w-0">
								{VIEW_TABS.map((tab) => {
									const Icon = tab.icon;
									const isActive = activeTab === tab.id;
									return (
										<button
											key={tab.id}
											onClick={() => handleTabChange(tab.id)}
											className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
												isActive
													? tab.activeColor
													: "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
											}`}
										>
											<Icon className={`w-4 h-4 ${isActive ? "" : tab.color}`} />
											{tab.label}
											{tab.id === "review" &&
												(reviewData?.total_count ?? 0) + (pageStatsData?.empty_pages ?? 0) > 0 && (
													<span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-violet-100 text-violet-600">
														{(reviewData?.total_count ?? 0) + (pageStatsData?.empty_pages ?? 0)}
													</span>
												)}
											{isActive && tab.id !== "review" && transactionsData && (
												<span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
													{transactionsData.total_count.toLocaleString()}
												</span>
											)}
										</button>
									);
								})}
							</div>
							{/* AI Handle It button -- always visible in tab bar */}
							<div className="pr-3 pl-2 shrink-0">
								<BSReviewAgentModal caseId={caseId} dismissedTargets={Array.from(dismissedSet)} />
							</div>
						</div>

						{activeTab === "review" ? (
							<div>
								{/* Review sub-tabs */}
								<div className="flex items-center gap-1 px-4 pt-3 pb-1">
									{REVIEW_SUB_TABS.map((sub) => (
										<button
											key={sub.id}
											onClick={() => setReviewSubTab(sub.id)}
											className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
												reviewSubTab === sub.id
													? "bg-violet-100 text-violet-700"
													: "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
											}`}
										>
											{sub.label}
										</button>
									))}
								</div>

								{/* Extraction sub-tab */}
								{reviewSubTab === "extraction" && (
									<div className="px-6 pt-2">
										<ExtractionIssuesPanel
											caseId={caseId}
											validationIssues={summary?.validation_issues ?? []}
											pageStats={pageStatsData?.pages ?? []}
											accounts={summary?.accounts ?? []}
											isLoadingPages={pageStatsLoading}
											dismissedSet={dismissedSet}
											onDismiss={handleDismiss}
											onDismissAll={handleDismiss}
										/>
									</div>
								)}

								{/* Transactions sub-tab */}
								{reviewSubTab === "transactions" && (
									<ReviewTable
										caseId={caseId}
										transactions={reviewData?.transactions || []}
										isLoading={reviewLoading}
									/>
								)}

								{/* Reviewed sub-tab */}
								{reviewSubTab === "reviewed" && (
									<div className="px-6 py-4">
										<h3 className="text-sm font-semibold text-slate-800 mb-3">Reviewed Items</h3>
										{(reviewDecisionsData?.decisions ?? []).length === 0 ? (
											<div className="py-8 text-center text-slate-400 text-sm">
												No items reviewed yet
											</div>
										) : (
											<div className="space-y-1.5">
												{(reviewDecisionsData?.decisions ?? []).map((d, idx) => (
													<div
														key={idx}
														className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 text-sm"
													>
														<span
															className={`px-1.5 py-0.5 text-xs rounded ${
																d.action === "dismiss"
																	? "bg-slate-200 text-slate-600"
																	: d.action === "reextract_requested"
																		? "bg-violet-100 text-violet-700"
																		: "bg-emerald-100 text-emerald-700"
															}`}
														>
															{d.action}
														</span>
														<span className="text-slate-700 flex-1">
															{d.target_type}:{" "}
															<span className="font-mono text-xs">{d.target_id}</span>
														</span>
														{d.reason && (
															<span
																className="text-xs text-slate-400 max-w-[200px] truncate"
																title={d.reason}
															>
																{d.reason}
															</span>
														)}
														<span className="text-xs text-slate-400">
															{d.reviewed_by?.split("@")[0] ?? "unknown"}
														</span>
													</div>
												))}
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							<div className="p-0">
								<div className="px-6 pt-4">
									<PaginationControls
										currentPage={currentPage}
										totalPages={Math.ceil((transactionsData?.total_count || 0) / PAGE_SIZE)}
										totalCount={transactionsData?.total_count || 0}
										pageSize={PAGE_SIZE}
										onPageChange={setCurrentPage}
										isLoading={transactionsLoading}
									/>
								</div>

								<TransactionsTable
									caseId={caseId}
									transactions={transactionsData?.transactions || []}
									accounts={summary?.accounts ?? []}
									filters={filters}
									onFilterChange={handleFilterChange}
									totalCount={transactionsData?.total_count || 0}
									isLoading={transactionsLoading}
									activeTab={activeTab}
								/>

								<div className="px-6 pb-4">
									<PaginationControls
										currentPage={currentPage}
										totalPages={Math.ceil((transactionsData?.total_count || 0) / PAGE_SIZE)}
										totalCount={transactionsData?.total_count || 0}
										pageSize={PAGE_SIZE}
										onPageChange={setCurrentPage}
										isLoading={transactionsLoading}
									/>
								</div>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
