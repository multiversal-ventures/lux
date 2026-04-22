import { ArrowLeft } from "lucide-react";
import { BusinessesSection } from "./BusinessesSection";
import { EditNameModal } from "./EditNameModal";
import { IndividualsSection } from "./IndividualsSection";
import { MergePartiesModal } from "./MergePartiesModal";
import { PartiesSummaryCard } from "./PartiesSummaryCard";
import { PartiesViewEmpty } from "./PartiesViewEmpty";
import { usePartiesViewState } from "./usePartiesViewState";

export interface PartiesViewProps {
	result: Parameters<typeof usePartiesViewState>[0]["result"];
	caseId: string;
	onSelectionSaved?: () => void;
	onRefresh?: () => void;
	onClose?: () => void;
}

/**
 * PartiesView - Parties-only content for ReviewView.
 * Displays parties, role selection, merge, edit, save selection.
 */
export function PartiesView({
	result,
	caseId,
	onSelectionSaved,
	onRefresh,
	onClose,
}: PartiesViewProps) {
	const state = usePartiesViewState({
		result,
		caseId,
		onSelectionSaved,
		onRefresh,
	});

	if (!result) {
		return <PartiesViewEmpty type="loading" />;
	}

	if (state.parties.length === 0) {
		return <PartiesViewEmpty type="no-parties" readiness={state.readiness} />;
	}

	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-4xl mx-auto">
				<div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
					<div className="flex items-center justify-between">
						<h1 className="text-xl font-semibold text-slate-800">Parties</h1>
						{onClose && (
							<button
								type="button"
								onClick={onClose}
								className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
							>
								<ArrowLeft className="w-4 h-4" />
								Back
							</button>
						)}
					</div>

					<IndividualsSection
						individuals={state.individuals}
						borrowerSelections={state.borrowerSelections}
						expandedParties={state.expandedParties}
						recentlyMergedTargetId={state.recentlyMergedTargetId}
						businessesByIndividual={state.businessesByIndividual}
						partiesNeedingReview={state.partiesNeedingReview}
						getPartyType={state.getPartyType}
						getPartyDocuments={state.getPartyDocuments}
						saving={state.saving}
						saveError={state.saveError}
						selectionSaved={state.selectionSaved}
						mergeSuccess={state.mergeSuccess}
						onSaveSelections={state.handleSaveSelections}
						onRoleChange={state.handleRoleChange}
						onToggleExpanded={state.toggleExpanded}
						onTogglePartyType={state.togglePartyType}
						onEdit={state.openEditModal}
						onMerge={state.openMergeModal}
						onNavigateToDocument={state.navigateToDocument}
						onNavigateToSource={state.navigateToSource}
					/>

					<BusinessesSection
						businesses={state.businesses}
						showAllBusinesses={state.showAllBusinesses}
						onToggleShowAll={() => state.setShowAllBusinesses(!state.showAllBusinesses)}
						recentlyMergedTargetId={state.recentlyMergedTargetId}
						getPartyDocuments={state.getPartyDocuments}
						getPartyType={state.getPartyType}
						onTogglePartyType={state.togglePartyType}
					/>

					<PartiesSummaryCard
						individualsCount={state.individuals.length}
						businessesCount={state.businesses.length}
						documentsCount={state.documents.length}
					/>
				</div>
			</div>

			<MergePartiesModal
				open={state.showMergeModal}
				sourceId={state.mergeSourceId}
				targetId={state.mergeTargetId}
				newName={state.mergeNewName}
				parties={state.parties}
				merging={state.merging}
				error={state.mergeError}
				onTargetChange={state.setMergeTargetId}
				onNewNameChange={state.setMergeNewName}
				onClose={() => state.setShowMergeModal(false)}
				onConfirm={state.handleMerge}
			/>

			<EditNameModal
				open={!!state.editingPartyId}
				name={state.editName}
				saving={state.editingSaving}
				error={state.editError}
				onNameChange={state.setEditName}
				onClose={() => state.setEditingPartyId(null)}
				onSave={state.handleEditName}
			/>
		</div>
	);
}
