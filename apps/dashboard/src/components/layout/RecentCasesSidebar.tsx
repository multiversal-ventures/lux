import { useParams } from "react-router-dom";
import { CaseHistory } from "../CaseHistory";
import { useCaseHistory } from "../../hooks";
import { useAppSelector, useAppDispatch } from "../../store";
import { toggleDocumentsSidebar } from "../../store/appSlice";

interface RecentCasesSidebarProps {
	/** Called when user clicks any case section (Review, Documents, Extraction, Parties, Income) – e.g. to collapse right Agent Log/Info panel */
	onCaseSectionClick?: () => void;
}

export function RecentCasesSidebar({ onCaseSectionClick }: RecentCasesSidebarProps = {}) {
	const { caseId: currentCaseId } = useParams<{ caseId?: string }>();
	const { cases, updateCaseName, removeCase } = useCaseHistory();
	const dispatch = useAppDispatch();
	const collapsed = useAppSelector((state) => state.app.documentsSidebarCollapsed);

	// Include all cases (including current case) - it will be highlighted
	if (cases.length === 0) {
		return null; // Don't show sidebar if no cases
	}

	if (collapsed) {
		return (
			<aside className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-4">
				<button
					type="button"
					onClick={() => dispatch(toggleDocumentsSidebar())}
					className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
					title="Expand sidebar"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
				</button>
			</aside>
		);
	}

	return (
		<aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-full">
			{/* Header - muted section label */}
			<div className="px-4 py-3 border-b border-slate-100">
				<div className="flex items-center justify-between">
					<h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Loan Cases</h2>
					<button
						type="button"
						onClick={() => dispatch(toggleDocumentsSidebar())}
						className="w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
						title="Collapse sidebar"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
							/>
						</svg>
					</button>
				</div>
				<p className="text-xs text-slate-400 mt-1">
					{cases.length} {cases.length === 1 ? "case" : "cases"}
				</p>
			</div>

			{/* Scrollable case list */}
			<div className="flex-1 overflow-y-auto px-3 py-3">
				<CaseHistory
					cases={cases}
					onUpdateName={updateCaseName}
					onRemove={removeCase}
					currentCaseId={currentCaseId} // Pass current case ID for highlighting
					showTimeHistory={false} // Hide time history on extraction/case page
					onCaseSectionClick={onCaseSectionClick}
				/>
			</div>
		</aside>
	);
}
