/**
 * PublicRecordsTab - Public records summary with count-based display
 * Shows category counts prominently (0 = clear, 1+ = found with warning)
 */

import type { PublicRecord, PublicRecordStatus, PublicRecordType } from "./types";

interface PublicRecordsTabProps {
	records: PublicRecord[];
}

/** Category configuration for summary cards */
const CATEGORIES: { type: PublicRecordType; label: string }[] = [
	{ type: "BANKRUPTCY", label: "Bankruptcy" },
	{ type: "FORECLOSURE", label: "Foreclosure" },
	{ type: "JUDGMENT", label: "Judgments" },
	{ type: "COLLECTION", label: "Collections" },
	{ type: "TAX_LIEN", label: "Tax Liens" },
];

/** Get status display info */
function getStatusInfo(status: PublicRecordStatus): { label: string; color: string } {
	const info: Record<PublicRecordStatus, { label: string; color: string }> = {
		OPEN: { label: "Open", color: "bg-red-50 text-red-600 border-red-200" },
		CLOSED: { label: "Closed", color: "bg-slate-50 text-slate-600 border-slate-200" },
		DISCHARGED: { label: "Discharged", color: "bg-green-50 text-green-600 border-green-200" },
		DISMISSED: { label: "Dismissed", color: "bg-green-50 text-green-600 border-green-200" },
		SATISFIED: { label: "Satisfied", color: "bg-green-50 text-green-600 border-green-200" },
	};
	return info[status];
}

/** Warning triangle icon */
function WarningIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}

/** Category summary card */
function CategoryCard({
	label,
	count,
	hasIssues,
}: {
	label: string;
	count: number;
	hasIssues: boolean;
}) {
	if (hasIssues) {
		// Found items - white bg, red border
		return (
			<div className="flex flex-col gap-2 flex-1 min-w-[120px] bg-white rounded-lg p-4 text-center border border-red-300">
				<div className="text-sm font-medium text-slate-600">{label}</div>
				<div className="flex flex-1 items-center justify-center gap-1.5">
					<WarningIcon className="w-5 h-5 text-red-500" />
					<div className="text-sm flex items-center justify-center font-weight-bold text-red-500">
						Found
					</div>
					<span className="text-sm font-bold text-red-600">{count}</span>
				</div>
			</div>
		);
	}

	// Clear items - white bg, green border
	return (
		<div className="flex flex-col gap-[12px] flex-1 min-w-[120px] bg-white rounded-lg p-4 text-center border border-green-300">
			<div className="text-sm font-medium text-slate-600">{label}</div>
			<div className="text-sm flex items-center justify-center flex-1 font-weight-bold text-green-500">
				Clear
			</div>
		</div>
	);
}

/** Get record type label */
function getRecordTypeLabel(type: PublicRecordType): string {
	const labels: Record<PublicRecordType, string> = {
		BANKRUPTCY: "Bankruptcy",
		FORECLOSURE: "Foreclosure",
		JUDGMENT: "Judgment",
		COLLECTION: "Collection",
		TAX_LIEN: "Tax Lien",
	};
	return labels[type];
}

export function PublicRecordsTab({ records }: PublicRecordsTabProps) {
	// Guard against malformed data
	const safeRecords = Array.isArray(records) ? records : [];

	// Compute counts by type
	const countsByType = safeRecords.reduce<Record<string, number>>((acc, r) => {
		acc[r.type] = (acc[r.type] || 0) + 1;
		return acc;
	}, {});

	// Check if any issues exist
	const hasAnyRecords = safeRecords.length > 0;

	return (
		<div className="space-y-6">
			{/* Section Header */}
			<h3 className="text-base font-semibold text-slate-800">Public Records & Derogatory</h3>

			{/* Category Summary Cards */}
			<div className="flex flex-wrap gap-3">
				{CATEGORIES.map(({ type, label }) => {
					const count = countsByType[type] || 0;
					return <CategoryCard key={type} label={label} count={count} hasIssues={count > 0} />;
				})}
			</div>

			{/* Detailed Records List (only if there are records) */}
			{hasAnyRecords && (
				<div className="space-y-3 pt-2">
					{safeRecords.map((record, idx) => {
						const statusInfo = getStatusInfo(record.status);
						const isActive = record.status === "OPEN";
						const typeLabel = getRecordTypeLabel(record.type);

						return (
							<div
								key={idx}
								className={`bg-white rounded-lg border p-4 ${isActive ? "border-red-200" : "border-slate-200"}`}
							>
								<div className="flex items-start justify-between">
									<div className="flex items-start gap-3">
										<div className={`p-2 rounded-lg ${isActive ? "bg-red-100" : "bg-slate-100"}`}>
											<WarningIcon
												className={`w-5 h-5 ${isActive ? "text-red-500" : "text-slate-400"}`}
											/>
										</div>
										<div>
											<div className="flex items-center gap-2 flex-wrap">
												<span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-700">
													{typeLabel}
												</span>
												<span
													className={`px-2 py-0.5 text-xs font-medium rounded border ${statusInfo.color}`}
												>
													{statusInfo.label}
												</span>
											</div>
											<p className="text-sm text-slate-600 mt-1.5">
												{record.detail || `${typeLabel} record`}
											</p>
											<p className="text-xs text-slate-400 mt-1">
												Filed: {new Date(record.date).toLocaleDateString()}
											</p>
										</div>
									</div>
									{record.amount && (
										<div className="text-right shrink-0 ml-4">
											<span className="text-lg font-semibold text-slate-800">
												${record.amount.toLocaleString()}
											</span>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
