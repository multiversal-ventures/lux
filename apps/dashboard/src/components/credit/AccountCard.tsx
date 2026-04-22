/**
 * AccountCard - Expandable card for a single credit account
 */

import type { LoanAccount, AccountStatus } from "./types";
import { PaymentHistoryDots } from "./PaymentHistoryDots";

interface AccountCardProps {
	account: LoanAccount;
	expanded: boolean;
	onToggle: () => void;
}

/** Get status badge style */
function getStatusStyle(status: AccountStatus): { bg: string; text: string; border: string } {
	switch (status) {
		case "OPEN":
			return { bg: "bg-white", text: "text-slate-600", border: "border-slate-300" };
		case "CLOSED":
		case "PAID":
			return { bg: "bg-white", text: "text-slate-500", border: "border-slate-300" };
		case "COLLECTION":
			return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" };
		default: {
			// Exhaustive check - TypeScript will error if a new status is added
			void (status satisfies never);
			return { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-300" };
		}
	}
}

/** Format currency (handles negative amounts) */
function formatCurrency(amount: number): string {
	const absAmount = Math.abs(amount).toLocaleString("en-US");
	return amount < 0 ? `-$${absAmount}` : `$${absAmount}`;
}

/** Format date (with error handling) */
function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) return dateStr; // Return original if invalid
	return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/** Chevron icon */
function ChevronIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			aria-hidden="true"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

export function AccountCard({ account, expanded, onToggle }: AccountCardProps) {
	const statusStyle = getStatusStyle(account.status);

	return (
		<div className={`bg-white rounded-lg border border-slate-200 overflow-hidden`}>
			{/* Collapsed Header */}
			<button
				onClick={onToggle}
				className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
				aria-expanded={expanded}
				aria-label={`${account.creditorName} account details, ${expanded ? "collapse" : "expand"}`}
			>
				<div className="flex items-center gap-3">
					<div>
						<div className="flex items-center gap-2">
							<span className="font-medium text-slate-800">{account.creditorName}</span>
							<span
								className={`px-2 py-0.5 text-xs font-medium rounded border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
							>
								{account.status}
							</span>
						</div>
						<p className="text-xs text-slate-500 mt-0.5 text-left">{account.accountNumber}</p>
					</div>
				</div>

				<div className="flex items-center gap-6">
					<div className="text-right">
						<span className="text-xs text-slate-400 uppercase">Balance</span>
						<p className="font-semibold text-slate-800">{formatCurrency(account.currentBalance)}</p>
					</div>
					<div className="text-right">
						<span className="text-xs text-slate-400 uppercase">Monthly</span>
						<p className="font-semibold text-slate-800">
							{account.monthlyPayment > 0 ? formatCurrency(account.monthlyPayment) : "—"}
						</p>
					</div>
					<ChevronIcon expanded={expanded} />
				</div>
			</button>

			{/* Expanded Details */}
			{expanded && (
				<div className="px-4 pb-4 border-t border-slate-100">
					{/* Row 1: Original, Rate, Opened */}
					<div className="flex items-center gap-8 py-3 text-sm">
						<div>
							<span className="text-slate-500">Original:</span>{" "}
							<span className="font-medium text-slate-700">
								{formatCurrency(account.originalAmount)}
							</span>
						</div>
						{account.interestInfo && (
							<div>
								<span className="text-slate-500">Rate:</span>{" "}
								<span className="font-medium text-slate-700">{account.interestInfo.rate}%</span>
							</div>
						)}
						<div>
							<span className="text-slate-500">Opened:</span>{" "}
							<span className="font-medium text-slate-700">{formatDate(account.openDate)}</span>
						</div>
						{account.closedDate && (
							<div>
								<span className="text-slate-500">Closed:</span>{" "}
								<span className="font-medium text-slate-700">{formatDate(account.closedDate)}</span>
							</div>
						)}
					</div>

					{/* Row 2: Payment History */}
					<div className="py-3 border-t border-slate-100">
						<div className="flex items-center justify-between">
							<span className="text-sm text-slate-500">Payment History (24 months)</span>
							<PaymentHistoryDots history={account.paymentHistory} months={24} />
						</div>
					</div>

					{/* Row 3: DTI Treatment */}
					<div className="py-3 border-t border-slate-100">
						<div className="flex items-center justify-between text-sm">
							<span className="text-slate-500">DTI Treatment</span>
							<span
								className={`font-medium ${account.includeInDti ? "text-slate-700" : "text-slate-400"}`}
							>
								{account.includeInDti
									? `${formatCurrency(account.dtiPayment)}/mo included`
									: account.dtiNote || "Not included in DTI"}
							</span>
						</div>
					</div>

					{/* Row 4: Additional Info */}
					{(account.creditLimit || account.collateral || account.responsibilityType) && (
						<div className="py-3 border-t border-slate-100 flex items-center gap-6 text-sm">
							{account.creditLimit && (
								<div>
									<span className="text-slate-500">Credit Limit:</span>{" "}
									<span className="font-medium text-slate-700">
										{formatCurrency(account.creditLimit)}
									</span>
								</div>
							)}
							{account.collateral && (
								<div>
									<span className="text-slate-500">Collateral:</span>{" "}
									<span className="font-medium text-slate-700">{account.collateral}</span>
								</div>
							)}
							{account.responsibilityType && (
								<div>
									<span className="text-slate-500">Responsibility:</span>{" "}
									<span className="font-medium text-slate-700 capitalize">
										{account.responsibilityType.toLowerCase().replace(/_/g, " ")}
									</span>
								</div>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
