import type { BorrowerLoanRow } from "@multiversal-ventures/lux-core";
import { LoanActionPill, LoanStatusBadge } from "./LoanStatusBadge.js";

export interface BorrowerLoansTableProps {
	/** `GET /api/portal/my-loans`, newest-updated first — rendered in the order
	 * the server sent. */
	loans: BorrowerLoanRow[];
	/** The row's portal token and case id, in that order: the token is what
	 * opens that loan's portal. */
	onOpen: (token: string, caseId: string) => void;
	/** The signed-in borrower's email, named in the empty state so someone who
	 * applied under a different address can see why this list is empty. */
	email?: string | null;
	className?: string;
}

const HEADERS = ["Property", "Loan", "Status", "Loan officer", "Updated"];

/**
 * The borrower's own "My loans" dashboard.
 *
 * Deliberately the same table, row and header classes as the operator case
 * queue, so the two read as one product. Below `sm` the same rows render as
 * stacked cards.
 *
 * An empty list is NOT the only way a borrower has no loans: `my-loans`
 * answers 403 for a uid with no borrower record, which the caller renders as
 * this same empty state. See `listMyLoans`' doc comment in lux-core.
 */
export function BorrowerLoansTable({ loans, onOpen, email, className }: BorrowerLoansTableProps) {
	const shell = `bg-white rounded-lg border border-slate-200 shadow-sm${className ? ` ${className}` : ""}`;

	if (loans.length === 0) {
		return (
			<div className={`${shell} p-10 text-center`}>
				<p className="text-sm font-medium text-slate-900">No applications yet</p>
				<p className="text-sm text-slate-500 mt-1">
					{email
						? `We don't see any loan applications for ${email}. If you applied with a different email address, sign in with that one.`
						: "We don't see any loan applications for this account yet."}
				</p>
			</div>
		);
	}

	return (
		<div className={shell}>
			<table className="w-full hidden sm:table">
				<thead>
					<tr className="border-b border-slate-100">
						{HEADERS.map((header) => (
							<th
								key={header}
								className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
							>
								{header}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-slate-100">
					{loans.map((loan) => (
						<tr
							key={loan.case_id}
							tabIndex={0}
							onClick={() => onOpen(loan.token, loan.case_id)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onOpen(loan.token, loan.case_id);
								}
							}}
							className="hover:bg-slate-50 cursor-pointer transition-colors group"
						>
							<td className="px-6 py-4">
								<span className="text-sm font-medium text-slate-900">{subjectOf(loan)}</span>
							</td>
							<td className="px-6 py-4">
								{loan.product_label ? (
									<span className="block text-sm text-slate-900">{loan.product_label}</span>
								) : null}
								{summaryLine(loan) ? (
									<span className="block text-xs text-slate-500">{summaryLine(loan)}</span>
								) : null}
							</td>
							<td className="px-6 py-4">
								<div className="flex items-center gap-2 flex-wrap">
									<LoanStatusBadge status={loan.status} />
									<LoanActionPill status={loan.status} />
								</div>
							</td>
							<td className="px-6 py-4">
								<span className="text-sm text-slate-600">{loan.officer_name || "—"}</span>
							</td>
							<td className="px-6 py-4">
								<span className="text-sm text-slate-500">{formatDate(loan.updated_at)}</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Below `sm` the same rows, stacked. */}
			<div className="sm:hidden divide-y divide-slate-100">
				{loans.map((loan) => (
					<button
						key={loan.case_id}
						type="button"
						onClick={() => onOpen(loan.token, loan.case_id)}
						className="w-full text-left px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
					>
						<span className="block text-sm font-medium text-slate-900">{subjectOf(loan)}</span>
						{loan.product_label ? (
							<span className="block text-sm text-slate-600">{loan.product_label}</span>
						) : null}
						{summaryLine(loan) ? (
							<span className="block text-xs text-slate-500">{summaryLine(loan)}</span>
						) : null}
						<span className="flex items-center gap-2 flex-wrap mt-2">
							<LoanStatusBadge status={loan.status} />
							<LoanActionPill status={loan.status} />
						</span>
						<span className="block text-xs text-slate-500 mt-2">
							{loan.officer_name || "—"} · {formatDate(loan.updated_at)}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}

/** The case's primary subject: an address for a property-primary product, a
 * person otherwise, and the product's own name until something is extracted. */
function subjectOf(loan: BorrowerLoanRow): string {
	return loan.property_label || loan.product_label || "—";
}

/** The product's summary rows on one line — the values only; their labels are
 * what the loan's own card is for. */
function summaryLine(loan: BorrowerLoanRow): string {
	return (loan.summary ?? []).map((field) => field.display).join(" · ");
}

/** Locale date, or an em dash: `cases.updated_at` is a nullable column, and a
 * loan some other writer made still belongs on this list. */
function formatDate(value: string | null | undefined): string {
	if (!value) return "—";
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}
