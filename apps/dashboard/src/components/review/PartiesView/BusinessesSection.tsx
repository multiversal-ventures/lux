import type { ExtractedDocument } from "../../../types";
import type { PartyWithId } from "./usePartiesViewState";
import type { PartyType } from "./partiesViewTypes";
import { BusinessEntityRow } from "./BusinessEntityRow";

export interface BusinessesSectionProps {
	businesses: PartyWithId[];
	showAllBusinesses: boolean;
	onToggleShowAll: () => void;
	recentlyMergedTargetId: string | null;
	getPartyDocuments: (party: PartyWithId) => ExtractedDocument[];
	getPartyType: (party: PartyWithId) => PartyType;
	onTogglePartyType: (partyId: string) => void;
}

export function BusinessesSection({
	businesses,
	showAllBusinesses,
	onToggleShowAll,
	recentlyMergedTargetId,
	getPartyDocuments,
	getPartyType,
	onTogglePartyType,
}: BusinessesSectionProps) {
	if (businesses.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
			<button
				type="button"
				onClick={onToggleShowAll}
				className="w-full px-4 py-3 bg-emerald-50 border-b border-emerald-200 hover:bg-emerald-100 transition-colors"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<svg
							className="w-5 h-5 text-emerald-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
							/>
						</svg>
						<h2 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">
							Legal Entities ({businesses.length})
						</h2>
						<span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded">
							Click to reclassify
						</span>
					</div>
					<svg
						className={`w-5 h-5 text-emerald-500 transition-transform ${
							showAllBusinesses ? "rotate-180" : ""
						}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</div>
			</button>
			{showAllBusinesses && (
				<div className="divide-y divide-slate-100">
					{businesses.map((biz, idx) => {
						const bizDocs = getPartyDocuments(biz);
						return (
							<div
								key={`${biz._id}-${idx}`}
								className={
									recentlyMergedTargetId === biz._id
										? "ring-2 ring-purple-500 ring-inset bg-purple-50 animate-pulse"
										: ""
								}
							>
								<BusinessEntityRow
									business={biz}
									docCount={bizDocs.length}
									getPartyType={getPartyType}
									onTogglePartyType={onTogglePartyType}
									compact={false}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
