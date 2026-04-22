import { Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CaseHistoryProgress, StoredCase } from "../hooks/useCaseHistory";
import { getStatusLabel as _getStatusLabel } from "../lib/phases";
import type { CaseStatusCode } from "../types";

interface CasesTableProps {
	cases: StoredCase[];
	onRemove: (caseId: string) => Promise<void>;
	onNewCase: () => void;
	onSamples: () => void;
}

const PAGE_SIZE = 10;
const CONTACT_EMAIL = "akshay@fenero.ai";

/** Parse PAGE_LIMIT_EXCEEDED error string to extract total pages and limit */
function parsePageLimitError(
	error: string | null | undefined,
): { totalPages: number; pageLimit: number } | null {
	if (!error || !error.startsWith("PAGE_LIMIT_EXCEEDED|")) return null;
	const parts = error.split("|");
	if (parts.length >= 3) {
		const totalPages = Number.parseInt(parts[1], 10);
		const pageLimit = Number.parseInt(parts[2], 10);
		if (!isNaN(totalPages) && !isNaN(pageLimit)) {
			return { totalPages, pageLimit };
		}
	}
	return null;
}

function getStatusLabel(code: CaseStatusCode): string {
	if (code === "completed") return "Ready";
	if (code === "failed") return "Action Required";
	if (code === "cancelled") return "Cancelled";
	return _getStatusLabel(code);
}

/** Get status badge based on detailed status code */
function getStatusBadge(code: CaseStatusCode | null, fallbackProgress: CaseHistoryProgress) {
	// If no status code yet, use fallback progress
	if (!code) {
		if (fallbackProgress === "completed") {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
					<span className="w-1.5 h-1.5 rounded-full bg-green-500" />
					Ready
				</span>
			);
		}
		if (fallbackProgress === "failed") {
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
					<svg
						className="w-3 h-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					Action Required
				</span>
			);
		}
		// Default processing state
		return (
			<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
				<svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle
						className="opacity-25"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						strokeWidth="4"
					/>
					<path
						className="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
					/>
				</svg>
				Processing
			</span>
		);
	}

	const label = getStatusLabel(code);

	switch (code) {
		case "completed":
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
					<span className="w-1.5 h-1.5 rounded-full bg-green-500" />
					{label}
				</span>
			);
		case "failed":
		case "cancelled":
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
					<svg
						className="w-3 h-3"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					{label}
				</span>
			);
		// All processing phases
		case "loading":
		case "classifying":
		case "extracting":
		case "validating":
		case "tier4":
		case "reextract":
		case "summary":
		default:
			return (
				<span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
					<svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						/>
					</svg>
					{label}
				</span>
			);
	}
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
}

/** Format name to title case (e.g., "JOHN DOE" -> "John Doe") */
function formatName(name: string): string {
	return name
		.toLowerCase()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

interface CaseRowProps {
	caseData: StoredCase;
	onRemove: (caseId: string) => Promise<void>;
	onClick: (caseId: string) => void;
}

/** Full-width banner for tenant limit exceeded cases */
function TenantLimitRow({
	caseData,
	onRemove,
	pageLimitInfo,
}: {
	caseData: StoredCase;
	onRemove: (caseId: string) => Promise<void>;
	pageLimitInfo: { totalPages: number; pageLimit: number };
}) {
	const handleContact = () => {
		const subject = encodeURIComponent("Page Limit Unlock Request");
		const body = encodeURIComponent(
			`Hi,\n\nMy case has ${pageLimitInfo.totalPages.toLocaleString()} pages ` +
				`and I'd like to unlock higher limits for my account.\n\n` +
				`Please let me know what options are available.\n\nThank you!`,
		);
		window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
	};

	return (
		<tr>
			<td colSpan={6} className="p-0">
				<div className="mx-4 my-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl px-5 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="flex items-center justify-center w-11 h-11 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full">
								<svg
									className="w-6 h-6 text-blue-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={1.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
									/>
								</svg>
							</div>
							<div>
								<h3 className="text-sm font-semibold text-slate-800">
									Need more pages? We've got you covered!
								</h3>
								<p className="text-sm text-slate-600 mt-0.5">
									Your case has{" "}
									<span className="font-medium text-blue-700">
										{pageLimitInfo.totalPages.toLocaleString()} pages
									</span>
									. Reach out and we'll help you unlock higher limits right away.
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={handleContact}
								className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
							>
								<Mail className="w-4 h-4" />
								Get in Touch
							</button>
							<button
								type="button"
								onClick={() => onRemove(caseData.case_id)}
								className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
								title="Dismiss"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			</td>
		</tr>
	);
}

function CaseRow({ caseData, onRemove, onClick }: CaseRowProps) {
	const [deleting, setDeleting] = useState(false);
	// Status comes from backend via /tenants/cases (single API call for whole table)
	// No per-row status polling needed - the cases list is invalidated on SSE complete
	const statusCode: CaseStatusCode | null = (caseData.status as CaseStatusCode) || null;

	// Borrower name comes from backend (batch fetched with cases list)
	// Falls back to '-' if not yet extracted
	const borrowerName = caseData.primary_borrower;

	const handleRemove = async (e: React.MouseEvent) => {
		e.stopPropagation();
		setDeleting(true);
		try {
			await onRemove(caseData.case_id);
		} catch {
			setDeleting(false);
		}
	};

	return (
		<tr
			onClick={() => onClick(caseData.case_id)}
			className={`hover:bg-slate-50 cursor-pointer transition-colors group ${deleting ? "opacity-50 pointer-events-none" : ""}`}
		>
			<td className="px-6 py-4">
				<span className="text-sm font-medium text-slate-900">
					{caseData.name || "Untitled Case"}
				</span>
			</td>
			<td className="px-6 py-4">
				<span className="text-sm text-slate-600">
					{borrowerName ? formatName(borrowerName) : "-"}
				</span>
			</td>
			<td className="px-6 py-4">{getStatusBadge(statusCode, caseData.progress)}</td>
			<td className="px-6 py-4">
				<span className="text-sm text-slate-600">{formatDate(caseData.timestamp)}</span>
			</td>
			<td className="px-6 py-4 text-center">
				<span className="text-sm text-slate-600">{caseData.document_count}</span>
			</td>
			<td className="px-6 py-4">
				<button
					type="button"
					onClick={handleRemove}
					disabled={deleting}
					className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
					title="Remove case"
				>
					{deleting ? (
						<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
					) : (
						<svg
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
					)}
				</button>
			</td>
		</tr>
	);
}

export function CasesTable({ cases, onRemove, onNewCase, onSamples }: CasesTableProps) {
	const navigate = useNavigate();
	const [currentPage, setCurrentPage] = useState(1);

	const totalPages = Math.ceil(cases.length / PAGE_SIZE);
	const startIndex = (currentPage - 1) * PAGE_SIZE;
	const endIndex = startIndex + PAGE_SIZE;
	const paginatedCases = cases.slice(startIndex, endIndex);

	const handleRowClick = (caseId: string) => {
		navigate(`/case/${caseId}`);
	};

	const handlePrevPage = () => {
		setCurrentPage((prev) => Math.max(1, prev - 1));
	};

	const handleNextPage = () => {
		setCurrentPage((prev) => Math.min(totalPages, prev + 1));
	};

	return (
		<div className="bg-white rounded-lg border border-slate-200 shadow-sm">
			{/* Header */}
			<div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-slate-900">My Cases</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onSamples}
						className="inline-flex items-center gap-2 px-4 py-2 border border-orange-500 text-orange-600 hover:bg-orange-50 text-sm font-medium rounded-lg transition-colors"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
						Samples
					</button>
					<button
						type="button"
						onClick={onNewCase}
						className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
					>
						<svg
							className="w-4 h-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
						</svg>
						New Case
					</button>
				</div>
			</div>

			{/* Table */}
			{cases.length === 0 ? (
				<div className="px-6 py-12 text-center">
					<p className="text-slate-500">No cases yet</p>
					<p className="text-sm text-slate-400 mt-1">Click "New Case" to get started</p>
				</div>
			) : (
				<>
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-slate-100">
									<th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
										Case
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
										Borrower
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
										Submitted
									</th>
									<th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
										Docs
									</th>
									<th className="px-6 py-3 w-10" />
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{paginatedCases.map((caseData) => {
									const pageLimitInfo = parsePageLimitError(caseData.error);
									if (pageLimitInfo) {
										return (
											<TenantLimitRow
												key={caseData.case_id}
												caseData={caseData}
												onRemove={onRemove}
												pageLimitInfo={pageLimitInfo}
											/>
										);
									}
									return (
										<CaseRow
											key={caseData.case_id}
											caseData={caseData}
											onRemove={onRemove}
											onClick={handleRowClick}
										/>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
							<p className="text-sm text-slate-500">
								Showing {startIndex + 1} to {Math.min(endIndex, cases.length)} of {cases.length}{" "}
								cases
							</p>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handlePrevPage}
									disabled={currentPage === 1}
									className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									Previous
								</button>
								<span className="text-sm text-slate-600">
									Page {currentPage} of {totalPages}
								</span>
								<button
									type="button"
									onClick={handleNextPage}
									disabled={currentPage === totalPages}
									className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									Next
								</button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}
