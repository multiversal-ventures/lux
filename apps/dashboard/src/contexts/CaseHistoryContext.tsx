import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
	useMemo,
	type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteCase } from "../hooks/useApi";
import { useTenantCases, useCasesStatusBatch, caseKeys } from "../hooks/useCaseQueries";
import { generateDefaultCaseName } from "../utils/caseNameUtils";
import { isOngoing } from "../lib/phases";

const STORAGE_KEY = "gunnr_case_history";
const MAX_CASES = 20;
const POLL_INTERVAL = 10000;

export type CaseProgress = "uploading" | "processing" | "completed" | "failed";

export interface StoredCase {
	case_id: string;
	name: string;
	timestamp: string;
	lastOpenedAt: string;
	document_count: number;
	progress: CaseProgress;
	// Status code from backend (e.g., 'loading', 'classifying', 'extracting', 'completed')
	// Used for detailed status display in the cases table
	status?: string;
	// Borrower info from backend (if available)
	primary_borrower?: string | null;
	borrower_count?: number;
	// Error message (e.g., PAGE_LIMIT_EXCEEDED|100|50)
	error?: string | null;
}

interface CaseHistoryContextValue {
	cases: StoredCase[];
	addCase: (caseId: string, documentCount: number, name?: string) => void;
	updateCaseName: (caseId: string, name: string) => void;
	updateCaseProgress: (caseId: string, progress: CaseProgress) => void;
	touchCase: (caseId: string) => void;
	removeCase: (caseId: string) => Promise<void>;
}

function loadCases(): StoredCase[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return [];
		const parsed = JSON.parse(stored);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((c: StoredCase) => ({
			...c,
			lastOpenedAt: c.lastOpenedAt || c.timestamp,
		}));
	} catch {
		return [];
	}
}

function saveCases(cases: StoredCase[]): void {
	try {
		const sorted = [...cases].sort((a, b) => {
			return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
		});
		const trimmed = sorted.slice(0, MAX_CASES);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
	} catch {
		// ignore
	}
}

const CaseHistoryContext = createContext<CaseHistoryContextValue | null>(null);

export function CaseHistoryProvider({ children }: { children: ReactNode }) {
	const [cases, setCases] = useState<StoredCase[]>(() => loadCases());
	const casesRef = useRef(cases);
	casesRef.current = cases;
	const queryClient = useQueryClient();

	// Fetch tenant cases via React Query (cached, deduplicated)
	const { data: backendCases } = useTenantCases({ limit: MAX_CASES, offset: 0 });

	// Non-final case IDs for status polling
	const nonFinalCaseIds = useMemo(
		() =>
			cases
				.filter((c) => c.progress === "uploading" || c.progress === "processing")
				.map((c) => c.case_id),
		[cases],
	);

	// Poll status for non-final cases via React Query (cached, deduplicated)
	const { data: statusBatch } = useCasesStatusBatch(nonFinalCaseIds, {
		enabled: nonFinalCaseIds.length > 0,
		refetchInterval: POLL_INTERVAL,
	});

	// Sync with localStorage from other tabs
	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				setCases(loadCases());
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	// Save to localStorage when cases change
	useEffect(() => {
		saveCases(cases);
	}, [cases]);

	// Sync with backend when React Query data arrives
	useEffect(() => {
		if (!backendCases || backendCases.length === 0) return;

		setCases((prevCases) => {
			const existingMap = new Map(prevCases.map((c) => [c.case_id, c]));
			return backendCases.map((backendCase) => {
				const existing = existingMap.get(backendCase.case_id);
				let progress: CaseProgress = "processing";
				if (backendCase.status === "completed") progress = "completed";
				else if (["failed", "cancelled"].includes(backendCase.status)) progress = "failed";
				else if (["pending", "uploading"].includes(backendCase.status)) progress = "uploading";
				return {
					case_id: backendCase.case_id,
					name: existing?.name || "",
					timestamp: backendCase.created_at,
					lastOpenedAt: existing?.lastOpenedAt || backendCase.last_updated,
					document_count: backendCase.file_count,
					progress,
					// Status code from backend (for detailed status display)
					status: backendCase.status,
					// Borrower info from backend
					primary_borrower: backendCase.primary_borrower,
					borrower_count: backendCase.borrower_count ?? 0,
					// Error message from backend (e.g., PAGE_LIMIT_EXCEEDED)
					error: backendCase.error,
				};
			});
		});
	}, [backendCases]);

	// Update progress when status batch arrives
	useEffect(() => {
		if (!statusBatch) return;

		const updates: Array<{ caseId: string; progress: CaseProgress }> = [];
		for (const c of casesRef.current.filter(
			(c) => c.progress === "uploading" || c.progress === "processing",
		)) {
			const status = statusBatch.statuses[c.case_id];
			if (!status) {
				if (c.progress !== "failed") updates.push({ caseId: c.case_id, progress: "failed" });
				continue;
			}
			const code = status.status.code;
			let newProgress: CaseProgress | null = null;
			if (code === "completed") newProgress = "completed";
			else if (["failed", "cancelled"].includes(code)) newProgress = "failed";
			else if (isOngoing(code)) newProgress = "processing";
			if (newProgress && newProgress !== c.progress) {
				updates.push({ caseId: c.case_id, progress: newProgress });
			}
		}
		if (updates.length > 0) {
			setCases((prev) =>
				prev.map((c) => {
					const u = updates.find((x) => x.caseId === c.case_id);
					return u ? { ...c, progress: u.progress } : c;
				}),
			);
		}
	}, [statusBatch]);

	const addCase = useCallback(
		(caseId: string, documentCount: number, name?: string) => {
			setCases((prev) => {
				if (prev.some((c) => c.case_id === caseId)) return prev;
				const now = new Date().toISOString();
				return [
					{
						case_id: caseId,
						name: name?.trim() || generateDefaultCaseName(prev),
						timestamp: now,
						lastOpenedAt: now,
						document_count: documentCount,
						progress: "uploading",
					},
					...prev,
				];
			});
			// Invalidate the tenant cases cache so the list is refetched
			queryClient.invalidateQueries({ queryKey: caseKeys.list });
		},
		[queryClient],
	);

	const updateCaseName = useCallback((caseId: string, name: string) => {
		setCases((prev) => prev.map((c) => (c.case_id === caseId ? { ...c, name } : c)));
	}, []);

	const updateCaseProgress = useCallback((caseId: string, progress: CaseProgress) => {
		setCases((prev) => prev.map((c) => (c.case_id === caseId ? { ...c, progress } : c)));
	}, []);

	const touchCase = useCallback((caseId: string) => {
		setCases((prev) => {
			const existing = prev.find((c) => c.case_id === caseId);
			if (existing) {
				return prev.map((c) =>
					c.case_id === caseId ? { ...c, lastOpenedAt: new Date().toISOString() } : c,
				);
			}
			const now = new Date().toISOString();
			return [
				{
					case_id: caseId,
					name: generateDefaultCaseName(prev),
					timestamp: now,
					lastOpenedAt: now,
					document_count: 0,
					progress: "processing",
				},
				...prev,
			];
		});
	}, []);

	const removeCase = useCallback(
		async (caseId: string) => {
			await deleteCase(caseId);
			setCases((prev) => prev.filter((c) => c.case_id !== caseId));
			// Invalidate the tenant cases cache so the list is refetched
			queryClient.invalidateQueries({ queryKey: caseKeys.list });
		},
		[queryClient],
	);

	const sortedCases = useMemo(
		() =>
			[...cases].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
		[cases],
	);

	const value = useMemo(
		() => ({
			cases: sortedCases,
			addCase,
			updateCaseName,
			updateCaseProgress,
			touchCase,
			removeCase,
		}),
		[sortedCases, addCase, updateCaseName, updateCaseProgress, touchCase, removeCase],
	);

	return <CaseHistoryContext.Provider value={value}>{children}</CaseHistoryContext.Provider>;
}

export function useCaseHistoryContext(): CaseHistoryContextValue {
	const ctx = useContext(CaseHistoryContext);
	if (!ctx) {
		throw new Error("useCaseHistory must be used within CaseHistoryProvider");
	}
	return ctx;
}
