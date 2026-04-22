import type { CaseStatus, Tier4ReviewState } from "../../types";

interface ExtractionStatsProps {
	status: CaseStatus | null;
	reviewState: Tier4ReviewState;
}

export function ExtractionStats({ status, reviewState }: ExtractionStatsProps) {
	return (
		<div className="grid grid-cols-3 gap-4 mb-6">
			<StatCard
				label="Documents"
				value={status?.progress?.documents_found ?? reviewState.documentTypes.length}
				subtitle={
					reviewState.documentTypes.length > 0
						? reviewState.documentTypes.slice(0, 2).join(", ") +
							(reviewState.documentTypes.length > 2 ? "..." : "")
						: undefined
				}
				icon={
					<svg
						className="w-5 h-5 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				}
			/>
			<StatCard
				label="Pages"
				value={status?.progress?.pages_total ?? reviewState.totalPages}
				icon={
					<svg
						className="w-5 h-5 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
				}
			/>
			<StatCard
				label="Facts Extracted"
				value={status?.progress?.facts_extracted ?? reviewState.totalFacts}
				icon={
					<svg
						className="w-5 h-5 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
						/>
					</svg>
				}
			/>
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: number;
	subtitle?: string;
	icon?: React.ReactNode;
}

function StatCard({ label, value, subtitle, icon }: StatCardProps) {
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-4">
			<div className="flex items-start justify-between mb-2">
				<span className="text-sm text-slate-500">{label}</span>
				{icon}
			</div>
			<div className="text-3xl font-semibold text-slate-800">{value}</div>
			{subtitle && <div className="text-xs text-slate-400 truncate mt-1">{subtitle}</div>}
		</div>
	);
}
