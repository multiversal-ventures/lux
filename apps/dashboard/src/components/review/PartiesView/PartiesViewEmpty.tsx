import { XCircle } from "lucide-react";
import type { IncomeReadinessResponse } from "../../../hooks/useApi";

const PeopleIcon = () => (
	<svg
		className="w-16 h-16 mx-auto mb-4 opacity-50"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={1.5}
			d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
		/>
	</svg>
);

export type PartiesViewEmptyType = "loading" | "no-parties";

export interface PartiesViewEmptyProps {
	type: PartiesViewEmptyType;
	readiness?: IncomeReadinessResponse | null;
}

export function PartiesViewEmpty({ type, readiness }: PartiesViewEmptyProps) {
	if (type === "loading") {
		return (
			<div className="h-full flex items-center justify-center text-slate-400">
				<div className="text-center">
					<PeopleIcon />
					<p className="text-lg font-medium">Loading parties...</p>
				</div>
			</div>
		);
	}

	const hasReviewItems =
		(readiness?.blocking_issues?.length ?? 0) > 0 || (readiness?.warnings?.length ?? 0) > 0;

	return (
		<div
			className={
				hasReviewItems
					? "h-full overflow-auto p-6"
					: "h-full flex items-center justify-center text-slate-400"
			}
		>
			{hasReviewItems ? (
				<div className="max-w-4xl mx-auto space-y-6">
					{readiness?.blocking_issues && readiness.blocking_issues.length > 0 && (
						<div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
							<div className="flex items-start gap-3">
								<div className="shrink-0 mt-0.5">
									<XCircle className="w-5 h-5 text-rose-600" />
								</div>
								<div>
									<h3 className="text-sm font-semibold text-rose-800">Review Required</h3>
									<p className="text-sm text-rose-700 mt-0.5">
										Income verification is blocked. Upload missing documents to proceed.
									</p>
									<ul className="mt-2 space-y-1">
										{readiness.blocking_issues.map((issue, i) => (
											<li key={i} className="flex items-center gap-2 text-sm text-rose-700">
												<span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
												{issue}
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					)}

					{readiness?.warnings && readiness.warnings.length > 0 && (
						<div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
							<div className="flex items-start gap-3">
								<div className="shrink-0 mt-0.5">
									<svg
										className="w-5 h-5 text-amber-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
								</div>
								<div>
									<h3 className="text-sm font-semibold text-amber-800">Warnings</h3>
									<ul className="mt-1 space-y-1">
										{readiness.warnings.map((warning, i) => (
											<li key={i} className="flex items-center gap-2 text-sm text-amber-700">
												<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
												{warning}
											</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					)}

					<div className="flex items-center justify-center text-slate-400 py-12">
						<div className="text-center">
							<PeopleIcon />
							<p className="text-lg font-medium">No parties identified</p>
							<p className="text-sm mt-1">Parties are extracted from uploaded documents</p>
						</div>
					</div>
				</div>
			) : (
				<div className="text-center">
					<PeopleIcon />
					<p className="text-lg font-medium">No parties identified</p>
					<p className="text-sm mt-1">Parties are extracted from uploaded documents</p>
				</div>
			)}
		</div>
	);
}
