import { type Borrower, BorrowerSelectionTable } from "../shared";

interface BorrowersTabProps {
	borrowers: Borrower[];
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
}

/**
 * BorrowersTab - Borrower selection for scenario refinement.
 *
 * Thin wrapper around the shared BorrowerSelectionTable component.
 */
export function BorrowersTab({ borrowers, selectedIds, onSelectionChange }: BorrowersTabProps) {
	return (
		<div className="space-y-4">
			<div>
				<h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
					Borrowers
				</h3>
			</div>
			<BorrowerSelectionTable
				borrowers={borrowers}
				selectedIds={selectedIds}
				onSelectionChange={onSelectionChange}
			/>
		</div>
	);
}

export default BorrowersTab;
