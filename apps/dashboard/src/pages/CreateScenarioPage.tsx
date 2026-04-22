/**
 * CreateScenarioPage - Full page for creating a new income scenario.
 *
 * Features:
 * - Approach selection (QM vs Non-QM)
 * - Loan product selection based on approach
 * - Borrower selection
 * - Document selection from case extractions
 * - Scenario note
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Building2, FileText, Upload, RefreshCw } from "lucide-react";
import { cancelWorkflows, type MortgageApproach } from "../hooks/useApi";
import {
	useCaseResult,
	useCaseStatus,
	useWorkflowStatus,
	useAdaptiveRefetchInterval,
	useCaseQueryInvalidation,
	useLoanProducts,
	useIncomeReadiness,
	useCreateScenarioMutation,
	caseKeys,
} from "../hooks/useCaseQueries";
import { UploadModal, DocumentCardSkeleton } from "../components/shared";
import { Warnings } from "../components/review/Warnings";
import { getDocClassInfo } from "../utils/docUtils";
import { X } from "lucide-react";
import type { ExtractedDocument } from "../types";
import { validateRequiredDocuments } from "../utils/scenarioDocumentValidation";

// Human-readable product names for error messages
const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
	fnma_selling_guide: "Fannie Mae",
	fhlmc_selling_guide: "Freddie Mac",
	fha_handbook: "FHA",
	usda_handbook: "USDA",
	va_handbook: "VA",
	non_qm_bank_statement: "Bank Statement",
	irs_1099_income: "1099 Income",
};

// Non-QM products
const NON_QM_PRODUCTS = [
	{ id: "non_qm_bank_statement", display_name: "Bank Statements", enabled: true },
	{ id: "irs_1099_income", display_name: "IRS 1099 Income", enabled: true },
	{ id: "dscr", display_name: "DSCR", enabled: false },
];

// Role display configuration - maps role/identity_type values to user-friendly display
const ROLE_DISPLAY: Record<string, { label: string; badgeClass: string; hint?: string }> = {
	// Person borrower roles (from borrower_role field)
	primary: { label: "Primary", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
	taxpayer: {
		label: "Primary",
		badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
		hint: "from 1040",
	},
	borrower: { label: "Borrower", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
	spouse: {
		label: "Co-Borrower",
		badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
		hint: "spouse",
	},
	co_borrower: {
		label: "Co-Borrower",
		badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
	},
	employee: { label: "Employee", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
	// 1099-NEC roles (payer/recipient from TIN fields)
	payer: {
		label: "Payer",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "1099",
	},
	recipient: {
		label: "Recipient",
		badgeClass: "bg-teal-100 text-teal-700 border-teal-200",
		hint: "1099",
	},
	// Business identity_type values (businesses use identity_type as their "role")
	employer: {
		label: "Employer",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "W-2",
	},
	sole_proprietorship: {
		label: "Self-Employment",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "Sch C",
	},
	partnership: {
		label: "Partnership",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "K-1",
	},
	scorp: {
		label: "S-Corp",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "K-1",
	},
	ccorp: {
		label: "C-Corp",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "1120",
	},
	farm: {
		label: "Farm",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "Sch F",
	},
	business: { label: "Business", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
	unknown: { label: "Unknown", badgeClass: "bg-slate-100 text-slate-500 border-slate-200" },
};

function getRoleDisplay(role: string) {
	return (
		ROLE_DISPLAY[role.toLowerCase()] ?? {
			label: role,
			badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
		}
	);
}

interface Borrower {
	id: string;
	name: string;
	role: string;
	type: string; // e.g., 'person', 'sole_proprietorship', 'partnership', 'business'
}

// Format identity type for display
function formatIdentityType(type: string): string {
	const typeMap: Record<string, string> = {
		person: "Individual",
		employer: "Employer",
		partnership: "Partnership",
		sole_proprietorship: "Sole Proprietorship",
		scorp: "S-Corp",
		ccorp: "C-Corp",
		farm: "Farm",
		business: "Business",
		unknown: "Unknown",
	};
	return typeMap[type?.toLowerCase()] || type || "Unknown";
}

// Check if identity type is a business type
function isBusinessType(type: string): boolean {
	const businessTypes = [
		"employer",
		"partnership",
		"sole_proprietorship",
		"scorp",
		"ccorp",
		"farm",
		"business",
	];
	return businessTypes.includes(type?.toLowerCase());
}

/** Polled case status can still show the last income-complete message while add-files extraction runs. */
function extractionOverlayMessage(statusMessage: string | undefined): string {
	const msg = (statusMessage ?? "").trim();
	if (
		/income verification complete/i.test(msg) ||
		/verification complete.*\/\s*mo/i.test(msg) ||
		(/complete/i.test(msg) && /\/\s*mo(nth)?/i.test(msg) && /\d/.test(msg))
	) {
		return "Extracting new documents from your upload...";
	}
	return msg || "Extracting new files...";
}

interface DocumentItem {
	id: string; // file_id + document_type
	fileId: string;
	documentType: string;
	displayName: string;
	source: string;
	pageCount: number;
	firstPageNumber: number; // For navigation to document viewer
	year: string | null;
	processedAt: string | null; // ISO timestamp from file processed_at
}

/**
 * Upload state machine - eliminates race conditions from multiple boolean states.
 *
 * States:
 * - idle: No upload in progress
 * - uploading: Files being uploaded to GCS (brief, handled by UploadModal)
 * - extracting: Extraction workflow running
 * - reviewing: Extraction complete, showing new documents for user to confirm
 */
type UploadPhase = "idle" | "extracting" | "reviewing";

interface UploadState {
	phase: UploadPhase;
	fileNames: string[]; // Names of files being processed
	previousDocIds: Set<string>; // Doc IDs before upload (to identify new ones)
}

export function CreateScenarioPage() {
	const { caseId } = useParams<{ caseId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const adaptiveRefetchInterval = useAdaptiveRefetchInterval();
	const { invalidateResult, invalidateStatus, invalidateWorkflows } = useCaseQueryInvalidation();
	const createScenarioMutation = useCreateScenarioMutation();

	// State
	const [approach, setApproach] = useState<MortgageApproach>("qualified_mortgage");
	const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
	const [selectedBorrowers, setSelectedBorrowers] = useState<string[]>([]);
	const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
	const [scenarioNote, setScenarioNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const isSubmitting = createScenarioMutation.isPending;

	// Unified upload state machine - replaces multiple boolean states
	const [uploadState, setUploadState] = useState<UploadState>({
		phase: "idle",
		fileNames: [],
		previousDocIds: new Set(),
	});
	// Document list: search and pagination
	const [docSearchClass, setDocSearchClass] = useState("");
	const [docSearchYear, setDocSearchYear] = useState<string>("");
	const [docPage, setDocPage] = useState(1);
	const docSelectAllRef = useRef<HTMLInputElement | null>(null);
	const borrowerSelectAllRef = useRef<HTMLInputElement | null>(null);
	// Borrower list filters
	const [borrowerSearchName, setBorrowerSearchName] = useState("");
	const [borrowerFilterRole, setBorrowerFilterRole] = useState<string>("");
	const [borrowerFilterType, setBorrowerFilterType] = useState<string>("");

	// Fetch case data
	const { data: caseResult, isLoading: caseLoading } = useCaseResult(caseId ?? "");
	const { data: readiness } = useIncomeReadiness(caseId ?? null, "fannie_mae", {
		enabled: !!caseId && !!caseResult,
	});

	// Poll faster when extracting (phase !== 'idle')
	const isExtracting = uploadState.phase === "extracting";

	// Fetch case status (for extraction running check)
	const { data: caseStatus } = useCaseStatus(caseId ?? "", {
		refetchInterval: isExtracting ? 2000 : adaptiveRefetchInterval,
	});

	// Check for running add-files workflows via the workflow status API
	const { data: workflowStatus } = useWorkflowStatus(caseId ?? "", {
		enabled: !!caseId,
		refetchInterval: isExtracting ? 2000 : adaptiveRefetchInterval,
	});

	// Check if an add-files workflow is running (from backend)
	const addFilesWorkflowRunning = useMemo(() => {
		if (!workflowStatus?.workflows) return false;
		return workflowStatus.workflows.some(
			(wf) => wf.workflow_type === "add_files" && wf.status === "running",
		);
	}, [workflowStatus]);

	// Derive UI states from upload state machine
	const showExtractionProgress = uploadState.phase === "extracting";
	const reviewingNewDocs = uploadState.phase === "reviewing";

	// DEBUG: Log upload state machine
	useEffect(() => {
		console.log("[UploadState]", {
			phase: uploadState.phase,
			fileNames: uploadState.fileNames,
			previousDocIdsCount: uploadState.previousDocIds.size,
			addFilesWorkflowRunning,
			showExtractionProgress,
			reviewingNewDocs,
		});
	}, [uploadState, addFilesWorkflowRunning, showExtractionProgress, reviewingNewDocs]);

	// Track previous workflow running state to detect completion
	const prevAddFilesRunningRef = useRef(false);

	// State machine transitions based on workflow status
	useEffect(() => {
		const wasRunning = prevAddFilesRunningRef.current;
		const isRunning = addFilesWorkflowRunning;
		prevAddFilesRunningRef.current = isRunning;

		console.log("[WorkflowTransition]", { wasRunning, isRunning, phase: uploadState.phase });

		// Workflow just completed: extracting → reviewing
		if (wasRunning && !isRunning && uploadState.phase === "extracting") {
			console.log("[WorkflowTransition] Workflow completed, refetching...");
			// Refresh case data and transition to review phase
			queryClient.refetchQueries({ queryKey: caseKeys.result(caseId!) }).then(() => {
				console.log("[WorkflowTransition] Refetch done, transitioning to reviewing");
				setUploadState((prev) => ({
					...prev,
					phase: "reviewing",
				}));
			});
		}
	}, [addFilesWorkflowRunning, uploadState.phase, queryClient, caseId]);

	// Fetch loan products
	const { data: loanProductsResponse, isLoading: productsLoading } = useLoanProducts({
		enabled: true,
	});

	// Extract borrowers from case
	const borrowers = useMemo<Borrower[]>(() => {
		if (!caseResult?.extractions?.financial_entities) return [];

		const entities = caseResult.extractions.financial_entities;
		const result: Borrower[] = [];

		// Individual borrowers
		for (const borrower of entities.borrowers ?? []) {
			result.push({
				id: borrower.ffi_id || borrower.display_name,
				name: borrower.display_name || borrower.canonical_name || "Unknown Borrower",
				role: borrower.borrower_role || "borrower",
				type: borrower.entity_type || "person",
			});
		}

		// Business entities - role IS the entity_type (identity_type from backend)
		// Businesses don't have borrower_role - their "role" is what they ARE (employer, sole_proprietorship, etc.)
		for (const business of entities.businesses ?? []) {
			const entityType = business.entity_type || "business";
			result.push({
				id: business.ffi_id || business.display_name,
				name: business.display_name || business.canonical_name || "Unknown Business",
				role: entityType, // Business role = identity_type
				type: entityType,
			});
		}

		return result;
	}, [caseResult]);

	// Unique roles from borrowers (for filter dropdown)
	const borrowerRoles = useMemo(() => {
		const roles = new Set(borrowers.map((b) => b.role).filter(Boolean));
		return Array.from(roles).sort();
	}, [borrowers]);

	// Unique types from borrowers (for filter dropdown)
	const borrowerTypes = useMemo(() => {
		const types = new Set(borrowers.map((b) => b.type).filter(Boolean));
		return Array.from(types).sort();
	}, [borrowers]);

	// Filter borrowers by name search, role, and type
	const filteredBorrowers = useMemo(() => {
		return borrowers.filter((b) => {
			const matchName =
				!borrowerSearchName.trim() ||
				b.name.toLowerCase().includes(borrowerSearchName.trim().toLowerCase());
			const matchRole = !borrowerFilterRole || b.role === borrowerFilterRole;
			const matchType = !borrowerFilterType || b.type === borrowerFilterType;
			return matchName && matchRole && matchType;
		});
	}, [borrowers, borrowerSearchName, borrowerFilterRole, borrowerFilterType]);

	// Extract documents from case - sorted by most recent first
	const documents = useMemo<DocumentItem[]>(() => {
		if (!caseResult?.extractions?.documents) return [];

		const files = caseResult.artifacts?.files ?? [];
		const fileMap = new Map(files.map((f) => [f.file_id, f]));

		const docs = caseResult.extractions.documents.map((doc: ExtractedDocument) => {
			const file = fileMap.get(doc.file_id);
			const { displayName } = getDocClassInfo(doc.document_type);
			const year = doc.effective_period?.period_end
				? new Date(doc.effective_period.period_end).getFullYear().toString()
				: null;

			// Always show the filename
			const source = file?.filename ?? "";

			// Get first page number for document viewer navigation
			const firstPageNumber =
				doc.pages?.length > 0 ? Math.min(...doc.pages.map((p) => p.page_number)) : 1;

			return {
				id: doc.id, // Use Memgraph doc_id for document filtering
				fileId: doc.file_id,
				documentType: doc.document_type,
				displayName: year ? `${year} ${displayName}` : displayName,
				source,
				pageCount: doc.pages?.length ?? 0,
				firstPageNumber,
				year,
				processedAt: file?.processed_at ?? null,
			};
		});

		// Sort by processedAt descending (most recent first)
		return docs.sort((a, b) => {
			if (!a.processedAt && !b.processedAt) return 0;
			if (!a.processedAt) return 1;
			if (!b.processedAt) return -1;
			return new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime();
		});
	}, [caseResult]);

	// Compute newly extracted documents (for review mode)
	const newDocuments = useMemo(() => {
		if (uploadState.previousDocIds.size === 0) return [];
		return documents.filter((d) => !uploadState.previousDocIds.has(d.id));
	}, [documents, uploadState.previousDocIds]);

	// DEBUG: Log documents state - shows what's being compared
	useEffect(() => {
		const previousIds = Array.from(uploadState.previousDocIds);
		const currentIds = documents.map((d) => d.id);
		const newIds = currentIds.filter((id) => !uploadState.previousDocIds.has(id));

		console.log("[Documents]", {
			totalCount: documents.length,
			newCount: newDocuments.length,
			previousIdsCount: previousIds.length,
			previousIds: previousIds.slice(0, 10),
			currentIds: currentIds.slice(0, 10),
			newIds, // IDs that are in current but not in previous
			phase: uploadState.phase,
		});
	}, [documents, newDocuments, uploadState]);

	// Track retry count for waiting for new documents
	const reviewRetryCountRef = useRef(0);
	const MAX_REVIEW_RETRIES = 3;

	// Auto-dismiss review mode if we can't identify new documents OR no new docs found
	// But give it a few retries since Memgraph writes may be delayed
	useEffect(() => {
		if (uploadState.phase !== "reviewing") {
			reviewRetryCountRef.current = 0; // Reset when not reviewing
			return;
		}

		// Case 1: previousDocIds was never captured - dismiss immediately
		if (uploadState.previousDocIds.size === 0 && documents.length > 0) {
			console.log("[UploadState] Auto-dismiss: no previousDocIds captured");
			setUploadState({ phase: "idle", fileNames: [], previousDocIds: new Set() });
			invalidateResult(caseId!);
			return;
		}

		// Case 2: No new documents detected - but wait and retry a few times
		if (newDocuments.length === 0 && documents.length > 0) {
			reviewRetryCountRef.current += 1;
			console.log("[UploadState] No new documents yet, retry:", reviewRetryCountRef.current);

			if (reviewRetryCountRef.current >= MAX_REVIEW_RETRIES) {
				console.log("[UploadState] Auto-dismiss: no new documents after retries");
				setUploadState({ phase: "idle", fileNames: [], previousDocIds: new Set() });
				invalidateResult(caseId!);
				return;
			}

			// Refetch and wait for new documents
			const timer = setTimeout(() => {
				console.log("[UploadState] Refetching case data, attempt:", reviewRetryCountRef.current);
				queryClient.refetchQueries({ queryKey: caseKeys.result(caseId!) });
			}, 2000); // Wait 2 seconds before refetching

			return () => clearTimeout(timer);
		}

		// New documents found - stay in reviewing mode
		if (newDocuments.length > 0) {
			console.log("[UploadState] New documents found:", newDocuments.length);
			reviewRetryCountRef.current = 0;
		}
	}, [
		uploadState.phase,
		uploadState.previousDocIds.size,
		documents.length,
		newDocuments.length,
		queryClient,
		caseId,
	]);

	const DOC_PAGE_SIZE = 5;

	// Unique years from documents (for search dropdown)
	const documentYears = useMemo(() => {
		const years = new Set(documents.map((d) => d.year).filter(Boolean)) as Set<string>;
		return Array.from(years).sort((a, b) => b.localeCompare(a));
	}, [documents]);

	// Filter documents by class (displayName/documentType) and year
	const filteredDocuments = useMemo(() => {
		return documents.filter((doc) => {
			const matchClass =
				!docSearchClass.trim() ||
				doc.displayName.toLowerCase().includes(docSearchClass.trim().toLowerCase()) ||
				doc.documentType.toLowerCase().includes(docSearchClass.trim().toLowerCase());
			const matchYear = !docSearchYear || doc.year === docSearchYear;
			return matchClass && matchYear;
		});
	}, [documents, docSearchClass, docSearchYear]);

	const totalDocPages = Math.max(1, Math.ceil(filteredDocuments.length / DOC_PAGE_SIZE));
	const paginatedDocuments = useMemo(() => {
		const start = (docPage - 1) * DOC_PAGE_SIZE;
		return filteredDocuments.slice(start, start + DOC_PAGE_SIZE);
	}, [filteredDocuments, docPage]);

	// Reset to page 1 when search changes
	useEffect(() => {
		setDocPage(1);
	}, [docSearchClass, docSearchYear]);

	// Header "select all" checkbox: indeterminate when some (not all) filtered are selected
	useEffect(() => {
		const el = docSelectAllRef.current;
		if (!el) return;
		const selectedInFiltered = filteredDocuments.filter((d) =>
			selectedDocuments.includes(d.id),
		).length;
		el.indeterminate = selectedInFiltered > 0 && selectedInFiltered < filteredDocuments.length;
	}, [filteredDocuments, selectedDocuments]);

	// Borrower header "select all" checkbox: indeterminate when some (not all) filtered selected
	useEffect(() => {
		const el = borrowerSelectAllRef.current;
		if (!el || filteredBorrowers.length === 0) return;
		const selectedInFiltered = filteredBorrowers.filter((b) =>
			selectedBorrowers.includes(b.id),
		).length;
		el.indeterminate = selectedInFiltered > 0 && selectedInFiltered < filteredBorrowers.length;
	}, [filteredBorrowers, selectedBorrowers]);

	// Get QM products from API (filter out Non-QM products)
	const qmProducts = useMemo(() => {
		const products = loanProductsResponse?.products ?? [];
		// Filter out Non-QM products (agency === 'NON_QM')
		return products.filter((p) => p.agency !== "NON_QM");
	}, [loanProductsResponse]);

	// Initialize selections when data loads (only on first load)
	useEffect(() => {
		if (borrowers.length > 0 && selectedBorrowers.length === 0) {
			setSelectedBorrowers(borrowers.map((b) => b.id));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [borrowers]);

	useEffect(() => {
		if (documents.length > 0 && selectedDocuments.length === 0) {
			setSelectedDocuments(documents.map((d) => d.id));
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [documents]);

	useEffect(() => {
		// Auto-select enabled products based on approach
		if (approach === "qualified_mortgage" && qmProducts.length > 0) {
			const enabled = qmProducts.filter((p) => p.enabled).map((p) => p.id);
			setSelectedProducts(enabled);
		} else if (approach === "non_qualified_mortgage") {
			// Auto-select first enabled Non-QM product (mutually exclusive)
			const first = NON_QM_PRODUCTS.find((p) => p.enabled);
			setSelectedProducts(first ? [first.id] : []);
		}
	}, [approach, qmProducts]);

	const toggleBorrower = useCallback((id: string) => {
		setSelectedBorrowers((prev) =>
			prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
		);
	}, []);

	const toggleDocument = useCallback((id: string) => {
		setSelectedDocuments((prev) =>
			prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
		);
	}, []);

	const toggleProduct = useCallback((id: string) => {
		setSelectedProducts((prev) => {
			if (prev.includes(id)) {
				return prev.filter((p) => p !== id);
			}
			// Non-QM products are mutually exclusive (bank_statement vs 1099)
			const isNonQm = NON_QM_PRODUCTS.some((p) => p.id === id);
			if (isNonQm) {
				return [id];
			}
			return [...prev, id];
		});
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!caseId) return;

		// FAIL FAST - validate all requirements before submission
		if (selectedBorrowers.length === 0) {
			setError("Please select at least one borrower");
			return;
		}
		if (selectedProducts.length === 0) {
			setError("Please select at least one loan product");
			return;
		}
		if (documents.length === 0) {
			setError("No documents available. Upload documents first.");
			return;
		}

		// Validate required documents for selected products
		const validation = validateRequiredDocuments(selectedProducts, documents);
		if (!validation.valid) {
			const missingNames = validation.missing
				.map((id) => PRODUCT_DISPLAY_NAMES[id] || id)
				.join(", ");
			setError(
				`Missing required documents for: ${missingNames}. Upload the required documents first.`,
			);
			return;
		}

		setError(null);

		try {
			const createResponse = await createScenarioMutation.mutateAsync({
				caseId,
				request: {
					approach,
					borrower_ids: selectedBorrowers,
					loan_product_ids: selectedProducts,
					document_ids: selectedDocuments, // Pass selected doc_ids for filtering
					note: scenarioNote.trim() || undefined,
				},
			});
			navigate(`/case/${caseId}/scenario/${createResponse.scenario_id}/summary?started=true`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create scenario");
		}
	}, [
		caseId,
		approach,
		selectedBorrowers,
		selectedProducts,
		selectedDocuments, // Critical: was missing - caused stale closure bug
		documents,
		scenarioNote,
		createScenarioMutation,
		navigate,
	]);

	// Non-QM is disabled only if no enabled products are selected
	const hasEnabledNonQmProducts = NON_QM_PRODUCTS.some((p) => p.enabled);
	const isNonQmDisabled = approach === "non_qualified_mortgage" && !hasEnabledNonQmProducts;

	// Validate required documents for selected products - FAIL FAST
	const { valid: hasRequiredDocs, missing: missingProductDocs } = useMemo(
		() => validateRequiredDocuments(selectedProducts, documents),
		[selectedProducts, documents],
	);

	// Build error message for missing docs
	const missingDocsError = useMemo(() => {
		if (hasRequiredDocs || missingProductDocs.length === 0) return null;

		const productNames = missingProductDocs.map((id) => PRODUCT_DISPLAY_NAMES[id] || id).join(", ");

		// Check what type of docs are missing
		const hasBankStatementMissing = missingProductDocs.includes("non_qm_bank_statement");
		const has1099Missing = missingProductDocs.includes("irs_1099_income");
		const hasQmMissing = missingProductDocs.some((id) =>
			[
				"fnma_selling_guide",
				"fhlmc_selling_guide",
				"fha_handbook",
				"usda_handbook",
				"va_handbook",
			].includes(id),
		);

		if (hasBankStatementMissing) {
			return "Bank Statement income requires bank statement documents. Upload bank statements to continue.";
		}
		if (has1099Missing) {
			return "1099 Income requires 1099 form documents (1099-MISC, 1099-NEC, or 1099-K).";
		}
		if (hasQmMissing) {
			return `Qualified Mortgage products (${productNames}) require W-2, tax returns, or schedule documents.`;
		}
		return `Missing required documents for: ${productNames}`;
	}, [hasRequiredDocs, missingProductDocs]);

	// Can run scenario - all conditions must be met
	const canRunScenario =
		!isSubmitting &&
		!showExtractionProgress &&
		!reviewingNewDocs &&
		!isNonQmDisabled &&
		selectedBorrowers.length > 0 &&
		selectedProducts.length > 0 &&
		selectedDocuments.length > 0 && // Must have selected documents
		hasRequiredDocs;

	// Handle upload complete - transition to extracting phase
	const handleUploadComplete = useCallback(
		(fileNames: string[]) => {
			// Capture current doc IDs to identify new ones after extraction
			const currentDocIds = new Set(documents.map((d) => d.id));

			console.log("[UploadComplete]", {
				fileNames,
				capturedDocIds: Array.from(currentDocIds),
				docCount: documents.length,
			});

			// Transition: idle → extracting
			setUploadState({
				phase: "extracting",
				fileNames,
				previousDocIds: currentDocIds,
			});

			// Refresh data
			invalidateResult(caseId!);
			invalidateStatus(caseId!);
			invalidateWorkflows(caseId!);
		},
		[caseId, documents, invalidateResult, invalidateStatus, invalidateWorkflows],
	);

	// Handle cancel extraction workflow - transition back to idle
	const handleCancelExtraction = useCallback(async () => {
		if (!caseId || isCanceling) return;
		setIsCanceling(true);
		try {
			await cancelWorkflows(caseId, ["AUEAddFilesWorkflow"]);
			// Reset to idle
			setUploadState({ phase: "idle", fileNames: [], previousDocIds: new Set() });
			invalidateStatus(caseId!);
			invalidateWorkflows(caseId!);
		} catch (err) {
			console.error("Failed to cancel workflow:", err);
		} finally {
			setIsCanceling(false);
		}
	}, [caseId, isCanceling, invalidateStatus, invalidateWorkflows]);

	// Handle confirming new documents - add to selection and return to idle
	const handleConfirmNewDocs = useCallback(() => {
		// Select all new documents
		setSelectedDocuments((prev) => {
			const newIds = newDocuments.map((d) => d.id);
			return Array.from(new Set([...prev, ...newIds]));
		});
		// Transition: reviewing → idle
		setUploadState({ phase: "idle", fileNames: [], previousDocIds: new Set() });
		// Force refetch so document validation and readiness checks see the new docs
		invalidateResult(caseId!);
	}, [newDocuments, caseId, invalidateResult]);

	// Handle dismissing new documents (skip review)
	const handleDismissNewDocs = useCallback(() => {
		// Transition: reviewing → idle (without selecting new docs)
		setUploadState({ phase: "idle", fileNames: [], previousDocIds: new Set() });
		// Force refetch so document validation and readiness checks see the new docs
		invalidateResult(caseId!);
	}, [caseId, invalidateResult]);

	if (caseLoading || productsLoading) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin text-slate-400" />
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 overflow-auto bg-slate-50">
			<div className="max-w-4xl mx-auto py-8 px-6 pb-24">
				{/* Header */}
				<div className="flex items-start justify-between mb-8">
					<div>
						<h1 className="text-2xl font-semibold text-slate-800">New Scenario</h1>
						<p className="text-sm text-slate-500 mt-1">
							Configure and run a new income calculation
						</p>
					</div>
				</div>

				{/* Approach Section */}
				<div className="mb-8">
					<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
						Approach
					</h2>
					<div className="grid grid-cols-2 gap-4">
						{/* Qualified Mortgage Card */}
						<button
							type="button"
							onClick={() => setApproach("qualified_mortgage")}
							disabled={isSubmitting}
							className={`p-4 rounded-lg border-2 text-left transition-all ${
								approach === "qualified_mortgage"
									? "border-amber-400 bg-amber-50"
									: "border-slate-200 bg-white hover:border-slate-300"
							} disabled:opacity-50`}
						>
							<h3 className="font-semibold text-slate-800">Qualified Mortgage</h3>
							<p className="text-sm text-slate-500 mt-1">Fannie Mae, Freddie Mac, FHA, USDA, VA</p>
						</button>

						{/* Non-Qualified Mortgage Card */}
						<button
							type="button"
							onClick={() => setApproach("non_qualified_mortgage")}
							disabled={isSubmitting}
							className={`p-4 rounded-lg border-2 text-left transition-all ${
								approach === "non_qualified_mortgage"
									? "border-amber-400 bg-amber-50"
									: "border-slate-200 bg-white hover:border-slate-300"
							} disabled:opacity-50`}
						>
							<h3 className="font-semibold text-slate-800">Non-Qualified Mortgage</h3>
							<p className="text-sm text-slate-500 mt-1">
								Bank Statements, IRS Forms (1099 etc), DSCR
							</p>
						</button>
					</div>
				</div>

				{/* Loan Products Section */}
				<div className="mb-8">
					<div className="bg-white rounded-lg border border-slate-200 p-4">
						<p className="text-sm text-slate-600 mb-3">
							{approach === "qualified_mortgage"
								? "All loan products will be run"
								: "Select Non-QM products to run"}
						</p>
						<div className="flex flex-wrap gap-2">
							{approach === "qualified_mortgage" ? (
								<>
									{qmProducts.map((product) => (
										<button
											key={product.id}
											type="button"
											onClick={() => product.enabled && toggleProduct(product.id)}
											disabled={!product.enabled || isSubmitting}
											className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
												selectedProducts.includes(product.id)
													? "bg-amber-100 border-amber-400 text-amber-800"
													: product.enabled
														? "bg-white border-slate-200 text-slate-600 hover:border-amber-300"
														: "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
											}`}
										>
											{product.display_name}
											{!product.enabled && (
												<span className="ml-1 text-xs text-slate-400">Soon</span>
											)}
										</button>
									))}
								</>
							) : (
								<>
									{NON_QM_PRODUCTS.map((product) => (
										<button
											key={product.id}
											type="button"
											onClick={() => product.enabled && toggleProduct(product.id)}
											disabled={!product.enabled || isSubmitting}
											className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
												selectedProducts.includes(product.id)
													? "bg-amber-100 border-amber-400 text-amber-800"
													: product.enabled
														? "bg-white border-slate-200 text-slate-600 hover:border-amber-300"
														: "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
											}`}
										>
											{product.display_name}
											{!product.enabled && (
												<span className="ml-1 text-xs text-slate-400">Soon</span>
											)}
										</button>
									))}
								</>
							)}
						</div>
					</div>
				</div>

				{/* Borrowers Section - table with bulk select and filters */}
				{borrowers.length > 0 && (
					<div className="mb-8">
						<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
							Borrowers
						</h2>
						{/* Filters: name search, Role, Type */}
						<div className="flex flex-wrap items-center gap-3 mb-3">
							<input
								type="text"
								value={borrowerSearchName}
								onChange={(e) => setBorrowerSearchName(e.target.value)}
								placeholder="Search by name..."
								className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
							/>
							<select
								value={borrowerFilterRole}
								onChange={(e) => setBorrowerFilterRole(e.target.value)}
								className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
							>
								<option value="">All roles</option>
								{borrowerRoles.map((role) => (
									<option key={role} value={role}>
										{getRoleDisplay(role).label}
									</option>
								))}
							</select>
							<select
								value={borrowerFilterType}
								onChange={(e) => setBorrowerFilterType(e.target.value)}
								className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
							>
								<option value="">All types</option>
								{borrowerTypes.map((type) => (
									<option key={type} value={type}>
										{formatIdentityType(type)}
									</option>
								))}
							</select>
						</div>
						<div className="flex items-center gap-2 mb-3">
							<button
								type="button"
								onClick={() => {
									const ids = filteredBorrowers.map((b) => b.id);
									setSelectedBorrowers((prev) => Array.from(new Set([...prev, ...ids])));
								}}
								disabled={isSubmitting}
								className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
							>
								Select all
							</button>
							<span className="text-slate-300">|</span>
							<button
								type="button"
								onClick={() => {
									const ids = new Set(filteredBorrowers.map((b) => b.id));
									setSelectedBorrowers((prev) => prev.filter((id) => !ids.has(id)));
								}}
								disabled={isSubmitting}
								className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
							>
								Deselect all
							</button>
							<span className="text-xs text-slate-500">
								(applies to {filteredBorrowers.length} filtered)
							</span>
						</div>
						<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
							{filteredBorrowers.length === 0 ? (
								<div className="px-4 py-6 text-center text-sm text-slate-500">
									No borrowers match the current filters.
								</div>
							) : (
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b border-slate-200 bg-slate-50">
											<th className="w-10 px-4 py-3 text-left">
												<input
													ref={borrowerSelectAllRef}
													type="checkbox"
													checked={filteredBorrowers.every((b) => selectedBorrowers.includes(b.id))}
													onChange={(e) => {
														if (e.target.checked) {
															const ids = filteredBorrowers.map((b) => b.id);
															setSelectedBorrowers((prev) =>
																Array.from(new Set([...prev, ...ids])),
															);
														} else {
															const ids = new Set(filteredBorrowers.map((b) => b.id));
															setSelectedBorrowers((prev) => prev.filter((id) => !ids.has(id)));
														}
													}}
													disabled={isSubmitting}
													className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
												/>
											</th>
											<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide">
												Name
											</th>
											<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide">
												Role
											</th>
											<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide">
												Type
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{filteredBorrowers.map((borrower) => (
											<tr
												key={borrower.id}
												className={`hover:bg-slate-50 transition-colors ${
													isSubmitting ? "opacity-50" : ""
												}`}
											>
												<td className="w-10 px-4 py-3">
													<input
														type="checkbox"
														checked={selectedBorrowers.includes(borrower.id)}
														onChange={() => toggleBorrower(borrower.id)}
														disabled={isSubmitting}
														className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
													/>
												</td>
												<td className="px-4 py-3 text-slate-800 font-medium">
													<span className="flex items-center gap-2">
														{isBusinessType(borrower.type) ? (
															<Building2 className="w-4 h-4 text-slate-400 shrink-0" />
														) : (
															<User className="w-4 h-4 text-slate-400 shrink-0" />
														)}
														{borrower.name}
													</span>
												</td>
												<td className="px-4 py-3">
													{(() => {
														const display = getRoleDisplay(borrower.role);
														return (
															<span
																className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${display.badgeClass}`}
															>
																{display.label}
																{display.hint && (
																	<span className="text-[10px] opacity-70">({display.hint})</span>
																)}
															</span>
														);
													})()}
												</td>
												<td className="px-4 py-3 text-slate-600">
													{formatIdentityType(borrower.type)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				)}

				{/* Documents Section */}
				<div className="mb-8">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
							Documents
						</h2>
						<button
							type="button"
							onClick={() => setShowUploadModal(true)}
							disabled={isSubmitting || showExtractionProgress}
							className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
						>
							<Upload className="w-4 h-4" />
							Upload New
						</button>
					</div>
					{/* Simple search: document class and year */}
					{documents.length > 0 && !showExtractionProgress && (
						<div className="flex flex-wrap items-center gap-3 mb-3">
							<input
								type="text"
								value={docSearchClass}
								onChange={(e) => setDocSearchClass(e.target.value)}
								placeholder="Filter by document class..."
								className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
							/>
							<select
								value={docSearchYear}
								onChange={(e) => setDocSearchYear(e.target.value)}
								className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
							>
								<option value="">All years</option>
								{documentYears.map((y) => (
									<option key={y} value={y}>
										{y}
									</option>
								))}
							</select>
						</div>
					)}
					{/* Bulk select: Select all / Deselect all (apply to filtered list) */}
					{filteredDocuments.length > 0 && !showExtractionProgress && (
						<div className="flex items-center gap-2 mb-3">
							<button
								type="button"
								onClick={() => {
									const ids = filteredDocuments.map((d) => d.id);
									setSelectedDocuments((prev) => Array.from(new Set([...prev, ...ids])));
								}}
								disabled={isSubmitting}
								className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
							>
								Select all
							</button>
							<span className="text-slate-300">|</span>
							<button
								type="button"
								onClick={() => {
									const ids = new Set(filteredDocuments.map((d) => d.id));
									setSelectedDocuments((prev) => prev.filter((id) => !ids.has(id)));
								}}
								disabled={isSubmitting}
								className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
							>
								Deselect all
							</button>
							<span className="text-xs text-slate-500">
								(applies to {filteredDocuments.length} filtered)
							</span>
						</div>
					)}
					<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
						{/* Show extraction progress when running */}
						{showExtractionProgress && (
							<div className="px-4 py-4">
								{/* Header with status and cancel button */}
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<Loader2 className="w-4 h-4 animate-spin text-amber-600" />
										<span className="text-sm font-medium text-amber-700">
											{extractionOverlayMessage(caseStatus?.message)}
										</span>
									</div>
									<button
										onClick={handleCancelExtraction}
										disabled={isCanceling}
										className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
										title="Cancel extraction"
									>
										<X className="w-3.5 h-3.5" />
										{isCanceling ? "Canceling..." : "Cancel"}
									</button>
								</div>
								{/* Progress bar */}
								{caseStatus?.progress?.percent !== undefined && (
									<div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-3">
										<div
											className="h-full bg-amber-500 rounded-full transition-all duration-300"
											style={{ width: `${caseStatus.progress.percent}%` }}
										/>
									</div>
								)}
								{/* Show uploaded file names with skeleton */}
								<div className="space-y-2">
									{uploadState.fileNames.length > 0 ? (
										uploadState.fileNames.map((filename: string, idx: number) => (
											<div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
												<FileText className="w-5 h-5 text-amber-500 animate-pulse" />
												<div className="flex-1 min-w-0">
													<span className="text-sm font-medium text-slate-700 truncate block">
														{filename}
													</span>
													<span className="text-xs text-slate-500">Extracting documents...</span>
												</div>
											</div>
										))
									) : (
										<>
											<DocumentCardSkeleton />
											<DocumentCardSkeleton />
										</>
									)}
								</div>
							</div>
						)}
						{/* Review new documents after extraction */}
						{reviewingNewDocs && newDocuments.length > 0 && (
							<div className="px-4 py-4">
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<FileText className="w-4 h-4 text-green-600" />
										<span className="text-sm font-medium text-green-700">
											{newDocuments.length} new document{newDocuments.length > 1 ? "s" : ""}{" "}
											extracted
										</span>
									</div>
									<div className="flex items-center gap-2">
										<button
											onClick={handleDismissNewDocs}
											className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
										>
											Skip
										</button>
										<button
											onClick={handleConfirmNewDocs}
											className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
										>
											Add to scenario
										</button>
									</div>
								</div>
								<div className="space-y-2">
									{newDocuments.map((doc) => {
										const docTypeLabel = getDocClassInfo(doc.documentType).displayName;
										return (
											<div
												key={doc.id}
												className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg"
											>
												<input
													type="checkbox"
													checked={selectedDocuments.includes(doc.id)}
													onChange={() => toggleDocument(doc.id)}
													className="rounded border-green-300 text-green-600 focus:ring-green-500"
												/>
												<div className="flex-1 min-w-0">
													<span className="text-sm font-medium text-slate-700 block">
														{doc.year ? `${doc.year} ` : ""}
														{docTypeLabel}
													</span>
													<span className="text-xs text-slate-500 truncate block">
														{doc.source}
													</span>
												</div>
												<span className="text-xs text-slate-400">{doc.pageCount}p</span>
											</div>
										);
									})}
								</div>
							</div>
						)}
						{/* Table: Year | Doc type | File name + paginated rows */}
						{/* Show table when: not extracting AND (not reviewing OR reviewing but waiting for new docs) */}
						{documents.length === 0 && !showExtractionProgress ? (
							<div className="px-4 py-8 text-center text-sm text-slate-500">
								No documents found. Upload documents to continue.
							</div>
						) : (
							!showExtractionProgress &&
							(!reviewingNewDocs || newDocuments.length === 0) && (
								<>
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-slate-200 bg-slate-50">
												<th className="w-10 px-4 py-3 text-left">
													<input
														ref={docSelectAllRef}
														type="checkbox"
														checked={
															filteredDocuments.length > 0 &&
															filteredDocuments.every((d) => selectedDocuments.includes(d.id))
														}
														onChange={(e) => {
															if (e.target.checked) {
																const ids = filteredDocuments.map((d) => d.id);
																setSelectedDocuments((prev) =>
																	Array.from(new Set([...prev, ...ids])),
																);
															} else {
																const ids = new Set(filteredDocuments.map((d) => d.id));
																setSelectedDocuments((prev) => prev.filter((id) => !ids.has(id)));
															}
														}}
														disabled={isSubmitting}
														className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
													/>
												</th>
												<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide">
													Year
												</th>
												<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide">
													Doc type
												</th>
												<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide min-w-0">
													File Name
												</th>
												<th className="w-16 px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wide">
													View
												</th>
												<th className="px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wide">
													Processed
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-slate-100">
											{paginatedDocuments.map((doc) => {
												const docTypeLabel = getDocClassInfo(doc.documentType).displayName;
												// Format processedAt as relative time or short date
												let processedLabel = "—";
												if (doc.processedAt) {
													const date = new Date(doc.processedAt);
													const now = new Date();
													const diffMs = now.getTime() - date.getTime();
													const diffMins = Math.floor(diffMs / 60000);
													const diffHours = Math.floor(diffMs / 3600000);
													const diffDays = Math.floor(diffMs / 86400000);

													if (diffMins < 1) processedLabel = "Just now";
													else if (diffMins < 60) processedLabel = `${diffMins}m ago`;
													else if (diffHours < 24) processedLabel = `${diffHours}h ago`;
													else if (diffDays < 7) processedLabel = `${diffDays}d ago`;
													else processedLabel = date.toLocaleDateString();
												}
												return (
													<tr
														key={doc.id}
														className={`hover:bg-slate-50 transition-colors ${
															isSubmitting ? "opacity-50" : ""
														}`}
													>
														<td className="w-10 px-4 py-3">
															<input
																type="checkbox"
																checked={selectedDocuments.includes(doc.id)}
																onChange={() => toggleDocument(doc.id)}
																disabled={isSubmitting}
																className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
															/>
														</td>
														<td className="px-4 py-3 text-slate-700">{doc.year ?? "—"}</td>
														<td className="px-4 py-3 text-slate-800">{docTypeLabel}</td>
														<td
															className="px-4 py-3 text-slate-600 truncate max-w-[200px]"
															title={doc.source || undefined}
														>
															{doc.source || "—"}
														</td>
														<td className="px-4 py-3 text-center">
															<a
																href={`/case/${caseId}/view?file=${doc.fileId}&page=${doc.firstPageNumber}`}
																target="_blank"
																rel="noopener noreferrer"
																className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
																title={`View document (${doc.pageCount} pages)`}
																onClick={(e) => e.stopPropagation()}
															>
																<svg
																	className="w-4 h-4"
																	fill="none"
																	viewBox="0 0 24 24"
																	stroke="currentColor"
																>
																	<path
																		strokeLinecap="round"
																		strokeLinejoin="round"
																		strokeWidth={2}
																		d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
																	/>
																</svg>
															</a>
														</td>
														<td className="px-4 py-3 text-right text-slate-400 text-xs">
															{processedLabel}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
									{/* Pagination */}
									{totalDocPages > 1 && (
										<div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100">
											<span className="text-sm text-slate-600">
												{(docPage - 1) * DOC_PAGE_SIZE + 1}–
												{Math.min(docPage * DOC_PAGE_SIZE, filteredDocuments.length)} of{" "}
												{filteredDocuments.length}
											</span>
											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => setDocPage((p) => Math.max(1, p - 1))}
													disabled={docPage <= 1}
													className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													Previous
												</button>
												<span className="text-sm text-slate-600">
													Page {docPage} of {totalDocPages}
												</span>
												<button
													type="button"
													onClick={() => setDocPage((p) => Math.min(totalDocPages, p + 1))}
													disabled={docPage >= totalDocPages}
													className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
												>
													Next
												</button>
											</div>
										</div>
									)}
								</>
							)
						)}
					</div>
				</div>

				{/* Scenario Note Section */}
				<div className="mb-8">
					<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
						Scenario Note
					</h2>
					<textarea
						value={scenarioNote}
						onChange={(e) => setScenarioNote(e.target.value)}
						placeholder="Describe the rationale for this scenario configuration..."
						disabled={isSubmitting}
						rows={3}
						className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 resize-none"
					/>
				</div>

				{/* Income Readiness Warnings */}
				<Warnings blockingIssues={readiness?.blocking_issues} warnings={readiness?.warnings} />

				{/* Sticky footer: warnings + Run Scenario always in view */}
				<div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 py-3 mt-6 bg-slate-50/95 backdrop-blur border-t border-slate-200 z-10">
					<div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
						<div className="min-w-0 flex-1">
							{(missingDocsError && !showExtractionProgress) || error ? (
								<p className="text-sm text-red-700">
									{missingDocsError && !showExtractionProgress ? missingDocsError : error}
								</p>
							) : (
								<p className="text-sm text-slate-600">
									{selectedDocuments.length} document{selectedDocuments.length !== 1 ? "s" : ""}{" "}
									selected
								</p>
							)}
						</div>
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!canRunScenario}
							className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
						>
							{isSubmitting ? (
								<>
									<Loader2 className="w-4 h-4 animate-spin" />
									Creating...
								</>
							) : (
								<>
									<RefreshCw className="w-4 h-4" />
									Run Scenario
								</>
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Upload Modal */}
			<UploadModal
				caseId={caseId ?? ""}
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				onUploadComplete={handleUploadComplete}
			/>
		</div>
	);
}
