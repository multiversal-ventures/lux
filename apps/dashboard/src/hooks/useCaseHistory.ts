/**
 * Hook for managing case history in localStorage.
 * Uses CaseHistoryContext - all consumers share the same state,
 * so updates (e.g. case name edit) propagate immediately to Loan Cases sidebar.
 */
export {
	useCaseHistoryContext as useCaseHistory,
	type StoredCase,
	type CaseProgress,
} from "../contexts/CaseHistoryContext";
