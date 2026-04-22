import type { ExtractedDocument } from "../../../types";
import type { PartyWithId } from "./usePartiesViewState";
import type { BorrowerRole, PartyType } from "./partiesViewTypes";
import { Combine } from "lucide-react";
import { formatPartyName } from "./partiesViewUtils";
import { IndividualPartyRow } from "./IndividualPartyRow";

export interface IndividualsSectionProps {
	individuals: PartyWithId[];
	borrowerSelections: Map<string, BorrowerRole>;
	expandedParties: Set<string>;
	recentlyMergedTargetId: string | null;
	businessesByIndividual: Map<string, PartyWithId[]>;
	partiesNeedingReview: Set<string>;
	getPartyType: (party: PartyWithId) => PartyType;
	getPartyDocuments: (party: PartyWithId) => ExtractedDocument[];
	saving: boolean;
	saveError: string | null;
	selectionSaved: boolean;
	mergeSuccess: string | null;
	onSaveSelections: () => void;
	onRoleChange: (partyId: string, role: BorrowerRole) => void;
	onToggleExpanded: (partyId: string) => void;
	onTogglePartyType: (partyId: string) => void;
	onEdit: (partyId: string, currentName: string) => void;
	onMerge: (partyId: string) => void;
	onNavigateToDocument: (doc: ExtractedDocument) => void;
	onNavigateToSource: (fileId: string, page: number) => void;
}

export function IndividualsSection({
	individuals,
	borrowerSelections,
	expandedParties,
	recentlyMergedTargetId,
	businessesByIndividual,
	partiesNeedingReview,
	getPartyType,
	getPartyDocuments,
	saving,
	saveError,
	selectionSaved,
	mergeSuccess,
	onSaveSelections,
	onRoleChange,
	onToggleExpanded,
	onTogglePartyType,
	onEdit,
	onMerge,
	onNavigateToDocument,
	onNavigateToSource,
}: IndividualsSectionProps) {
	const borrowerCount = Array.from(borrowerSelections.values()).filter(
		(r) => r !== "ignore",
	).length;
	const hasPrimary = Array.from(borrowerSelections.values()).includes("primary");

	if (individuals.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
			<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<svg
							className="w-5 h-5 text-slate-600"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
						<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
							Individuals ({individuals.length})
						</h2>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-sm text-slate-500">
							{borrowerCount} borrower{borrowerCount !== 1 ? "s" : ""} selected
						</span>
						{saveError && <span className="text-sm text-red-600">{saveError}</span>}
						{selectionSaved && !saveError && (
							<span className="text-sm text-green-600 flex items-center gap-1">
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
								Saved
							</span>
						)}
						{mergeSuccess && (
							<span className="text-sm text-purple-600 flex items-center gap-1 animate-pulse">
								<Combine className="w-4 h-4" />
								{mergeSuccess}
							</span>
						)}
						<button
							type="button"
							onClick={onSaveSelections}
							disabled={saving || !hasPrimary}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
								saving
									? "bg-slate-200 text-slate-400 cursor-not-allowed"
									: !hasPrimary
										? "bg-amber-100 text-amber-600 border border-amber-300 cursor-not-allowed"
										: selectionSaved
											? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200 cursor-pointer"
											: "bg-action text-white hover:bg-action-hover cursor-pointer"
							}`}
						>
							{saving ? (
								<span className="flex items-center gap-2">
									<div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
									Saving...
								</span>
							) : selectionSaved ? (
								"Selection Saved"
							) : (
								"Save Selection"
							)}
						</button>
					</div>
				</div>
			</div>
			<div className="divide-y divide-slate-100">
				{individuals.map((party, idx) => (
					<IndividualPartyRow
						key={`${party._id}-${idx}`}
						party={party}
						partyDocs={getPartyDocuments(party)}
						isExpanded={expandedParties.has(party._id)}
						role={borrowerSelections.get(party._id) ?? "ignore"}
						getPartyType={getPartyType}
						needsReview={partiesNeedingReview.has(party._id)}
						recentlyMerged={recentlyMergedTargetId === party._id}
						nestedBusinesses={businessesByIndividual.get(party._id) ?? []}
						getPartyDocuments={getPartyDocuments}
						onToggleExpanded={() => onToggleExpanded(party._id)}
						onRoleChange={(role) => onRoleChange(party._id, role)}
						onTogglePartyType={onTogglePartyType}
						onEdit={() => onEdit(party._id, formatPartyName(party.name))}
						onMerge={() => onMerge(party._id)}
						onNavigateToDocument={onNavigateToDocument}
						onNavigateToSource={onNavigateToSource}
					/>
				))}
			</div>
		</div>
	);
}
