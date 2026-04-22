import { useState } from "react";
import type { StoredCase } from "../hooks/useCaseHistory";
import { CaseRow } from "./CaseRow";

interface CaseHistoryProps {
	cases: StoredCase[];
	onUpdateName: (caseId: string, name: string) => void;
	onRemove: (caseId: string) => Promise<void>;
	currentCaseId?: string; // Current case ID to highlight
	showTimeHistory?: boolean; // Whether to show time history (default: true)
	/** Called when user clicks any case section (Review, Documents, Extraction, Parties, Income, Credit) */
	onCaseSectionClick?: () => void;
}

export function CaseHistory({
	cases,
	onUpdateName,
	onRemove,
	currentCaseId,
	showTimeHistory = true,
	onCaseSectionClick,
}: CaseHistoryProps) {
	if (cases.length === 0) {
		return (
			<div className="text-center text-slate-400 text-sm py-8">
				<p>No cases yet</p>
				<p className="text-xs mt-1">Upload documents to get started</p>
			</div>
		);
	}

	// Get current case ID from URL if not provided as prop
	const resolvedCurrentCaseId =
		currentCaseId ||
		(() => {
			const currentPath = window.location.pathname;
			return currentPath.split("/case/")[1]?.split("/")[0];
		})();

	const [expandedCaseId, setExpandedCaseId] = useState<string | null>(
		() => resolvedCurrentCaseId ?? null,
	);

	return (
		<div className="space-y-1">
			{cases.map((caseData) => (
				<CaseRow
					key={caseData.case_id}
					caseData={caseData}
					onUpdateName={onUpdateName}
					onRemove={onRemove}
					currentCaseId={resolvedCurrentCaseId}
					showTimeHistory={showTimeHistory}
					isExpanded={expandedCaseId === caseData.case_id}
					onToggleExpand={() =>
						setExpandedCaseId((prev) => (prev === caseData.case_id ? null : caseData.case_id))
					}
					onCaseSectionClick={onCaseSectionClick}
				/>
			))}
		</div>
	);
}
