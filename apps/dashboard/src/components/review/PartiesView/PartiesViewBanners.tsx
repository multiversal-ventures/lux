import { XCircle } from "lucide-react";
import type { IncomeReadinessResponse } from "../../../hooks/useApi";
import type { ExtractedDocument } from "../../../types";
import { formatPartyName, getDocTypeDisplay } from "./partiesViewUtils";
import type { PartyWithId } from "./usePartiesViewState";

const WarningIcon = () => (
	<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
		/>
	</svg>
);

export interface PartiesViewBannersProps {
	readiness: IncomeReadinessResponse | null;
	potentialAmbiguities: Array<{
		last4: string;
		parties: Array<{ party: PartyWithId }>;
	}>;
	dismissedAmbiguities: Set<string>;
	getPartyDocuments: (party: PartyWithId) => ExtractedDocument[];
	onDismissAmbiguity: (last4: string) => void;
	onOpenMergeForAmbiguity: (sourceId: string, targetId: string) => void;
}

export function PartiesViewBanners({
	readiness,
	potentialAmbiguities,
	dismissedAmbiguities,
	getPartyDocuments,
	onDismissAmbiguity,
	onOpenMergeForAmbiguity,
}: PartiesViewBannersProps) {
	const visibleAmbiguities = potentialAmbiguities.filter((a) => !dismissedAmbiguities.has(a.last4));

	return (
		<>
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
							<WarningIcon />
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

			{visibleAmbiguities.length > 0 && (
				<div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
					<div className="flex items-start gap-3">
						<div className="shrink-0 mt-0.5">
							<WarningIcon />
						</div>
						<div className="flex-1">
							<h3 className="text-sm font-semibold text-amber-800">Please Review Party Mapping</h3>
							<p className="text-sm text-amber-700 mt-1">
								We detected parties with similar SSN identifiers. Please verify:
							</p>
							<div className="mt-3 space-y-3">
								{visibleAmbiguities.map(({ last4, parties: ambiguousParties }) => (
									<div key={last4} className="bg-white rounded-lg border border-amber-200 p-3">
										<div className="flex items-start justify-between gap-3">
											<div className="flex-1">
												<p className="text-sm font-medium text-amber-800">
													SSN ending in ***-**-{last4}
												</p>
												<div className="mt-2 space-y-1">
													{ambiguousParties.map(({ party }, idx) => {
														const docs = getPartyDocuments(party);
														return (
															<div
																key={`${party._id}-${idx}`}
																className="flex items-center gap-2 text-sm"
															>
																<span className="font-medium text-slate-700">
																	{formatPartyName(party.name)}
																</span>
																<span className="text-slate-400">—</span>
																<span className="text-slate-500">
																	{docs.length > 0
																		? docs.map((d) => getDocTypeDisplay(d.document_type)).join(", ")
																		: "No documents linked"}
																</span>
															</div>
														);
													})}
												</div>
											</div>
											<div className="flex flex-col gap-1.5">
												<button
													type="button"
													onClick={() => {
														if (ambiguousParties.length >= 2) {
															onOpenMergeForAmbiguity(
																ambiguousParties[1].party._id,
																ambiguousParties[0].party._id,
															);
														}
													}}
													className="px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors"
												>
													Same Person → Merge
												</button>
												<button
													type="button"
													onClick={() => onDismissAmbiguity(last4)}
													className="px-3 py-1.5 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors"
												>
													Different People ✓
												</button>
											</div>
										</div>
									</div>
								))}
							</div>
							<p className="text-xs text-amber-600 mt-3">
								<strong>Same Person?</strong> Click merge to combine them.{" "}
								<strong>Different People?</strong> Click to confirm they&apos;re correctly separate.
							</p>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
