/**
 * CreditSummaryStats - Summary statistics row derived from accounts
 */

import type { LoanAccount, Inquiry } from "./types";

interface CreditSummaryStatsProps {
	accounts: LoanAccount[];
	inquiries: Inquiry[];
}

/** Single stat card */
function StatCard({ value, label }: { value: string | number; label: string }) {
	return (
		<div className="flex flex-col items-center justify-center px-4 py-3 bg-white rounded-lg border border-slate-200">
			<span className="text-xl font-semibold text-slate-800">{value}</span>
			<span className="text-xs text-slate-500 mt-0.5">{label}</span>
		</div>
	);
}

/** Calculate average age of accounts in years */
function calculateAverageAge(accounts: LoanAccount[]): string {
	if (accounts.length === 0) return "0y";

	const now = new Date();
	let totalMonths = 0;

	for (const account of accounts) {
		const openDate = new Date(account.openDate);
		const months =
			(now.getFullYear() - openDate.getFullYear()) * 12 + (now.getMonth() - openDate.getMonth());
		totalMonths += Math.max(0, months);
	}

	const avgMonths = totalMonths / accounts.length;
	const years = Math.floor(avgMonths / 12);
	const months = Math.round(avgMonths % 12);

	if (years === 0) return `${months}mo`;
	if (months === 0) return `${years}y`;
	return `${years}y ${months}mo`;
}

/** Calculate credit utilization (revolving credit only) */
function calculateUtilization(accounts: LoanAccount[]): string {
	const revolvingAccounts = accounts.filter(
		(a) =>
			a.accountType === "CREDIT_CARD" ||
			a.accountType === "LINE_OF_CREDIT" ||
			a.accountType === "HELOC",
	);

	let totalBalance = 0;
	let totalLimit = 0;

	for (const account of revolvingAccounts) {
		if (account.creditLimit && account.creditLimit > 0) {
			totalBalance += account.currentBalance;
			totalLimit += account.creditLimit;
		}
	}

	if (totalLimit === 0) return "N/A";
	const utilization = (totalBalance / totalLimit) * 100;
	return `${utilization.toFixed(1)}%`;
}

/** Format currency */
function formatCurrency(amount: number): string {
	if (amount >= 1000000) {
		return `$${(amount / 1000000).toFixed(1)}M`;
	}
	if (amount >= 1000) {
		return `$${amount.toLocaleString("en-US")}`;
	}
	return `$${amount}`;
}

export function CreditSummaryStats({ accounts, inquiries }: CreditSummaryStatsProps) {
	const totalAccounts = accounts.length;
	const openAccounts = accounts.filter((a) => a.status === "OPEN").length;
	const closedAccounts = accounts.filter(
		(a) => a.status === "CLOSED" || a.status === "PAID",
	).length;

	const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
	const monthlyDti = accounts
		.filter((a) => a.includeInDti)
		.reduce((sum, a) => sum + a.dtiPayment, 0);

	const utilization = calculateUtilization(accounts);
	const avgAge = calculateAverageAge(accounts);
	const inquiryCount = inquiries.length;

	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
			<StatCard value={totalAccounts} label="Total Accounts" />
			<StatCard value={openAccounts} label="Open" />
			<StatCard value={closedAccounts} label="Closed" />
			<StatCard value={formatCurrency(totalBalance)} label="Total Balance" />
			<StatCard value={formatCurrency(monthlyDti)} label="Monthly DTI" />
			<StatCard value={utilization} label="Utilization" />
			<StatCard value={avgAge} label="Avg Age" />
			<StatCard value={inquiryCount} label="Inquiries" />
		</div>
	);
}
