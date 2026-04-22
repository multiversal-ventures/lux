import { APIError } from "./client.js";
import { apiFetch, apiFetchRoot } from "./gunnr-http.js";
import type {
	CaseResult,
	CaseStatus,
	SourceRef,
	StreamEvent,
	UploadResponse,
} from "./gunnr-types.js";
import { getDefaultClient, getLuxToken } from "./runtime.js";

const BASE_URL = "/api/v1";

/**
 * Upload files and start extraction with progress tracking.
 * Uses authenticated upload from lib/api.ts
 */
export async function uploadFiles(
	files: FileList | File[],
	onProgress?: (progress: number) => void,
): Promise<UploadResponse> {
	const formData = new FormData();
	for (const file of files) {
		formData.append("files", file);
	}

	return new Promise(async (resolve, reject) => {
		const xhr = new XMLHttpRequest();

		const token = await getLuxToken();
		if (token) {
			xhr.setRequestHeader("Authorization", `Bearer ${token}`);
		}

		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable && onProgress) {
				const progress = Math.round((e.loaded / e.total) * 100);
				onProgress(progress);
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					const result = JSON.parse(xhr.responseText);
					resolve(result);
				} catch {
					reject(new Error("Invalid JSON response"));
				}
			} else {
				try {
					const err = JSON.parse(xhr.responseText);
					reject(new Error(err.detail || `HTTP ${xhr.status}`));
				} catch {
					reject(new Error(`HTTP ${xhr.status}`));
				}
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error("Network error"));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload cancelled"));
		});

		xhr.open("POST", getDefaultClient().resolvePath(`${BASE_URL}/case/upload`));
		xhr.send(formData);
	});
}

// =============================================================================
// DIRECT GCS UPLOAD (Optimized Flow)
// =============================================================================
//
// New upload flow that bypasses API server:
// 1. prepareUpload() - get signed URLs from API
// 2. uploadToSignedUrl() - upload directly to GCS (parallel)
// 3. startCase() - notify API to start processing
//
// This is much faster than the legacy uploadFiles() for large files.

export interface PrepareUploadFile {
	filename: string;
	size: number;
}

export interface UploadUrlInfo {
	file_id: string;
	filename: string;
	gcs_path: string;
	upload_url: string;
	content_type: string;
}

export interface PrepareUploadResponse {
	case_id: string;
	upload_urls: UploadUrlInfo[];
	expires_in_seconds: number;
}

/**
 * Step 1: Get signed URLs for direct upload to GCS.
 */
export async function prepareUpload(files: PrepareUploadFile[]): Promise<PrepareUploadResponse> {
	return apiFetch<PrepareUploadResponse>("/case/prepare-upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ files }),
	});
}

/**
 * Step 2: Upload a single file directly to GCS using signed URL.
 * Returns the upload URL info for use in step 3.
 */
export async function uploadToSignedUrl(
	file: File,
	urlInfo: UploadUrlInfo,
	onProgress?: (progress: number) => void,
): Promise<UploadUrlInfo> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener("progress", (e) => {
			if (e.lengthComputable && onProgress) {
				const progress = Math.round((e.loaded / e.total) * 100);
				onProgress(progress);
			}
		});

		xhr.addEventListener("load", () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				resolve(urlInfo);
			} else {
				reject(new Error(`Upload failed: HTTP ${xhr.status}`));
			}
		});

		xhr.addEventListener("error", () => {
			reject(new Error(`Network error uploading ${file.name}`));
		});

		xhr.addEventListener("abort", () => {
			reject(new Error("Upload cancelled"));
		});

		xhr.open("PUT", urlInfo.upload_url);
		xhr.setRequestHeader("Content-Type", urlInfo.content_type);
		xhr.send(file);
	});
}

export interface StartCaseRequest {
	files: UploadUrlInfo[];
	include_chunks?: boolean;
	include_page_images?: boolean;
	max_concurrency?: number;
	// Optional: Run income verification automatically after extraction
	loan_product_ids?: string[]; // e.g., ["bank_statement", "irs_1099_income"]
	calculation_track?: string; // e.g., "non_qm_bank_statement"
}

/**
 * Step 3: Start case processing after files uploaded to GCS.
 */
export async function startCase(
	caseId: string,
	request: StartCaseRequest,
): Promise<UploadResponse> {
	return apiFetch<UploadResponse>(`/case/${caseId}/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

export interface DirectUploadProgress {
	phase: "preparing" | "uploading" | "starting";
	totalFiles: number;
	completedFiles: number;
	currentFileProgress: number;
	currentFileName?: string;
}

export interface DirectUploadOptions {
	onProgress?: (progress: DirectUploadProgress) => void;
	// Optional: Run income verification automatically after extraction
	loanProductIds?: string[]; // e.g., ["bank_statement", "irs_1099_income"]
	calculationTrack?: string; // e.g., "non_qm_bank_statement"
}

/**
 * Upload files directly to GCS (optimized flow).
 *
 * Combines all steps:
 * 1. Get signed URLs
 * 2. Upload files in parallel directly to GCS
 * 3. Start case processing
 *
 * Much faster than legacy uploadFiles() for large files.
 *
 * @param files - Files to upload
 * @param optionsOrProgress - Options object with onProgress, loanProductIds, etc.
 *                            OR legacy onProgress callback for backward compatibility
 */
export async function uploadFilesDirectToGCS(
	files: FileList | File[],
	optionsOrProgress?: DirectUploadOptions | ((progress: DirectUploadProgress) => void),
): Promise<UploadResponse> {
	// Support both old and new signatures
	const options: DirectUploadOptions =
		typeof optionsOrProgress === "function"
			? { onProgress: optionsOrProgress }
			: (optionsOrProgress ?? {});

	const { onProgress, loanProductIds, calculationTrack } = options;
	const fileArray = Array.from(files);

	// Step 1: Prepare upload - get signed URLs
	onProgress?.({
		phase: "preparing",
		totalFiles: fileArray.length,
		completedFiles: 0,
		currentFileProgress: 0,
	});

	const prepareResponse = await prepareUpload(
		fileArray.map((f) => ({ filename: f.name, size: f.size })),
	);

	// Step 2: Upload all files in parallel directly to GCS
	let completedFiles = 0;
	const uploadPromises = fileArray.map((file, index) => {
		const urlInfo = prepareResponse.upload_urls[index];

		return uploadToSignedUrl(file, urlInfo, (fileProgress) => {
			onProgress?.({
				phase: "uploading",
				totalFiles: fileArray.length,
				completedFiles,
				currentFileProgress: fileProgress,
				currentFileName: file.name,
			});
		}).then((result) => {
			completedFiles++;
			onProgress?.({
				phase: "uploading",
				totalFiles: fileArray.length,
				completedFiles,
				currentFileProgress: 100,
				currentFileName: file.name,
			});
			return result;
		});
	});

	const uploadedFiles = await Promise.all(uploadPromises);

	// Step 3: Start case processing
	onProgress?.({
		phase: "starting",
		totalFiles: fileArray.length,
		completedFiles: fileArray.length,
		currentFileProgress: 100,
	});

	const result = await startCase(prepareResponse.case_id, {
		files: uploadedFiles,
		loan_product_ids: loanProductIds,
		calculation_track: calculationTrack,
	});

	return result;
}

// =============================================================================
// ADD FILES TO EXISTING CASE
// =============================================================================

export interface AddFilesFileInfo {
	filename: string;
	size?: number;
}

export interface StartAddFilesFileInfo {
	file_id: string;
	gcs_path: string;
	filename?: string;
}

export interface StartAddFilesResponse {
	case_id: string;
	status: string;
	workflow_id: string;
}

export type AddFilesPhase = "idle" | "preparing" | "uploading" | "starting" | "complete" | "error";

export interface AddFilesProgress {
	phase: AddFilesPhase;
	totalFiles: number;
	completedFiles: number;
	currentFileProgress: number;
	currentFileName?: string;
}

/**
 * Step 1: Prepare signed URLs to add files to an existing case.
 */
export async function prepareAddFiles(
	caseId: string,
	files: AddFilesFileInfo[],
): Promise<PrepareUploadResponse> {
	return apiFetch<PrepareUploadResponse>(`/case/${caseId}/files/prepare`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ files }),
	});
}

/**
 * Step 2: Start extraction for newly added files.
 */
export async function startAddFiles(
	caseId: string,
	files: StartAddFilesFileInfo[],
): Promise<StartAddFilesResponse> {
	return apiFetch<StartAddFilesResponse>(`/case/${caseId}/files/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ files }),
	});
}

/**
 * Add files to an existing case (full flow).
 *
 * Combines all steps:
 * 1. Get signed URLs for the existing case
 * 2. Upload files in parallel directly to GCS
 * 3. Start extraction for the new files
 */
export async function addFilesToCase(
	caseId: string,
	files: FileList | File[],
	onProgress?: (progress: AddFilesProgress) => void,
): Promise<StartAddFilesResponse> {
	const fileArray = Array.from(files);

	if (fileArray.length === 0) {
		throw new Error("No files provided");
	}

	// Step 1: Get signed URLs
	onProgress?.({
		phase: "preparing",
		totalFiles: fileArray.length,
		completedFiles: 0,
		currentFileProgress: 0,
	});

	const prepareResponse = await prepareAddFiles(
		caseId,
		fileArray.map((f) => ({ filename: f.name, size: f.size })),
	);

	// Step 2: Upload files to GCS in parallel
	onProgress?.({
		phase: "uploading",
		totalFiles: fileArray.length,
		completedFiles: 0,
		currentFileProgress: 0,
		currentFileName: fileArray[0]?.name,
	});

	let completedCount = 0;
	const uploadPromises = prepareResponse.upload_urls.map(async (urlInfo, index) => {
		const file = fileArray[index];
		await uploadToSignedUrl(file, urlInfo, (progress) => {
			onProgress?.({
				phase: "uploading",
				totalFiles: fileArray.length,
				completedFiles: completedCount,
				currentFileProgress: progress,
				currentFileName: file.name,
			});
		});
		completedCount++;
		return urlInfo;
	});

	const uploadedFiles = await Promise.all(uploadPromises);

	// Step 3: Start extraction for new files
	onProgress?.({
		phase: "starting",
		totalFiles: fileArray.length,
		completedFiles: fileArray.length,
		currentFileProgress: 100,
	});

	const startFilesRequest = uploadedFiles.map((urlInfo, index) => ({
		file_id: urlInfo.file_id,
		gcs_path: urlInfo.gcs_path,
		filename: fileArray[index].name,
	}));

	const result = await startAddFiles(caseId, startFilesRequest);

	onProgress?.({
		phase: "complete",
		totalFiles: fileArray.length,
		completedFiles: fileArray.length,
		currentFileProgress: 100,
	});

	return result;
}

// =============================================================================
// CASE STATUS & RESULTS
// =============================================================================

/**
 * Get case status.
 */
export async function getCaseStatus(caseId: string): Promise<CaseStatus> {
	return apiFetch<CaseStatus>(`/case/${caseId}/status`);
}

/**
 * Batch status response from API.
 */
export interface BatchStatusResponse {
	statuses: Record<string, CaseStatus | null>;
}

/**
 * Get status for multiple cases in a single request.
 * Much more efficient than calling getCaseStatus() for each case.
 */
export async function getCasesStatusBatch(caseIds: string[]): Promise<BatchStatusResponse> {
	if (caseIds.length === 0) {
		return { statuses: {} };
	}
	return apiFetch<BatchStatusResponse>("/cases/status", {
		method: "POST",
		body: JSON.stringify({ case_ids: caseIds }),
	});
}

/**
 * Get case result (final or progressive).
 */
export async function getCaseResult(caseId: string): Promise<CaseResult> {
	return apiFetch<CaseResult>(`/case/${caseId}/result`);
}

/**
 * Graph API response for case knowledge graph view.
 */
export interface CaseGraphNode {
	id: string;
	label: string;
	properties: Record<string, unknown>;
}

export interface CaseGraphEdge {
	source: string;
	target: string;
	type: string;
	properties: Record<string, unknown>;
}

export interface CaseGraphStats {
	total_nodes: number;
	total_edges: number;
	nodes_by_type: Record<string, number>;
	edges_by_type: Record<string, number>;
}

export interface CaseGraphReviewItem {
	rule: string;
	severity: string;
	message: string;
	details: Record<string, unknown>;
}

export interface CaseGraphResponse {
	case_id: string;
	nodes: CaseGraphNode[];
	edges: CaseGraphEdge[];
	stats: CaseGraphStats;
	review_items: CaseGraphReviewItem[];
	filters_applied: Record<string, unknown>;
	truncated: boolean;
}

export interface CaseGraphFilters {
	search?: string;
	year?: string;
	limit?: number;
	nodeTypes?: string[];
}

/**
 * Get graph view data for a case with optional filters.
 */
export async function getCaseGraph(
	caseId: string,
	filters?: CaseGraphFilters,
): Promise<CaseGraphResponse> {
	const params = new URLSearchParams();
	if (filters?.search) params.set("search", filters.search);
	if (filters?.year && filters.year !== "all") params.set("year", filters.year);
	if (filters?.limit != null) params.set("limit", String(filters.limit));
	if (filters?.nodeTypes && filters.nodeTypes.length > 0) {
		params.set("node_types", filters.nodeTypes.join(","));
	}
	const query = params.toString();
	return apiFetch<CaseGraphResponse>(`/case/${caseId}/graph${query ? `?${query}` : ""}`);
}

/**
 * Table data from region-based extraction (bank statements, etc.)
 */
export interface TableRow {
	row_index: number;
	cells: Record<string, string | number | null>;
}

export interface TableData {
	region_id: string;
	region_type: string;
	semantic_type: string; // Ontology region name: "transactions", "header", "summary"
	page_number: number;
	columns: string[];
	semantic_mapping: Record<string, string>;
	rows: TableRow[];
	row_count: number;
	total_pages?: number;
}

export interface DocumentTables {
	doc_id: string;
	document_type: string;
	file_id: string;
	tables: TableData[];
}

export interface CaseTablesResponse {
	case_id: string;
	documents: DocumentTables[];
	total_tables: number;
	total_rows: number;
}

/**
 * Get table data (transactions, line items) for a case.
 * Returns structured table data from region-based extraction (Parquet-backed).
 */
export async function getCaseTables(
	caseId: string,
	page = 1,
	pageSize = 50,
): Promise<CaseTablesResponse> {
	return apiFetch<CaseTablesResponse>(`/case/${caseId}/tables?page=${page}&page_size=${pageSize}`);
}

/**
 * Get progressive result (during extraction).
 */
export async function getCaseProgress(caseId: string): Promise<CaseResult> {
	return apiFetch<CaseResult>(`/case/${caseId}/progress`);
}

/**
 * Get page image URL.
 * Note: Page images are semi-public (require knowing case_id/file_id).
 */
export function getPageImageUrl(
	caseId: string,
	fileId: string,
	pageNumber: number,
	token?: string,
): string {
	const url = `${BASE_URL}/case/${caseId}/page/${fileId}/${pageNumber}/image`;
	return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

/**
 * Get signed URL for file download from GCS.
 */
export interface FileDownloadResponse {
	download_url: string;
	filename: string;
	expires_in_seconds: number;
}

export async function getFileDownloadUrl(
	caseId: string,
	fileId: string,
): Promise<FileDownloadResponse> {
	return apiFetch<FileDownloadResponse>(`/case/${caseId}/file/${fileId}/download-url`);
}

/**
 * Cancel case extraction.
 */
export async function cancelCase(caseId: string): Promise<void> {
	await apiFetch(`/case/${caseId}/cancel`, { method: "POST" });
}

/**
 * Delete case permanently.
 */
export async function deleteCase(caseId: string): Promise<{ message: string; case_id: string }> {
	return apiFetch<{ message: string; case_id: string }>(`/case/${caseId}`, { method: "DELETE" });
}

/**
 * Reclassify a page.
 */
export async function reclassifyPage(
	caseId: string,
	fileId: string,
	pageNumber: number,
	newDocumentClass: string,
): Promise<{ workflow_id?: string }> {
	return apiFetch(`/case/${caseId}/page/${fileId}/${pageNumber}/classify`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ new_document_class: newDocumentClass }),
	});
}

/**
 * Get all supported document classes with display names.
 * Used for classification dropdowns - returns MISMO-compliant types.
 */
export interface DocumentClassOption {
	value: string;
	display_name: string;
}

export async function getDocumentClasses(): Promise<{ document_classes: DocumentClassOption[] }> {
	return apiFetch("/document-classes");
}

// =============================================================================
// RFC 6902 JSON PATCH API
// =============================================================================
//
// The frontend builds patches directly based on what component is editing.
// Backend validates, applies atomically, and infers workflow triggers.
//
// Trigger inference from patch paths:
// - /extractions/documents/*/document_type → reclassify workflow
// - /extractions/documents/*/facts/* → revalidation workflow
// - /extractions/documents/*/effective_period → revalidation workflow

/**
 * RFC 6902 JSON Patch operation.
 *
 * The component knows what it's editing - it builds the patch directly.
 * No helper functions needed - just construct the operation.
 *
 * Examples:
 *   { op: 'replace', path: '/extractions/documents/0/facts/2/bbox', value: {x1, y1, x2, y2} }
 *   { op: 'replace', path: '/extractions/documents/0/facts/2/value', value: 50000 }
 *   { op: 'add', path: '/extractions/documents/0/facts/2/edited_by', value: 'user' }
 */
export interface PatchOperation {
	op: "add" | "remove" | "replace" | "move" | "copy" | "test";
	path: string;
	value?: unknown;
	from?: string;
}

/**
 * Request to apply RFC 6902 JSON Patch to a case.
 *
 * The frontend builds patch operations directly. Backend:
 * 1. Validates paths are allowed
 * 2. Applies patch atomically
 * 3. Infers workflow triggers from paths
 * 4. Saves new version to GCS
 */
export interface PatchCaseRequest {
	/** RFC 6902 patch operations to apply */
	patch: PatchOperation[];
	/** Human-readable description for version history */
	description?: string;
	/** Optional explicit triggers (overrides inference) */
	triggers?: {
		revalidate?: boolean;
		reclassify?: boolean;
		reextract?: boolean;
	};
}

export interface PatchCaseResponse {
	success: boolean;
	case_id: string;
	version: number;
	previous_version?: number;
	operations_applied: number;
	workflow_id?: string;
	inferred_triggers?: {
		revalidate: boolean;
		reclassify: boolean;
		reextract: boolean;
	};
	message: string;
}

/**
 * Apply RFC 6902 patch to mutate case state.
 *
 * Creates a new version following the versioned-state architecture.
 * Backend infers what workflows to trigger based on the patch paths.
 */
export async function patchCase(
	caseId: string,
	request: PatchCaseRequest,
): Promise<PatchCaseResponse> {
	return apiFetch(`/case/${caseId}/patch`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Get historical events for a case.
 * Events include original timestamps for accurate relative time display.
 */
export interface CaseEventsResponse {
	case_id: string;
	events: StreamEvent[];
	count: number;
	last_id: string;
}

export async function getCaseEvents(
	caseId: string,
	lastId = "0",
	limit = 100,
): Promise<CaseEventsResponse> {
	const params = new URLSearchParams({ last_id: lastId, limit: String(limit) });
	return apiFetch(`/cases/${caseId}/events?${params}`);
}

/**
 * Reprocess a case.
 * Can either use existing files from GCS or upload new files.
 */
export interface ReprocessResponse {
	case_id: string;
	new_case_id: string;
	status: string;
	file_count: number;
	message: string;
}

export async function reprocessCase(
	caseId: string,
	files?: FileList | File[],
	loanProductId?: string | null,
	inPlace?: boolean,
): Promise<ReprocessResponse> {
	const formData = new FormData();

	// If files provided, add them to the request
	if (files && files.length > 0) {
		for (const file of files) {
			formData.append("files", file);
		}
	}

	// Pass selected loan product so income verification runs after extraction
	if (loanProductId && loanProductId.trim()) {
		formData.append("loan_product_id", loanProductId.trim());
	}

	// Reuse same case ID (reprocess in place) instead of creating new case
	if (inPlace) {
		formData.append("in_place", "true");
	}

	// Use uploadFile to avoid Content-Type: application/json (breaks multipart/form-data)
	return getDefaultClient().uploadMultipart<ReprocessResponse>(
		`${BASE_URL}/case/${caseId}/reprocess`,
		formData,
	);
}

/**
 * Re-extract specific pages (discards manual edits).
 */
export interface ReextractRequest {
	source_refs: Array<{
		file_id: string;
		page_number: number;
		document_class?: string;
	}>;
	new_document_class?: string;
}

export interface ReextractResponse {
	success: boolean;
	workflow_id: string;
	pages_queued: number;
	message: string;
}

export async function reextractPages(
	caseId: string,
	request: ReextractRequest,
): Promise<ReextractResponse> {
	return apiFetch<ReextractResponse>(`/case/${caseId}/reextract`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

// =============================================================================
// INCOME VERIFICATION API
// =============================================================================

/**
 * Loan product configuration from rule packs.
 */
export interface LoanProduct {
	id: string;
	display_name: string;
	description: string;
	agency: string;
	enabled: boolean;
	specs: string[];
	income_document_types: string[];
	credit_document_types: string[];
}

export interface LoanProductsResponse {
	products: LoanProduct[];
	version: string; // Rule pack version e.g., "2024.1.1"
	source: "gcs" | "local";
}

/**
 * Get available loan products from rule pack configuration.
 * Fetches from GCS if available, falls back to local config.
 */
export async function getLoanProducts(): Promise<LoanProductsResponse> {
	return apiFetch<LoanProductsResponse>("/income/loan-products");
}

/**
 * Income readiness check response.
 */
export interface ReviewItemDTO {
	item_type: string;
	severity: "blocker" | "warning";
	message: string;
	details: Record<string, unknown>;
}

export interface IncomeReadinessResponse {
	ready: boolean;
	case_id: string;
	loan_product: string;
	required_document_types: string[];
	found_document_types: string[];
	missing_document_types: string[];
	message: string;
	blocking_issues: string[];
	warnings: string[];
	review_items: ReviewItemDTO[];
}

/**
 * Check if a case has the required income documents for verification.
 */
export async function checkIncomeReadiness(
	caseId: string,
	loanProduct = "fannie_mae",
): Promise<IncomeReadinessResponse> {
	return apiFetch<IncomeReadinessResponse>(
		`/case/${caseId}/income/ready?loan_product=${encodeURIComponent(loanProduct)}`,
	);
}

export interface TaxYearResolution {
	case_id: string;
	y1: string | null;
	y2: string | null;
	y3: string | null;
	confidence: number;
	needs_review: boolean;
	confirmed: boolean;
	confirmed_by: string | null;
	confirmed_at: string | null;
	source_documents: Record<string, unknown>[];
	warnings: string[];
}

export interface ConfirmTaxYearRequest {
	y1?: string;
	y2?: string;
	confirmed?: boolean;
}

export interface ConfirmTaxYearResponse {
	case_id: string;
	status: string;
	y1: string | null;
	y2: string | null;
	confirmed: boolean;
	confirmed_by: string | null;
	message: string;
}

export async function getTaxYearResolution(caseId: string): Promise<TaxYearResolution> {
	return apiFetch<TaxYearResolution>(`/case/${caseId}/tax-year`);
}

export async function confirmTaxYear(
	caseId: string,
	request: ConfirmTaxYearRequest,
): Promise<ConfirmTaxYearResponse> {
	return apiFetch<ConfirmTaxYearResponse>(`/case/${caseId}/tax-year/confirm`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Render hints for income components.
 * - summary_row: Y1 in 2024 column, Y2 in 2023 column (default table row)
 * - single_value: Only Y1 column shown, Y2 shows as dash
 * - percentage: Format Y1 as percentage with % suffix
 * - badge: Render value as a colored badge/chip
 * - outcome: Special styling for final determination row
 */
export type IncomeRenderHint = "summary_row" | "single_value" | "percentage" | "badge" | "outcome";

/**
 * Income component - a single line item in an income section.
 */
/**
 * Aggregation metadata for multi-entity summary components.
 */
export interface ComponentAggregation {
	source: string;
	render_hint?: string;
}

export interface IncomeComponent {
	name: string;
	source_line: string;
	sign: "+" | "-" | "+/-" | "=";
	// Column values dict for arbitrary columns (v0.9.1+)
	// Keys match column IDs from table_config (e.g., "y1", "y2", "ytd")
	// Can include arrays for aggregation (e.g., "array": [0.35, 0.35])
	column_values?: Record<string, number | string | null | (number | string | null)[]>;
	// Legacy fields for backward compat
	y1?: number;
	y2?: number;
	ytd?: number;
	source_refs?: SourceRef[];
	rule_ref?: string; // e.g., "B3-3.2-01" from Fannie Mae Selling Guide
	render_hint?: IncomeRenderHint | "percentage_array" | "currency_array" | "number_array"; // UI display hint (includes array variants)
	data_type?: string; // currency, percentage, boolean, number, string
	role?: string; // data_row, subtotal, grand_total, metric, outcome, header, hidden
	emphasis?: string; // primary, secondary, tertiary
	// Aggregation metadata for multi-entity summary
	aggregation?: string | ComponentAggregation;
}

/**
 * Input value used in a calculation step.
 */
export interface CalculationInput {
	name: string;
	value: number | string | boolean | null;
	source_line?: string;
	document_type?: string;
	tax_year?: number;
	source_ref?: SourceRef;
}

/**
 * A single step in the income calculation.
 */
export interface CalculationStep {
	step_number: number;
	derivation_name: string;
	description: string;
	formula: string;
	formula_display: string;
	input_values: CalculationInput[];
	result: number | string | boolean | null;
	result_formatted?: string;
	result_type?: "currency" | "percentage" | "boolean" | "number"; // From YAML display metadata
	display_label?: string; // Human-friendly label from YAML
	is_final: boolean;
}

/**
 * Deduplication exclusion - income field excluded to avoid double-counting (v0.9.0).
 */
export interface DeduplicationExclusion {
	input_name: string; // e.g., "interest_income_y1"
	canonical_field: string; // e.g., "interest_income"
	reason: string; // e.g., "Captured by schedule_b_interest_dividend_income"
	captured_by_spec: string; // e.g., "schedule_b_interest_dividend_income"
	original_value?: number; // The value that was excluded
	year_suffix: string; // e.g., "_y1"
}

/**
 * Table column configuration from spec table_config.
 */
export interface TableColumnConfig {
	id: string;
	source: string;
	type: string;
	header_template?: string | null;
	visible_when?: string | null;
	emphasis?: string | null;
}

/**
 * Table configuration from spec.
 */
export interface TableConfig {
	columns: TableColumnConfig[];
	groups?: TableGroup[];
}

/**
 * Income section - calculation results from one spec.
 */
export interface IncomeSection {
	table_name: string;
	priority: number;
	spec_file: string;
	components: IncomeComponent[];
	subtotal_y1: number;
	subtotal_y2: number;
	subtotal_monthly: number;
	outcome?: string;
	guidance?: string;
	proof_trace?: string[];
	calculation_steps?: CalculationStep[]; // Step-by-step calculation log
	// Proof certificate fields for showing WHY a decision was made
	evidence_raw?: { upper: string[]; lower: string[] }; // T-object evidence
	matching_rules?: string[]; // Which rules matched
	rule_ref?: string; // e.g., "Fannie Mae Selling Guide B3-3.2-01"
	rule_url?: string; // Link to official guide
	// Grouping fields for integrated_tables
	parent_table_name?: string;
	is_group_parent?: boolean;
	child_sections?: IncomeSection[];
	// Skip tracking fields
	skipped?: boolean; // Whether this spec was skipped
	skip_reason?: string; // WHY the spec didn't fire
	spec_version?: string; // Version from spec file for audit trail
	// Aggregator flag - summary/analysis sections
	is_aggregator?: boolean; // True for trend analysis, cash flow summary, etc.
	// Year context - actual tax years used by this section
	// Allows different sections to show different year columns
	y1_year?: number; // e.g., 2024 (most recent for this spec)
	y2_year?: number; // e.g., 2023 (prior year for this spec)
	y3_year?: number; // e.g., 2022 (two years prior, if year_depth >= 3)
	// Year depth tracking - how many years used vs. available
	years_used?: number; // e.g., 2 (using 2 of 3 available years)
	years_available?: number; // e.g., 3 (total years in data)
	// Deduplication exclusions (v0.9.0) - income excluded to avoid double-counting
	dedup_excluded?: DeduplicationExclusion[];
	// Table configuration from spec - controls column display
	table_config?: TableConfig;

	// ========================================================================
	// Multi-Entity Support (v0.10.0)
	// ========================================================================
	// For specs with entity configuration (e.g., partnership K-1 by EIN)
	// When present, use MultiEntityTable in UI instead of flat SemanticTable
	entity_config?: {
		type: string; // e.g., "partnership", "employer", "property"
		identifier: string; // e.g., "partnership_ein", "employer_ein"
		label_field?: string; // e.g., "partnership_name"
	};
	entities?: EntityEvaluationResult[]; // Per-entity worksheets
	aggregate?: {
		values: Record<string, unknown>; // Aggregate derivations
		components: unknown[]; // Aggregate summary components
	};
}

/**
 * Entity evaluation result - per-entity worksheet in multi-entity section.
 * (v0.10.0)
 */
export interface EntityEvaluationResult {
	entity_id: string; // e.g., "1342" (EIN)
	entity_name: string; // e.g., "SIMONE JOE, INC"
	entity_type: string; // e.g., "partnership"
	components: unknown[]; // Entity worksheet components (simplified dicts)
	derivations: Record<string, unknown>; // Computed values for this entity
	is_unknown?: boolean; // True if entity identifier is missing
	needs_review?: boolean; // True if has errors or missing data
}

/**
 * Party income - calculation for a single borrower.
 */
export interface PartyIncome {
	party_id: string;
	name: string;
	sections: IncomeSection[];
	total_y1: number;
	total_y2: number;
	qualifying_monthly: number;
	method?: string;
}

/**
 * Income verification result with structured output.
 */
export interface IncomeVerificationResult {
	loan_type: string;
	rules_version: string;
	status: "completed" | "pending" | "error";
	parties: PartyIncome[];
	combined_total_y1: number;
	combined_total_y2: number;
	combined_qualifying: number;
	trend?: "increasing" | "stable" | "declining";
	method?: string;
	verification_flags?: string[];
	// Year context - actual tax years for display (e.g., 2024, 2023)
	year_1?: number; // Most recent year (Y1)
	year_2?: number; // Prior year (Y2)
	// Spec schema version - tracks spec language features (e.g., "0.7.1")
	spec_schema_version?: string;
}

export interface GetIncomeVerificationResponse {
	case_id: string;
	income_verification: IncomeVerificationResult | null;
	income_verifications?: Record<string, IncomeVerificationResult>;
	products_run?: string[];
	primary_product_id?: string;
	result_storage_mode?: "combined" | "separate";
}

export interface GetCreditVerificationResponse {
	case_id: string;
	credit_verification: Record<string, unknown> | null;
	credit_verifications?: Record<string, Record<string, unknown>>;
	products_run?: string[];
	primary_product_id?: string;
	result_storage_mode?: "combined" | "separate";
}

// =============================================================================
// WORKFLOW STATUS
// =============================================================================

/**
 * Workflow info from the API.
 */
export interface WorkflowInfo {
	workflow_id: string;
	workflow_type: "extraction" | "income" | "credit" | "add_files";
	status: "running" | "completed" | "failed" | "cancelled" | "terminated" | "timed_out" | "unknown";
	started_at?: string;
}

/**
 * Workflow status response from the API.
 */
export interface WorkflowStatusResponse {
	case_id: string;
	workflows: WorkflowInfo[];
	has_running: boolean;
}

/**
 * Get workflow status for a case.
 */
export async function getWorkflowStatus(caseId: string): Promise<WorkflowStatusResponse> {
	return apiFetch<WorkflowStatusResponse>(`/case/${caseId}/workflows`);
}

// =============================================================================
// INCOME VERIFICATION
// =============================================================================

/**
 * Start income verification request.
 */
export interface StartIncomeVerificationRequest {
	loan_product_id?: string;
	run_all_products?: boolean;
	selected_products?: string[];
	result_storage_mode?: "combined" | "separate";
	rules_version?: string;
}

/**
 * Start income verification response.
 */
export interface StartIncomeVerificationResponse {
	workflow_id: string;
	status: "started" | "error";
	rules_version: string;
	message: string;
}

export interface StartCreditVerificationRequest {
	loan_product_id?: string;
	run_all_products?: boolean;
	selected_products?: string[];
	result_storage_mode?: "combined" | "separate";
	rules_version?: string;
}

export interface StartCreditVerificationResponse {
	workflow_id: string;
	status: "started" | "error";
	rules_version: string;
	message: string;
}

/**
 * Get income verification result for a case.
 * @param caseId - The case ID
 * @param refinementId - Optional refinement ID to load specific refinement results
 */
export async function getIncomeVerification(
	caseId: string,
	refinementId?: string,
): Promise<GetIncomeVerificationResponse> {
	// Use path-based endpoint for refinement-specific results
	if (refinementId) {
		return apiFetch<GetIncomeVerificationResponse>(
			`/case/${caseId}/refinement/${encodeURIComponent(refinementId)}/income`,
		);
	}
	return apiFetch<GetIncomeVerificationResponse>(`/case/${caseId}/income`);
}

export async function getCreditVerification(
	caseId: string,
): Promise<GetCreditVerificationResponse> {
	return apiFetch<GetCreditVerificationResponse>(`/case/${caseId}/credit`);
}

export interface CreditPullStatusResponse {
	workflow_id: string;
	status: string;
	credit_report_id?: string;
	error_message?: string;
}

/**
 * Get credit pull workflow status.
 */
export async function getCreditPullStatus(
	caseId: string,
	workflowId: string,
): Promise<CreditPullStatusResponse> {
	return apiFetch<CreditPullStatusResponse>(`/case/${caseId}/credit/pull/${workflowId}/status`);
}

/**
 * Start income verification workflow for a case.
 */
export async function startIncomeVerification(
	caseId: string,
	loanProductId: string,
	rulesVersion?: string,
): Promise<StartIncomeVerificationResponse> {
	return startIncomeVerificationWithOptions(caseId, {
		loan_product_id: loanProductId,
		rules_version: rulesVersion,
	});
}

/**
 * Start grouped income verification for all enabled loan products.
 */
export async function startIncomeVerificationForAllProducts(
	caseId: string,
	rulesVersion?: string,
	resultStorageMode: "combined" | "separate" = "combined",
): Promise<StartIncomeVerificationResponse> {
	return startIncomeVerificationWithOptions(caseId, {
		run_all_products: true,
		rules_version: rulesVersion,
		result_storage_mode: resultStorageMode,
	});
}

/**
 * Start grouped income verification with custom product selection.
 */
export async function startIncomeVerificationWithOptions(
	caseId: string,
	request: StartIncomeVerificationRequest,
): Promise<StartIncomeVerificationResponse> {
	return apiFetch<StartIncomeVerificationResponse>(`/case/${caseId}/income/start`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(request),
	});
}

export async function startCreditVerificationWithOptions(
	caseId: string,
	request: StartCreditVerificationRequest,
): Promise<StartCreditVerificationResponse> {
	return apiFetch<StartCreditVerificationResponse>(`/case/${caseId}/credit/start`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(request),
	});
}

/**
 * Cancel running workflows for a case.
 */
export async function cancelWorkflows(
	caseId: string,
	workflowTypes?: string[],
): Promise<{ cancelled: string[] }> {
	const params = workflowTypes ? `?types=${workflowTypes.join(",")}` : "";
	return apiFetch<{ cancelled: string[] }>(`/case/${caseId}/workflows/cancel${params}`, {
		method: "POST",
	});
}

// =============================================================================
// SPEC WORKSHOP API
// =============================================================================

/**
 * Spec summary for listing.
 */
export interface SpecSummary {
	id: string;
	name: string;
	version: string;
	table_name?: string;
	file_path: string;
	description?: string;
	folder: string; // Folder/category for grouping
}

export interface SpecListResponse {
	specs: SpecSummary[];
	count: number;
	folders: string[]; // Available folders
}

/**
 * Get list of all available specs.
 */
export async function getSpecs(): Promise<SpecListResponse> {
	return apiFetch<SpecListResponse>("/specs");
}

export interface SpecContentResponse {
	id: string;
	yaml_content: string;
	file_path: string;
}

/**
 * Get full YAML content of a spec.
 */
export async function getSpec(specId: string): Promise<SpecContentResponse> {
	return apiFetch<SpecContentResponse>(`/specs/${encodeURIComponent(specId)}`);
}

/**
 * Component output from spec evaluation.
 * Note: y1/y2 can be number or string (e.g., employer_name components).
 */
export interface SpecComponentOutput {
	id: string; // Component ID for group matching
	name: string;
	source_line?: string;
	sign: string;
	y1?: number | string; // Matches IncomeComponent - can be numeric or string
	y2?: number | string; // Matches IncomeComponent - can be numeric or string
	role: string;
	emphasis?: string;
	data_type: string; // currency, percentage, boolean, number, string
	group_id?: string; // Group this component belongs to
}

/**
 * Table group for pivot-like tables.
 */
export interface TableGroup {
	id: string;
	label: string;
	includes: string[];
	aggregation?: string; // sum, avg, count
	collapsible: boolean;
}

/**
 * Table column definition from table_config.
 */
export interface TableColumn {
	id: string;
	type: string; // label, currency, percentage, sign, etc.
	source: string; // Field to pull value from
	header_template?: string; // Header text override (e.g., "Prior Year")
}

/**
 * Calculation step from evaluation.
 */
export interface SpecCalculationStep {
	step_number: number;
	name: string;
	formula: string;
	formula_display?: string;
	result: unknown;
	result_formatted?: string;
	result_type?: string;
	display_label?: string;
}

export interface SpecEvaluateRequest {
	yaml_content: string;
	inputs: Record<string, unknown>;
}

// =============================================================================
// MULTI-ENTITY TYPES (v0.10.0)
// =============================================================================

/**
 * Entity configuration from spec.
 */
export interface SpecEntityConfig {
	type: string; // Entity type (partnership, scorp, rental, employer)
	identifier: string; // Input field used as entity identifier
	label_field?: string; // Input field for display name
}

/**
 * Per-entity evaluation result.
 */
/**
 * Structured warning for explainability.
 */
export interface ExplainabilityWarning {
	category: string; // Warning category (orphan_fact, unknown_entity, etc.)
	severity: string; // Severity level (info, warning, error)
	message: string; // Human-readable warning message
	field_name?: string; // Related field name
	entity_id?: string; // Related entity ID
	suggested_action?: string; // Suggested user action
	context?: Record<string, unknown>; // Additional context
}

/**
 * A fact found at root level that should belong to an entity.
 */
export interface OrphanFact {
	field_name: string; // The field name
	value: unknown; // The value found
	matched_spec_inputs: string[]; // Which spec inputs this matches
	suggested_entity_type?: string; // Suggested entity type
}

export interface SpecEntityResult {
	id: string; // Entity identifier (e.g., EIN)
	name: string; // Entity display name
	type?: string; // Entity type from spec
	components: SpecComponentOutput[]; // Entity's worksheet components
	derivations: Record<string, unknown>; // Entity's derivation values
	// Entity status flags (v0.10.0)
	is_unknown?: boolean; // True if entity is missing identifier
	needs_review?: boolean; // True if entity has issues needing attention
	missing_fields?: string[]; // Expected fields not provided
	entity_warnings?: ExplainabilityWarning[]; // Entity-specific warnings
}

/**
 * Aggregate result computed across all entities.
 */
export interface SpecAggregateResult {
	values: Record<string, unknown>; // Aggregate output values
	components: SpecComponentOutput[]; // Summary components
}

export interface SpecEvaluateResponse {
	success: boolean;
	outcome?: string;
	guidance?: string;
	derivations: Record<string, unknown>;
	components: SpecComponentOutput[];
	groups: TableGroup[];
	columns: TableColumn[];
	calculation_steps: SpecCalculationStep[];
	proof_trace: string[];
	errors: string[];
	warnings: string[];
	// Multi-entity fields (v0.10.0)
	entity_config?: SpecEntityConfig;
	entities?: SpecEntityResult[];
	aggregate?: SpecAggregateResult;
	// Explainability fields (v0.10.0)
	orphan_facts?: OrphanFact[];
	explainability_warnings?: ExplainabilityWarning[];
	unknown_entities?: number;
	has_issues?: boolean;
}

/**
 * Evaluate a spec with mock inputs.
 */
export async function evaluateSpec(request: SpecEvaluateRequest): Promise<SpecEvaluateResponse> {
	return apiFetch<SpecEvaluateResponse>("/specs/evaluate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

export interface GenerateSampleRequest {
	yaml_content: string;
	scenario?: string;
	/** Number of entities to generate for multi-entity specs (1-5) */
	entity_count?: number;
	/** Data pattern: 'complete', 'partial', or 'single_year' */
	data_pattern?: "complete" | "partial" | "single_year";
	/** Number of error scenarios to include (0-3): unknown entities, incomplete, orphan facts */
	error_count?: number;
}

export interface GenerateSampleResponse {
	success: boolean;
	inputs: Record<string, unknown>;
	scenario_used?: string;
	errors: string[];
}

/**
 * Generate sample input data for a spec using AI.
 */
export async function generateSampleData(
	request: GenerateSampleRequest,
): Promise<GenerateSampleResponse> {
	return apiFetch<GenerateSampleResponse>("/specs/generate-sample", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

// =============================================================================
// AUTH & TENANT MANAGEMENT API
// =============================================================================

export interface CompleteRegistrationRequest {
	organization_name: string;
}

export interface CompleteRegistrationResponse {
	tenant_id: string;
	tenant_name: string;
	message: string;
	requires_token_refresh?: boolean;
}

export interface UserProfileResponse {
	uid: string;
	tenant_id?: string;
	tenant_name?: string;
	email: string;
	display_name?: string;
	is_owner?: boolean;
	has_tenant: boolean;
	message?: string;
}

/**
 * Complete user registration by creating a tenant.
 */
export async function completeRegistration(
	organizationName: string,
): Promise<CompleteRegistrationResponse> {
	return apiFetch<CompleteRegistrationResponse>("/auth/complete-registration", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organization_name: organizationName } as CompleteRegistrationRequest),
	});
}

/**
 * Get current user profile.
 */
export async function getCurrentUserProfile(): Promise<UserProfileResponse> {
	return apiFetch<UserProfileResponse>("/auth/me");
}

// =============================================================================
// TENANT CASE LISTING API
// =============================================================================

export interface TenantCaseMetadata {
	case_id: string;
	created_at: string;
	last_updated: string;
	status: string;
	file_count: number;
	document_types?: string[];
	total_pages?: number;
	extraction_complete: boolean;
	income_complete: boolean;
	// Borrower info from Memgraph (if available)
	primary_borrower?: string | null;
	borrower_count: number;
	// Error message (e.g., PAGE_LIMIT_EXCEEDED|100|50)
	error?: string | null;
}

/**
 * Get list of cases for current user's tenant.
 * Returns cases from backend (Redis + GCS smart caching).
 */
export async function getTenantCases(limit = 20, offset = 0): Promise<TenantCaseMetadata[]> {
	return apiFetch<TenantCaseMetadata[]>(`/tenants/cases?limit=${limit}&offset=${offset}`);
}

// =============================================================================
// DEMO LOAN TYPES (v0.11.0)
// =============================================================================

/**
 * A spec within a demo loan.
 */
export interface DemoLoanSpec {
	id: string;
	name: string;
	table_name?: string;
}

/**
 * Summary of a demo loan configuration.
 */
export interface DemoLoanSummary {
	id: string;
	name: string;
	description: string;
	icon: string;
	specs: DemoLoanSpec[];
	is_multi_entity: boolean;
}

/**
 * Response for listing demo loans.
 */
export interface DemoLoanListResponse {
	demo_loans: DemoLoanSummary[];
	count: number;
}

/**
 * Result from evaluating a single spec in a demo loan.
 */
export interface DemoLoanSpecResult {
	spec_id: string;
	spec_name: string;
	table_name: string;
	form_section?: string;
	components: SpecComponentOutput[];
	derivations: Record<string, unknown>;
	columns: TableColumn[];
	groups: TableGroup[];
	outputs: Record<string, unknown>;
	// Multi-entity fields - same as SpecEvaluateResponse
	is_multi_entity?: boolean;
	entity_config?: SpecEntityConfig;
	entities?: SpecEntityResult[];
	aggregate?: SpecAggregateResult;
}

/**
 * Response from evaluating a demo loan.
 */
export interface DemoLoanEvaluateResponse {
	demo_loan_id: string;
	demo_loan_name: string;
	spec_results: DemoLoanSpecResult[];
	aggregate: Record<string, unknown>;
	total_monthly_income?: number;
	success: boolean;
	errors: string[];
}

/**
 * Get list of all available demo loans.
 */
export async function getDemoLoans(): Promise<DemoLoanListResponse> {
	return apiFetch<DemoLoanListResponse>("/products/demo-loans");
}

/**
 * Evaluate a demo loan with inputs.
 */
export async function evaluateDemoLoan(
	demoLoanId: string,
	inputs: Record<string, unknown>,
): Promise<DemoLoanEvaluateResponse> {
	return apiFetch<DemoLoanEvaluateResponse>("/products/demo-loans/evaluate", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ demo_loan_id: demoLoanId, inputs }),
	});
}

/**
 * Generate sample data for a demo loan.
 */
export async function generateDemoLoanSample(
	demoLoanId: string,
	options?: { scenario?: string; entity_count?: number; data_pattern?: string },
): Promise<GenerateSampleResponse> {
	return apiFetch<GenerateSampleResponse>("/products/demo-loans/generate-sample", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ demo_loan_id: demoLoanId, ...options }),
	});
}

// =============================================================================
// PARTY MANAGEMENT API
// =============================================================================

/**
 * Request to merge two parties.
 */
export interface MergePartiesRequest {
	source_party_id: string;
	target_party_id: string;
	new_name?: string;
}

/**
 * Response from merging parties.
 */
export interface MergePartiesResponse {
	success: boolean;
	case_id: string;
	version: number;
	merged_party: Record<string, unknown>;
	message: string;
}

/**
 * Merge two parties into one.
 * Source party is merged INTO target party, then removed.
 */
export async function mergeParties(
	caseId: string,
	request: MergePartiesRequest,
): Promise<MergePartiesResponse> {
	return apiFetch<MergePartiesResponse>(`/case/${caseId}/parties/merge`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Request to update a party.
 */
export interface UpdatePartyRequest {
	name?: string;
}

/**
 * Response from updating a party.
 */
export interface UpdatePartyResponse {
	success: boolean;
	case_id: string;
	version: number;
	party: Record<string, unknown>;
	message: string;
}

/**
 * Update a party's attributes (name, etc.).
 */
export async function updateParty(
	caseId: string,
	partyId: string,
	request: UpdatePartyRequest,
): Promise<UpdatePartyResponse> {
	return apiFetch<UpdatePartyResponse>(`/case/${caseId}/parties/${encodeURIComponent(partyId)}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

// =============================================================================
// SCENARIO API (v0.12.0)
// =============================================================================

/**
 * Loan product availability within a scenario.
 */
export interface ScenarioLoanProduct {
	id: string;
	name: string;
	available: boolean;
}

/**
 * Mortgage approach type for scenarios.
 */
export type MortgageApproach = "qualified_mortgage" | "non_qualified_mortgage";

/**
 * Income scenario summary for list views.
 */
export interface ScenarioSummary {
	scenario_id: string;
	version: number;
	name: string;
	approach: MortgageApproach;
	is_latest: boolean;
	status: string; // pending, running, completed, failed
	total_monthly_income: number | null;
	created_at: string;
}

/**
 * Full scenario detail including inputs and outputs.
 * When refinements exist, includes data from the latest refinement.
 */
export interface ScenarioDetail extends ScenarioSummary {
	borrower_ids: string[];
	loan_product_ids: string[];
	document_ids?: string[]; // Selected document IDs for filtering
	y1_override: string | null;
	y2_override: string | null;
	/** Bank-statement lookback window (months); present when API returns it. */
	statement_period_months?: number | null;
	note: string | null;
	rules_version: string;
	qualifying_income: number | null;
	trend_status: string | null;
	verifications: Record<string, unknown> | null;
	// Refinement tracking
	latest_refinement_id?: string | null;
	refinement_count?: number;
}

/**
 * Legacy Scenario interface for backward compatibility.
 * @deprecated Use ScenarioSummary or ScenarioDetail instead.
 */
export interface Scenario {
	id: string;
	case_id: string;
	name: string;
	description: string;
	monthly_income: number;
	is_latest: boolean;
	loan_products: ScenarioLoanProduct[];
	created_at: string;
	updated_at: string;
}

/**
 * Response from listing scenarios for a case.
 */
export interface ScenariosResponse {
	scenarios: ScenarioSummary[];
}

/**
 * Request to create a new scenario.
 */
export interface CreateScenarioRequest {
	name?: string;
	approach?: MortgageApproach;
	borrower_ids: string[];
	loan_product_ids: string[];
	document_ids?: string[];
	y1_override?: string;
	y2_override?: string;
	statement_period_months?: number | null;
	note?: string;
}

/**
 * Response from creating a scenario.
 */
export interface CreateScenarioResponse {
	scenario_id: string;
	version: number;
	status: string;
}

/**
 * Response from starting a scenario.
 */
export interface StartScenarioResponse {
	status: string;
	workflow_id: string;
	message: string;
}

/**
 * Get all scenarios for a case.
 */
export async function getCaseScenarios(caseId: string): Promise<ScenariosResponse> {
	return apiFetch<ScenariosResponse>(`/case/${caseId}/scenarios`);
}

/**
 * Get a specific scenario by ID.
 */
export async function getScenario(caseId: string, scenarioId: string): Promise<ScenarioDetail> {
	return apiFetch<ScenarioDetail>(`/case/${caseId}/scenarios/${scenarioId}`);
}

/**
 * Create a new scenario for a case.
 */
export async function createScenario(
	caseId: string,
	request: CreateScenarioRequest,
): Promise<CreateScenarioResponse> {
	return apiFetch<CreateScenarioResponse>(`/case/${caseId}/scenarios`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Start a scenario calculation.
 */
export async function startScenario(
	caseId: string,
	scenarioId: string,
): Promise<StartScenarioResponse> {
	return apiFetch<StartScenarioResponse>(`/case/${caseId}/scenarios/${scenarioId}/start`, {
		method: "POST",
	});
}

/**
 * Delete a scenario.
 */
export async function deleteScenario(caseId: string, scenarioId: string): Promise<void> {
	return apiFetch<void>(`/case/${caseId}/scenarios/${scenarioId}`, {
		method: "DELETE",
	});
}

// =============================================================================
// INCOME ADVISOR
// =============================================================================

/**
 * Income optimization strategy from advisor.
 */
export interface IncomeStrategy {
	strategy_name: string;
	strategy_type: "approach_change" | "year_selection" | "add_back" | "document" | "entity";
	current_income: number;
	estimated_income: number;
	impact_delta: number;
	impact_percent: number;
	confidence: number;
	risk_level: "low" | "medium" | "high";
	requirements: string[];
	trade_offs: string[];
	reasoning: string;
}

/**
 * Income advisor result.
 */
export interface IncomeAdvisorResult {
	case_id: string;
	scenario_id?: string;
	generated: boolean;
	tools_called: number;
	case_summary: string;
	primary_strategy?: IncomeStrategy;
	alternative_strategies: IncomeStrategy[];
	data_gaps: string[];
	observations: string[];
	tools_used: string[];
}

/**
 * SSE event from income advisor stream.
 */
export interface AdvisorStreamEvent {
	event: "start" | "context" | "thinking" | "tool_call" | "tool_result" | "complete" | "error";
	data: Record<string, unknown>;
}

/**
 * Get income advisor streaming URL.
 */
export function getIncomeAdvisorStreamUrl(
	caseId: string,
	options?: {
		scenarioId?: string;
		currentApproach?: string;
		currentIncome?: number;
		focusAreas?: string[];
	},
): string {
	const params = new URLSearchParams();
	if (options?.scenarioId) params.set("scenario_id", options.scenarioId);
	if (options?.currentApproach) params.set("current_approach", options.currentApproach);
	if (options?.currentIncome) params.set("current_income", options.currentIncome.toString());
	if (options?.focusAreas?.length) params.set("focus_areas", options.focusAreas.join(","));

	const queryString = params.toString();
	return `/api/case/${caseId}/income/advisor/stream${queryString ? `?${queryString}` : ""}`;
}

/**
 * Get income advice (non-streaming).
 */
export async function getIncomeAdvice(
	caseId: string,
	options?: {
		scenarioId?: string;
		currentApproach?: string;
		currentIncome?: number;
		focusAreas?: string[];
	},
): Promise<IncomeAdvisorResult> {
	return apiFetch<IncomeAdvisorResult>(`/case/${caseId}/income/advisor`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			scenario_id: options?.scenarioId,
			current_approach: options?.currentApproach,
			current_income: options?.currentIncome,
			focus_areas: options?.focusAreas,
		}),
	});
}

// =============================================================================
// BANK STATEMENTS
// =============================================================================

/**
 * Unified bank account summary.
 */
export interface BankAccount {
	account_id: string;
	borrower_name: string | null;
	institution_name: string;
	account_type: string;
	account_number: string;
	opening_balance: number;
	closing_balance: number;
	average_balance: number | null;
	linked_borrower_id: string | null;
	validation_status: string;
	validation_errors: string[];
	statement_file_id?: string;
}

/**
 * Per-page extraction stat for bank statement review.
 */
export interface PageExtractionStat {
	file_id: string;
	page_number: number;
	txn_count: number;
	status: "ok" | "empty" | "low";
}

export interface PageStatsResponse {
	pages: PageExtractionStat[];
	total_pages: number;
	empty_pages: number;
	low_pages: number;
}

/**
 * Gross deposits calculation result per borrower.
 *
 * Note: Uses simplified schema from unification.py:
 * - gross_deposits = eligible deposits (excludes transfers + large deposits)
 * - avg_monthly = gross_deposits / months_covered
 * - Expense factors are applied downstream by specs/Excel
 */
export interface GrossDepositsResult {
	borrower_id: string;
	borrower_name: string | null;
	gross_deposits: number; // Eligible deposits (excludes transfers + large deposits)
	avg_monthly: number; // gross_deposits / months_covered
	months_covered: number;
	transfer_count: number;
	transfer_amount: number;
	large_deposit_count: number;
	large_deposit_amount: number;
}

/**
 * Qualifying income at expense factors.
 */
export interface QualifyingIncomeResult {
	borrower_id: string;
	borrower_name: string | null;
	qualifying_income_50: number;
	qualifying_income_75: number;
	qualifying_income_90: number;
}

/**
 * Cross-document validation issue.
 */
export interface BankStatementValidationIssue {
	code: string;
	severity: string;
	message: string;
	affected_accounts: string[];
}

/**
 * Complete bank statement summary for a case.
 */
export interface BankStatementSummary {
	case_id: string;
	accounts: BankAccount[];
	gross_deposits: GrossDepositsResult[];
	qualifying_income: QualifyingIncomeResult[];
	validation_issues: BankStatementValidationIssue[];
	statement_count: number;
	transaction_count: number;
}

export interface StageExcelUrlResponse {
	signed_url: string;
	filename: string;
	expires_in_seconds: number;
	snapshot_id: string;
	stage: string;
	version: number;
}

/**
 * Unified bank transaction.
 */
export interface BankTransaction {
	transaction_id: string;
	account_id: string;
	credit_debit: string;
	transaction_date: string;
	amount: number;
	description: string;
	deposit_classification: string | null;
	large_deposit_flag: boolean;
	is_transfer: boolean;
	running_balance: number | null;
	source_file_id?: string;
	source_page_number?: number;
}

/**
 * Transactions list response.
 */
export interface BankTransactionsResponse {
	case_id: string;
	account_id: string | null;
	transactions: BankTransaction[];
	total_count: number;
}

/**
 * Options for fetching bank transactions.
 */
export interface BankTransactionsOptions {
	accountId?: string;
	classification?: string;
	creditDebit?: string;
	isTransfer?: boolean;
	largeDepositFlag?: boolean;
	sortBy?: "transaction_date" | "amount" | "classification";
	sortDir?: "asc" | "desc";
	limit?: number;
	offset?: number;
}

/**
 * Get unified bank statement summary for a case.
 */
export async function getBankStatementSummary(caseId: string): Promise<BankStatementSummary> {
	return apiFetch<BankStatementSummary>(`/case/${caseId}/bank-statements/summary`);
}

/**
 * Get unified transactions with filtering.
 */
export async function getBankTransactions(
	caseId: string,
	options?: BankTransactionsOptions,
): Promise<BankTransactionsResponse> {
	const params = new URLSearchParams();
	if (options?.accountId) params.set("account_id", options.accountId);
	if (options?.classification) params.set("classification", options.classification);
	if (options?.creditDebit) params.set("credit_debit", options.creditDebit);
	if (options?.isTransfer !== undefined) params.set("is_transfer", String(options.isTransfer));
	if (options?.largeDepositFlag !== undefined)
		params.set("large_deposit_flag", String(options.largeDepositFlag));
	if (options?.sortBy) params.set("sort_by", options.sortBy);
	if (options?.sortDir) params.set("sort_dir", options.sortDir);
	if (options?.limit) params.set("limit", options.limit.toString());
	if (options?.offset) params.set("offset", options.offset.toString());

	const query = params.toString();
	const url = `/case/${caseId}/bank-statements/transactions${query ? `?${query}` : ""}`;
	return apiFetch<BankTransactionsResponse>(url);
}

// =============================================================================
// Bank Statement Review & Reclassification
// =============================================================================

export interface ReviewTransaction {
	transaction_id: string;
	account_id: string;
	transaction_date: string;
	amount: number;
	description: string;
	classification: string;
	is_large_deposit: boolean;
	is_transfer: boolean;
	review_reason: string;
	borrower_name: string | null;
	source_file_id?: string;
	source_page_number?: number;
}

export interface ReviewTransactionsResponse {
	case_id: string;
	transactions: ReviewTransaction[];
	total_count: number;
}

export interface ReclassifyResponse {
	case_id: string;
	updated_count: number;
	gross_deposits_recalculated: boolean;
}

export async function getReviewTransactions(caseId: string): Promise<ReviewTransactionsResponse> {
	return apiFetch<ReviewTransactionsResponse>(`/case/${caseId}/bank-statements/review`);
}

export async function getPageExtractionStats(caseId: string): Promise<PageStatsResponse> {
	return apiFetch<PageStatsResponse>(`/case/${caseId}/bank-statements/page-stats`);
}

export interface ReviewDecision {
	target_type: "validation_issue" | "page" | "transaction";
	target_id: string;
	action: "dismiss" | "acknowledge" | "reextract_requested";
	reason?: string;
}

export interface ReviewDecisionRecord {
	target_type: string;
	target_id: string;
	action: string;
	reason?: string;
	reviewed_by?: string;
	reviewed_at?: string;
}

export interface ReviewDecisionsResponse {
	case_id: string;
	decisions: ReviewDecisionRecord[];
	total_count: number;
}

export async function getReviewDecisions(caseId: string): Promise<ReviewDecisionsResponse> {
	return apiFetch<ReviewDecisionsResponse>(`/ai/review/${caseId}/decisions`);
}

export async function submitReviewDecisions(
	caseId: string,
	decisions: ReviewDecision[],
): Promise<ReviewDecisionsResponse> {
	return apiFetch<ReviewDecisionsResponse>(`/ai/review/${caseId}/decisions`, {
		method: "POST",
		body: JSON.stringify({ decisions }),
	});
}

export interface AIReviewStartResponse {
	workflow_id: string;
	status: string;
	pages_to_analyze: number;
}

export interface AIReviewStatusResponse {
	status: "running" | "complete" | "failed" | "not_found";
	workflow_id: string | null;
	proposed_decisions: Array<{
		file_id: string;
		page_number: number;
		action: string;
		reason: string;
		confidence: number;
	}>;
	summary: string | null;
	error: string | null;
	metadata?: {
		total_pages: number;
		ok_pages: number;
		problem_pages: number;
		already_dismissed: number;
		analyzed: number;
		skipped_targets: Array<{
			file_id: string;
			page_number: number;
			status: string;
			reason: string;
		}>;
	};
}

export async function startAIReview(
	caseId: string,
	excludeTargets: string[] = [],
): Promise<AIReviewStartResponse> {
	return apiFetch<AIReviewStartResponse>(`/ai/review/${caseId}/start`, {
		method: "POST",
		body: JSON.stringify({ exclude_targets: excludeTargets }),
	});
}

export async function getAIReviewStatus(
	caseId: string,
	workflowId: string,
): Promise<AIReviewStatusResponse> {
	return apiFetch<AIReviewStatusResponse>(
		`/ai/review/${caseId}/status?workflow_id=${encodeURIComponent(workflowId)}`,
	);
}

export async function reextractBankStatementPages(
	caseId: string,
	pages: Array<{ file_id: string; page_number: number }>,
): Promise<ReextractResponse> {
	return reextractPages(caseId, {
		source_refs: pages.map((p) => ({
			file_id: p.file_id,
			page_number: p.page_number,
			document_class: "BankStatement",
		})),
	});
}

export async function triggerReunification(
	caseId: string,
): Promise<{ workflow_id: string; status: string }> {
	return apiFetch<{ workflow_id: string; status: string }>(`/ai/review/${caseId}/reunify`, {
		method: "POST",
	});
}

export async function reclassifyTransactions(
	caseId: string,
	updates: { transaction_id: string; classification: string }[],
): Promise<ReclassifyResponse> {
	return apiFetch<ReclassifyResponse>(`/case/${caseId}/bank-statements/reclassify`, {
		method: "PATCH",
		body: JSON.stringify({ updates }),
	});
}

/**
 * Get signed URL for downloading a stage snapshot Excel file.
 */
export async function getStageExcelUrl(
	caseId: string,
	stage: string,
	options?: { version?: number; product?: string; refinementId?: string },
): Promise<StageExcelUrlResponse> {
	const params = new URLSearchParams();
	if (options?.version !== undefined) params.set("version", String(options.version));
	if (options?.product) params.set("product", options.product);
	if (options?.refinementId) params.set("refinement_id", options.refinementId);

	const query = params.toString();
	const url = `/cases/${caseId}/stages/${stage}/excel-url${query ? `?${query}` : ""}`;
	return apiFetch<StageExcelUrlResponse>(url);
}

// =============================================================================
// Credit Report Extraction API
// =============================================================================

/**
 * Credit score from extraction.
 */
export interface CreditReportScore {
	score_model: string;
	score: number | null;
	reason_codes: string | null;
	no_score_reason: string | null;
}

/**
 * Trade account (tradeline) for DTI calculation.
 */
export interface CreditReportTradeAccount {
	company: string;
	account_number: string | null;
	account_type: string | null;
	portfolio_type: string | null;
	account_status: string | null;
	account_rating: string | null;
	balance: number | null;
	credit_limit: number | null;
	high_balance: number | null;
	high_credit: number | null;
	monthly_payment_amount: number | null;
	past_due: number | null;
	date_opened: string | null;
	date_reported: string | null;
	date_closed: string | null;
	responsibility: string | null;
	terms: string | null;
	remarks: string | null;
	delinquencies_30: number | null;
	delinquencies_60: number | null;
	delinquencies_90: number | null;
}

/**
 * Collection account.
 */
export interface CreditReportCollection {
	collection_agency: string;
	original_creditor: string | null;
	balance: number | null;
	date_opened: string | null;
	status: string | null;
}

/**
 * Public record (bankruptcy, lien, etc.).
 */
export interface CreditReportPublicRecord {
	record_type: string;
	court: string | null;
	amount: number | null;
	date_filed: string | null;
	date_resolved: string | null;
	status: string | null;
}

/**
 * Credit inquiry.
 */
export interface CreditReportInquiry {
	company: string;
	date: string;
	industry: string | null;
}

/**
 * Borrower personal information from credit report.
 */
export interface CreditReportBorrowerInfo {
	borrower_name: string | null;
	ssn: string | null;
	date_of_birth: string | null;
	current_address: string | null;
}

/**
 * Report summary statistics.
 */
export interface CreditReportReportSummary {
	total_accounts: number | null;
	total_balance: number | null;
	total_monthly_payments: number | null;
	inquiries_count: number | null;
	collections_count: number | null;
	public_records_count: number | null;
	delinquencies_30_60_90: string | null;
}

/**
 * Complete credit report extraction for a document.
 */
export interface CreditReportExtraction {
	document_id: string;
	file_id: string;
	report_type: string | null;
	date_pulled: string | null;
	bureau: string | null;
	borrower_info: CreditReportBorrowerInfo;
	credit_scores: CreditReportScore[];
	report_summary: CreditReportReportSummary;
	trade_accounts: CreditReportTradeAccount[];
	collections: CreditReportCollection[];
	public_records: CreditReportPublicRecord[];
	inquiries: CreditReportInquiry[];
}

/**
 * Summary of all credit report extractions for a case.
 */
export interface CreditReportSummary {
	case_id: string;
	credit_reports: CreditReportExtraction[];
	total_trade_accounts: number;
	total_monthly_payments: number;
	total_balance: number;
}

/**
 * Get credit report extraction summary for a case.
 */
export async function getCreditReportSummary(caseId: string): Promise<CreditReportSummary> {
	return apiFetch<CreditReportSummary>(`/case/${caseId}/credit-report/summary`);
}

export interface AppConfigResponse {
	isoftpull_test_mode: boolean;
}

/**
 * Get frontend runtime app config.
 */
export async function getAppConfig(): Promise<AppConfigResponse> {
	return apiFetch<AppConfigResponse>("/config");
}

export interface IncomeAdvisorStatusEvent {
	type: string;
	data: Record<string, unknown>;
	ts: string;
}

export interface IncomeAdvisorPendingQuestion {
	question: string;
	type?: string;
	options?: string[];
}

export interface IncomeAdvisorStatusResponse {
	status: "idle" | "running" | "waiting" | "complete" | "error";
	workflow_id?: string;
	events?: IncomeAdvisorStatusEvent[];
	pending_question?: IncomeAdvisorPendingQuestion;
	context_tokens?: number;
	result?: Record<string, unknown>;
	error?: string;
}

/**
 * Get advisor workflow status for a case.
 * Note: This endpoint lives under /api (not /api/v1).
 */
export async function getIncomeAdvisorStatus(caseId: string): Promise<IncomeAdvisorStatusResponse> {
	return apiFetchRoot<IncomeAdvisorStatusResponse>(`/api/case/${caseId}/income/advisor/status`);
}

// =============================================================================
// SCENARIO REFINEMENT API (v0.13.0)
// =============================================================================

/**
 * User-configurable inputs for spec calculations.
 * These values override defaults in spec formulas via context.user_inputs.{field_name}
 */
export interface UserInputs {
	/** Expense factor for bank statement income calculation (0.0-1.0) */
	expense_factor?: number;
}

/**
 * Request to create a new refinement for a scenario.
 */
export interface CreateRefinementRequest {
	borrower_ids: string[];
	document_ids: string[];
	loan_product_ids: string[];
	y1_override?: string | null;
	y2_override?: string | null;
	statement_period_months?: number | null;
	extraction_edit_count?: number;
	note?: string;
	/** User-configurable inputs for spec calculations */
	user_inputs?: UserInputs;
}

/**
 * Response from creating a refinement.
 */
export interface CreateRefinementResponse {
	refinement_id: string;
	refinement_num: number;
	status: string;
}

/**
 * Refinement summary for list views.
 */
export interface RefinementSummary {
	refinement_id: string;
	refinement_num: number;
	name: string | null; // LLM-generated run name
	status: string;
	total_monthly_income: number | null;
	created_at: string;
}

/**
 * Response from listing refinements.
 */
export interface ListRefinementsResponse {
	refinements: RefinementSummary[];
}

/**
 * Full refinement detail including inputs and outputs.
 */
export interface RefinementDetail {
	refinement_id: string;
	refinement_num: number;
	name: string | null; // LLM-generated run name
	scenario_id: string;
	borrower_ids: string[];
	document_ids: string[];
	loan_product_ids: string[];
	y1_override: string | null;
	y2_override: string | null;
	statement_period_months: number | null;
	extraction_edit_count: number;
	status: string;
	total_monthly_income: number | null;
	qualifying_income: number | null;
	trend_status: string | null;
	note: string | null;
	created_at: string;
	completed_at: string | null;
	/** User-configurable inputs for spec calculations */
	user_inputs?: UserInputs | null;
	/** Actual expense factor used in bank statement calculation (0.0-1.0) */
	expense_factor_used?: number | null;
}

/**
 * Response from starting a refinement.
 */
export interface StartRefinementResponse {
	status: string;
	workflow_id: string;
	message: string;
}

/**
 * Create a new refinement for a scenario.
 * Refinements capture variations on scenario inputs without creating new scenario versions.
 */
export async function createRefinement(
	caseId: string,
	scenarioId: string,
	request: CreateRefinementRequest,
): Promise<CreateRefinementResponse> {
	return apiFetch<CreateRefinementResponse>(`/case/${caseId}/scenarios/${scenarioId}/refinements`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * List all refinements for a scenario.
 */
export async function listRefinements(
	caseId: string,
	scenarioId: string,
): Promise<ListRefinementsResponse> {
	return apiFetch<ListRefinementsResponse>(`/case/${caseId}/scenarios/${scenarioId}/refinements`);
}

/**
 * Get refinement detail by ID.
 */
export async function getRefinement(
	caseId: string,
	scenarioId: string,
	refinementId: string,
): Promise<RefinementDetail> {
	return apiFetch<RefinementDetail>(
		`/case/${caseId}/scenarios/${scenarioId}/refinements/${refinementId}`,
	);
}

/**
 * Start income calculation for a refinement.
 */
export async function startRefinement(
	caseId: string,
	scenarioId: string,
	refinementId: string,
): Promise<StartRefinementResponse> {
	return apiFetch<StartRefinementResponse>(
		`/case/${caseId}/scenarios/${scenarioId}/refinements/${refinementId}/start`,
		{ method: "POST" },
	);
}

// =============================================================================
// SAMPLE CASES API
// =============================================================================

export interface SampleFileInfo {
	filename: string;
}

export interface SampleInfo {
	id: string;
	name: string;
	description: string;
	category: string;
	files: SampleFileInfo[];
}

export interface SampleListResponse {
	samples: SampleInfo[];
}

export interface CreateSampleCaseResponse {
	case_id: string;
	status: string;
	file_count: number;
	sample_id: string;
	message: string;
}

export async function listSamples(): Promise<SampleListResponse> {
	return apiFetch<SampleListResponse>("/samples");
}

export async function createSampleCase(
	sampleId: string,
	caseName?: string,
): Promise<CreateSampleCaseResponse> {
	return apiFetch<CreateSampleCaseResponse>("/samples/create", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sample_id: sampleId, case_name: caseName }),
	});
}
