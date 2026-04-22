/**
 * AccountsList - Container for account cards with expand/collapse all
 */

import { useMemo, useState } from "react";
import { AccountCard } from "./AccountCard";
import type { AccountType, LoanAccount } from "./types";

interface AccountsListProps {
	accounts: LoanAccount[];
}

type AccountGroup = "loan" | "revolving" | "collection";

/** Determine account group */
function getAccountGroup(type: AccountType): AccountGroup {
	switch (type) {
		case "COLLECTION":
			return "collection";
		case "CREDIT_CARD":
		case "LINE_OF_CREDIT":
		case "HELOC":
			return "revolving";
		default:
			return "loan";
	}
}

/** Group display names */
const groupLabels: Record<AccountGroup, string> = {
	loan: "Loan Accounts",
	revolving: "Revolving Credit",
	collection: "Collections",
};

/** Credit card icon */
function CreditCardIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
			/>
		</svg>
	);
}

const expandCollapseBtnClass =
	"inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-1";

function ExpandIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

function CollapseIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
		</svg>
	);
}

export function AccountsList({ accounts }: AccountsListProps) {
	const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

	// Show "Expand all" only when at least one card is collapsed; "Collapse all" only when at least one is expanded
	const hasCollapsed = expandedCards.size < accounts.length;
	const hasExpanded = expandedCards.size > 0;

	// Group accounts by type
	const groupedAccounts = useMemo(() => {
		const groups: Record<AccountGroup, LoanAccount[]> = {
			loan: [],
			revolving: [],
			collection: [],
		};

		for (const account of accounts) {
			const group = getAccountGroup(account.accountType);
			groups[group].push(account);
		}

		// Sort within groups: OPEN first, then by balance descending
		for (const group of Object.values(groups)) {
			group.sort((a, b) => {
				if (a.status === "OPEN" && b.status !== "OPEN") return -1;
				if (a.status !== "OPEN" && b.status === "OPEN") return 1;
				return b.currentBalance - a.currentBalance;
			});
		}

		return groups;
	}, [accounts]);

	// Non-empty groups for rendering
	const activeGroups = useMemo(() => {
		return (Object.entries(groupedAccounts) as [AccountGroup, LoanAccount[]][]).filter(
			([, accts]) => accts.length > 0,
		);
	}, [groupedAccounts]);

	const handleExpandAll = () => setExpandedCards(new Set(accounts.map((a) => a.accountId)));
	const handleCollapseAll = () => setExpandedCards(new Set());

	// Guard against malformed data
	if (!Array.isArray(accounts)) {
		return (
			<div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center">
				<CreditCardIcon className="w-12 h-12 mx-auto text-amber-400 mb-3" />
				<p className="text-amber-700">Invalid account data</p>
			</div>
		);
	}

	if (accounts.length === 0) {
		return (
			<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
				<CreditCardIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
				<p className="text-slate-500">No accounts found</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{activeGroups.map(([group, groupAccounts]) => (
				<div key={group} className="space-y-3">
					{/* Group Header */}
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold text-slate-700">{groupLabels[group]}</h3>
						{group === activeGroups[0][0] && (hasCollapsed || hasExpanded) && (
							<div className="flex items-center gap-2">
								{hasCollapsed && (
									<button
										type="button"
										onClick={handleExpandAll}
										className={expandCollapseBtnClass}
										aria-label="Expand all accounts"
									>
										<ExpandIcon className="shrink-0" />
										Expand all
									</button>
								)}
								{hasExpanded && (
									<button
										type="button"
										onClick={handleCollapseAll}
										className={expandCollapseBtnClass}
										aria-label="Collapse all accounts"
									>
										<CollapseIcon className="shrink-0" />
										Collapse all
									</button>
								)}
							</div>
						)}
					</div>

					{/* Account Cards */}
					<div className="space-y-2">
						{groupAccounts.map((account) => (
							<AccountCard
								key={account.accountId}
								account={account}
								expanded={expandedCards.has(account.accountId)}
								onToggle={() => {
									setExpandedCards((prev) => {
										const next = new Set(prev);
										if (next.has(account.accountId)) {
											next.delete(account.accountId);
										} else {
											next.add(account.accountId);
										}
										return next;
									});
								}}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
