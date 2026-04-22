/**
 * BorrowerSelector - Tab-style selector for switching between borrowers
 */

import type { CreditReportData } from "./types";

interface BorrowerSelectorProps {
	borrowers: CreditReportData[];
	selectedId: string;
	onSelect: (borrowerId: string) => void;
}

/** Format borrower name */
function formatName(borrower: CreditReportData): string {
	const parts = [borrower.firstName, borrower.middleName, borrower.lastName].filter(Boolean);
	return parts.join(" ");
}

export function BorrowerSelector({ borrowers, selectedId, onSelect }: BorrowerSelectorProps) {
	if (borrowers.length <= 1) {
		return null;
	}

	// Sort borrowers: primary first (left), then co-borrowers
	const sortedBorrowers = [...borrowers].sort((a, b) => {
		if (a.role === "primary" && b.role !== "primary") return -1;
		if (a.role !== "primary" && b.role === "primary") return 1;
		return 0;
	});

	return (
		<div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
			{sortedBorrowers.map((borrower) => {
				const isSelected = borrower.borrowerId === selectedId;

				return (
					<button
						key={borrower.borrowerId}
						onClick={() => onSelect(borrower.borrowerId)}
						className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
							isSelected
								? "bg-slate-800 text-white shadow-sm"
								: "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
						}`}
					>
						{formatName(borrower)}
					</button>
				);
			})}
		</div>
	);
}
