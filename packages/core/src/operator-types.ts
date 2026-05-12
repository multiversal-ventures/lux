import type { components } from "./generated.js";

export type CaseResponse = components["schemas"]["CaseResponse"];
export type SpecAuditResponse = components["schemas"]["SpecAuditResponse"];
export type CalculationStepResponse = components["schemas"]["CalculationStepResponse"];
export type SpecResponse = components["schemas"]["SpecResponse"];
export type DocumentResponse = components["schemas"]["DocumentResponse"];
export type ExtractionResponse = components["schemas"]["ExtractionResponse"];
export type ExtractionSourceResponse = components["schemas"]["ExtractionSourceResponse"];
export type BboxResponse = components["schemas"]["BboxResponse"];

// Banking response shape is pivoted from long-format aggregation rows on
// the backend, so the generated OpenAPI types lag. We declare them
// inline and expose them as the public type surface.
export interface BankingAccount {
	account_id: string | null;
	account_holder_name: string | null;
	currency: string | null;
	gross_deposits_aggressive: number;
	gross_deposits_conservative: number;
	average_monthly_deposits: number;
	months_covered: number | null;
	stream_count: number;
	payroll_stream_confidence: number | null;
	balance_reconciled: boolean | null;
	coverage_passed: boolean | null;
	summary_matched: boolean | null;
	header_fallback: boolean | null;
	source_doc_ids: string[];
}

export interface BankingBorrowerRollup {
	borrower_id: string | null;
	borrower_name: string | null;
	account_count: number;
	source_account_ids: string[];
	gross_deposits_aggressive: number;
	gross_deposits_conservative: number;
	average_monthly_deposits: number;
	months_covered: number | null;
	stream_count: number;
	payroll_stream_confidence: number | null;
}

export interface BankingResponse {
	accounts: BankingAccount[];
	borrowers: BankingBorrowerRollup[];
	total_gross_deposits: number;
	total_average_monthly: number;
}

export interface ClassifiedTransaction {
	transaction_id: string;
	account_id: string;
	transaction_date: string;
	description: string;
	credit_debit: "CR" | "DR";
	amount: number;
	classification: string | null;
	is_transfer: boolean;
	is_large_deposit: boolean;
	source_file_id: string | null;
	source_page_number: number | null;
	running_balance: number | null;
}

export interface ClassifiedTransactionsResponse {
	case_id: string;
	transactions: ClassifiedTransaction[];
	total_count: number;
}

export interface TransactionRow {
	row_index: number | null;
	data: Record<string, unknown>;
}

export interface TransactionRegion {
	region_id: string;
	page_number: number | null;
	parquet_path: string;
	columns: string[];
	row_count: number;
	rows: TransactionRow[];
}

export interface TransactionsResponse {
	doc_id: string;
	source_filename: string | null;
	regions: TransactionRegion[];
	total_rows: number;
}

/** Known SSE event types emitted by Veritas during case processing. */
export type CaseEventType =
	| "intake.file.processed"
	| "extraction.completed"
	| "banking.completed"
	| "qualify.completed"
	| "qualify.failed"
	| "case.system.completed"
	| (string & Record<never, never>); // open: accepts unknown future types without losing inference on the known literals

export interface CaseEvent {
	event_id: number;
	event_type: CaseEventType;
	event_data: Record<string, unknown> | null;
	created_at: string | null;
}

export interface GenerateSpecResult {
	yaml: string;
	name: string;
	domain: string;
	version: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload orchestration types (prepare → signed-URL PUT → start)
// ─────────────────────────────────────────────────────────────────────────────

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

export interface StartCaseRequest {
	files: UploadUrlInfo[];
	include_chunks?: boolean;
	include_page_images?: boolean;
	max_concurrency?: number;
	loan_product_ids?: string[];
	calculation_track?: string;
}

export interface StartCaseResponse {
	case_id: string;
	status: string;
	workflow_id?: string;
	file_count?: number;
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

export type DirectUploadPhase = "preparing" | "uploading" | "starting";

export interface DirectUploadProgress {
	phase: DirectUploadPhase;
	totalFiles: number;
	completedFiles: number;
	currentFileProgress: number;
	currentFileName?: string;
}

export interface DirectUploadOptions {
	onProgress?: (progress: DirectUploadProgress) => void;
	loanProductIds?: string[];
	calculationTrack?: string;
}

export interface AddFilesProgress {
	phase: "idle" | "preparing" | "uploading" | "starting" | "complete" | "error";
	totalFiles: number;
	completedFiles: number;
	currentFileProgress: number;
	currentFileName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit report summary types (ported from Gunnr)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditScore {
	score_model: string;
	score: number | null;
	reason_codes: string | null;
	no_score_reason: string | null;
}

export interface TradeAccount {
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

export interface CreditCollection {
	collection_agency: string;
	original_creditor: string | null;
	balance: number | null;
	date_opened: string | null;
	status: string | null;
}

export interface CreditPublicRecord {
	record_type: string;
	court: string | null;
	amount: number | null;
	date_filed: string | null;
	date_resolved: string | null;
	status: string | null;
}

export interface CreditInquiry {
	company: string;
	date: string;
	industry: string | null;
}

export interface CreditBorrowerInfo {
	borrower_name: string | null;
	ssn: string | null;
	date_of_birth: string | null;
	current_address: string | null;
}

export interface CreditReportSummaryStats {
	total_accounts: number | null;
	total_balance: number | null;
	total_monthly_payments: number | null;
	inquiries_count: number | null;
	collections_count: number | null;
	public_records_count: number | null;
	delinquencies_30_60_90: string | null;
}

export interface CreditReportExtraction {
	document_id: string;
	file_id: string;
	report_type: string | null;
	date_pulled: string | null;
	bureau: string | null;
	borrower_info: CreditBorrowerInfo;
	credit_scores: CreditScore[];
	report_summary: CreditReportSummaryStats;
	trade_accounts: TradeAccount[];
	collections: CreditCollection[];
	public_records: CreditPublicRecord[];
	inquiries: CreditInquiry[];
}

export interface CreditReportSummary {
	case_id: string;
	credit_reports: CreditReportExtraction[];
	total_trade_accounts: number;
	total_monthly_payments: number;
	total_balance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Portal token issuance — uses OpenAPI generated schemas from index.ts.
// operator-cases.ts imports these types from generated.ts directly.
// ─────────────────────────────────────────────────────────────────────────────

export interface OperatorClientConfig {
	/** Base URL of the Veritas API. Empty string = same origin (Vite proxy). */
	baseUrl?: string;
	/** Bearer token from `veritas tenant issue-credential`. */
	bearerToken: string;
}

export interface OperatorClientError {
	status: number;
	message: string;
}

export type Result<T> =
	| { data: T; error: null }
	| { data: null; error: OperatorClientError };
