/**
 * Gunnr TypeScript Types
 * Mirrors backend Pydantic models for type safety.
 */

// =============================================================================
// SOURCE & RULE REFERENCES
// =============================================================================

export interface SourceRef {
	file_id?: string;
	filename?: string;
	document_class?: string;
	classification_confidence?: number;
	page_number?: number;
	field_name?: string;
	fact_field_name?: string; // Original field name from extraction (for fact highlighting)
	canonical_key?: string; // e.g. "1040.wages" for better source ref display
}

export interface RuleRef {
	rule_name?: string;
	severity?: "error" | "warning" | "info";
}

// =============================================================================
// STREAM EVENTS
// =============================================================================

export type EventType =
	| "phase"
	| "thinking"
	| "observation"
	| "action"
	| "finding"
	| "issue"
	| "complete";

export type RenderHint = "card" | "inline" | "badge" | "highlight" | "dismiss";

/**
 * StreamEvent - Real-time event from agent narration.
 *
 * Events are emitted to Redis Streams and consumed via SSE.
 * The snapshot_id and event_seq fields allow correlation with
 * specific GCS snapshots for debugging.
 */
export interface StreamEventData extends Record<string, unknown> {
	/** Pipeline status code embedded by the backend (e.g. "extracting", "completed") */
	status?: string;
	/** Human-readable name for the event (e.g. "Classifying Pages") */
	name?: string;
	/** Progress percentage 0-100 */
	progress_pct?: number;
	/** Document types found in a classification event */
	document_types?: string[];
}

export interface StreamEvent {
	id: string;
	/** Present when read via API/SSE; omit on very old cached payloads */
	case_id?: string;
	type: EventType;
	message: string;
	render_hint: RenderHint;
	phase: string;
	timestamp: string;
	source?: SourceRef;
	rule?: RuleRef;
	data?: StreamEventData;
	/** Current GCS snapshot version (e.g., "v2") for correlation */
	snapshot_id?: string;
	/** Sequence number within the snapshot for ordering */
	event_seq?: number;
}

// =============================================================================
// FACTS & PAGES
// =============================================================================

/**
 * BoundingBox - Normalized coordinates (0.0 - 1.0) for a region on a page.
 *
 * Backend sends x1/y1/x2/y2 format (corner coordinates, normalized from Gemini's 0-1000 scale).
 * See: https://cloud.google.com/vertex-ai/generative-ai/docs/bounding-box-detection
 */
export interface BoundingBox {
	// Corner coordinates (from backend - normalized 0.0-1.0)
	x1: number; // Left edge
	y1: number; // Top edge
	x2: number; // Right edge
	y2: number; // Bottom edge

	/** Page number this bounding box appears on */
	page_number?: number;
}

/**
 * Convert BoundingBox to CSS-friendly style object.
 */
export function bboxToStyle(bbox: BoundingBox): {
	left: string;
	top: string;
	width: string;
	height: string;
} {
	return {
		left: `${bbox.x1 * 100}%`,
		top: `${bbox.y1 * 100}%`,
		width: `${(bbox.x2 - bbox.x1) * 100}%`,
		height: `${(bbox.y2 - bbox.y1) * 100}%`,
	};
}

/** Source location for a fact - identifies where on which page the value was found */
export interface FactSource {
	page_number: number;
	bbox?: BoundingBox;
	source_text?: string;
}

/**
 * Provenance metadata for extracted facts (ontology migration - PR #109).
 *
 * Self-contained - frontend needs no knowledge of spec structure.
 * Determined at extraction time based on which ontology defines the element.
 *
 * Type definitions:
 * - mismo: Official MISMO element from XSD
 * - extension: IRS form line item or custom extension
 * - custom: Generic extraction field with no ontology
 */
export interface Provenance {
	type: "mismo" | "extension" | "custom";
	/** Human-readable source (e.g., "MISMO 3.4 XSD", "IRS 1120") */
	source: string;
	/** Element name (e.g., "TaxableIncomeAmount", "OtherIncomeAmount") */
	element: string;
	/** Version string (e.g., "3.4", "2024.1") */
	version: string;
}

export interface Fact {
	field_name: string;
	value: string | number | boolean;
	data_type?: string;
	confidence?: number;
	source_text?: string;
	/** Single bounding box (legacy/simple case) */
	bbox?: BoundingBox;
	/** Multiple source locations - for facts derived from multiple places */
	sources?: FactSource[];
	/** Provenance metadata - REQUIRED (no legacy data, pre-production) */
	provenance: Provenance;
	/** Extraction source: "llm" (real extraction), "mocked" (test values), "default" (type-based fallback) */
	extraction_source?: "llm" | "mocked" | "default" | "unknown";
}

export interface TemporalMetadata {
	period_start?: string;
	period_end?: string;
	inferred_from?: string;
	confidence?: number;
}

export interface QualityInfo {
	score: number;
	issues?: string[];
}

export interface PageResult {
	file_id: string;
	filename?: string;
	page_number: number;
	document_class: string;
	classification_method?: string;
	classification_confidence?: number;
	was_reclassified?: boolean;
	original_class?: string;
	is_unknown_type?: boolean;
	facts: Fact[];
	extraction_confidence?: number;
	quality?: QualityInfo;
	effective_period?: TemporalMetadata;
	timing_ms?: number;
	validation_score?: number;
	validation_passed?: boolean;
	re_extracted?: boolean;
}

// =============================================================================
// PARTIES
// =============================================================================

export type PartyType =
	| "individual"
	| "business"
	| "government_agency"
	| "financial_institution"
	| "employer"
	| "unknown";

export type PartyRole =
	| "borrower"
	| "co_borrower"
	| "employer"
	| "employee"
	| "tax_authority"
	| "lender"
	| "payer"
	| "payee"
	| "account_holder"
	| "unknown";

/**
 * Party - Identified party from document extraction.
 * Includes identifiers like SSN, EIN, account numbers.
 */
/** Source document reference for a party */
export interface PartySourceRef {
	file_id?: string;
	document_type?: string;
	page_number?: number;
	field_name?: string;
}

export interface Party {
	/** Unique identifier for this party (from extraction) */
	id?: string;
	/** Client-side ID alias (used for UI state management) */
	_id?: string;
	name: string;
	role: PartyRole;
	party_type?: PartyType;
	identifiers?: Record<string, string>; // e.g., { ssn: "XXX-XX-1234", ein: "12-3456789" }
	/** Documents/pages where this party was identified */
	source_refs?: PartySourceRef[];
	/** Additional roles this party has across documents */
	additional_roles?: PartyRole[];
	/** Name aliases from merged parties */
	name_aliases?: string[];
	/** Audit trail for merged parties */
	merged_from?: Array<{ party_id: string; name: string }>;
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationIssue {
	field_name: string;
	issue_type: string;
	message: string;
	severity: "error" | "warning" | "info";
	page_number?: number;
	file_id?: string;
}

export interface CrossDocumentIssue {
	issue_type: string;
	message: string;
	affected_documents: string[];
	severity: "error" | "warning" | "info";
}

// =============================================================================
// TIER 4 REVIEW TYPES
// =============================================================================

/**
 * Tier4Issue - Issue found during Tier 4 cross-document validation.
 */
export interface Tier4Issue {
	ruleName: string;
	severity: "error" | "warning" | "info";
	message: string;
	documentsInvolved: string[];
	pagesInvolved: string[];
	expectedValue?: string;
	actualValue?: string;
}

/**
 * Tier4ReviewState - State tracking for Tier 4 review progress.
 */
export interface Tier4ReviewState {
	phase: "idle" | "started" | "rules" | "llm" | "parties" | "complete";
	totalPages: number;
	totalFacts: number;
	documentTypes: string[];
	rulesChecked: number;
	issuesFound: number;
	errors: number;
	warnings: number;
	llmReviewPerformed: boolean;
	partiesFound: number;
	durationMs: number;
	crossDocumentIssues: Tier4Issue[];
	reExtractionRecommendations: string[];
}

// =============================================================================
// CASE STATUS & RESULT
// =============================================================================

// Re-exported from phases (mirrors dashboard `lib/phases.ts`).
import type { CaseStatusCode } from "./phases.js";
export type { CaseStatusCode };

export type StatusIntent = "active" | "success" | "error" | "warning";

/**
 * StatusInfo - Status information with display and intent.
 * Matches backend StatusInfo model.
 */
export interface StatusInfo {
	code: CaseStatusCode;
	display: string;
	intent: StatusIntent;
}

/**
 * CaseProgress - Progress information during extraction.
 * Matches backend CaseProgress model.
 */
export interface CaseProgress {
	files_uploaded: number;
	documents_found: number;
	pages_processed: number;
	pages_total: number;
	facts_extracted: number;
	percent: number;
}

/**
 * VersionInfo - Snapshot version information.
 * Matches backend VersionInfo model.
 */
export interface CaseVersionInfo {
	current: number;
	total: number;
}

/**
 * CaseStatus - Response from polling case status.
 * Matches backend CaseStatusResponse model.
 */
export interface CaseStatus {
	case_id: string;
	status: StatusInfo;
	activity: string | null;
	message: string;
	progress: CaseProgress;
	version: CaseVersionInfo | null;
	error: string | null;
	started_at: string;
	updated_at: string;
}

// =============================================================================
// GUNNR OUTPUT DTO - Three-tier structure
// =============================================================================

export type FileProcessingStatus = "opening" | "loaded" | "processing" | "complete";

export interface FileArtifact {
	file_id: string;
	filename: string;
	gcs_path?: string;
	url?: string;
	total_pages: number;
	processed_at?: string;
	/** Current processing status for this file */
	processing_status?: FileProcessingStatus;
	/** Human-readable processing message */
	processing_message?: string;
}

export interface PageArtifact {
	page_number: number;
	file_id: string;
	quality_score?: number;
}

export interface GunnrArtifacts {
	files: FileArtifact[];
	pages: PageArtifact[];
	total_files: number;
	total_pages: number;
}

export interface DocumentPageRef {
	file_id: string;
	page_number: number;
}

export interface EffectivePeriod {
	period_start?: string;
	period_end?: string;
	inferred_from?: string;
	confidence?: number;
}

export type ProcessingStatus =
	| "classifying"
	| "classified"
	| "extracting"
	| "validating"
	| "complete";
export type ValidationStatus =
	| "pending"
	| "validating"
	| "passed"
	| "issues_found"
	| "re_extracting";

export interface DocumentLink {
	/** Type of linked document (e.g., "IRS1065") */
	linked_document_type: string;
	/** File ID of linked document */
	linked_file_id: string;
	/** Type of relationship: "belongs_to", "supports", "references" */
	relationship_type: string;
	/** Overall match confidence (0.0-1.0) */
	confidence: number;
	/** Entities that matched (e.g., {partnership_ein: "12-3456789", tax_year: "2023"}) */
	matched_entities: Record<string, string>;
	/** Detailed match results per field */
	match_details: Array<{
		source_field: string;
		target_field: string;
		match_type: string;
		matched: boolean;
		source_value?: string;
		target_value?: string;
		optional?: boolean;
		required_any_of?: boolean;
	}>;
	/** Warning messages for this link (e.g., "Linked by name only") */
	warnings?: string[];
	/** True if multiple documents matched the same criteria */
	ambiguous?: boolean;
}

export interface ExtractedDocument {
	/** Unique document ID (doc_id from Memgraph) */
	id: string;
	document_type: string;
	/** Human-readable description for custom/non-MISMO types (LLM or user provided) */
	description?: string;
	classification_confidence: number;
	file_id: string;
	pages: DocumentPageRef[];
	effective_period?: EffectivePeriod;
	period_status: "determined" | "undetermined" | "not_applicable";
	period_flag_reason?: string;
	facts: Fact[];
	facts_count: number;
	/** Extracted table/region data (e.g., credit_scores, trade_accounts) */
	tables?: Array<{
		region_id: string;
		region_type: string;
		semantic_type: string;
		page_number: number;
		columns: string[];
		semantic_mapping: Record<string, string>;
		rows: Array<{ row_index: number; cells: Record<string, unknown> }>;
		row_count: number;
		table_bounds?: BoundingBox;
	}>;
	tables_count?: number;
	/** Current processing status - for incremental UI updates */
	processing_status?: ProcessingStatus;
	/** Human-readable processing message */
	processing_message?: string;
	/** Validation status - for showing Tier 3/4 validation progress */
	validation_status?: ValidationStatus;
	/** Human-readable validation message */
	validation_message?: string;
	/** Number of validation issues found */
	validation_issues_count?: number;
	/** Validation score (0.0-1.0) */
	validation_score?: number;
	/** Parent document type for supporting schedules (e.g., Schedule K-1 → Form 1065) */
	parent_document_type?: string;
	/** Dynamic entity-based links to related documents */
	linked_documents?: DocumentLink[];
}

export interface IdentifiedParties {
	parties: Party[];
	total_parties_found: number;
}

/**
 * FeneroFinancialIdentity - Stable identity for income attribution.
 *
 * FFI survives name variations across documents. Each person/business gets
 * a unique FFI ID used for income grouping and attribution.
 */
export interface FeneroFinancialIdentity {
	ffi_id: string;
	ffi_type: "ssn" | "generated" | "ein" | "joint";
	canonical_name: string;
	display_name: string;
	name_aliases: string[];
	entity_type: "person" | "business";
	borrower_role: "primary" | "co_borrower" | "";
	ssn_last4?: string;
	identifiers: Record<string, string>;
	joint_with?: string;
	child_entities: string[];
}

/**
 * FinancialEntities - Collection of all financial entities for a case.
 *
 * Stored in snapshot under extractions.financial_entities.
 * Used by income verification to filter and group facts.
 */
export interface FinancialEntities {
	borrowers: FeneroFinancialIdentity[];
	businesses: FeneroFinancialIdentity[];
	/** First joint FFI ID for backward compatibility */
	joint_ffi_id?: string;
	/** All joint FFI IDs - one per married couple from different 1040s */
	joint_ffi_ids: string[];
	is_joint_filing: boolean;
	borrower_selection_complete: boolean;
	/** Normalized uppercase names of parties marked as 'ignore' by user */
	ignored_party_names: string[];
	/** Filing status detected from 1040 (e.g., 'Married Filing Jointly', 'Single') */
	detected_filing_status?: string;
	/** User override for filing status if auto-detection is wrong */
	user_filing_status?: string;
}

export interface GunnrExtractions {
	documents: ExtractedDocument[];
	parties?: IdentifiedParties;
	financial_entities?: FinancialEntities;
	total_documents: number;
	total_facts: number;
}

export interface GunnrSummary {
	overall_decision: "ready_for_underwriting" | "needs_more_docs" | "reject_packet";
	overall_confidence: number;
	executive_summary: string;
	documents_accepted: number;
	documents_rejected: number;
	documents_flagged: number;
}

export interface GunnrStip {
	stip_type: string;
	missing_document: string;
	reason: string;
	priority: "required" | "recommended";
}

export interface DocumentDecision {
	document_class: string;
	decision: string;
	reason: string;
	pages: number[];
	confidence: number;
}

export interface GunnrInterpretations {
	summary: GunnrSummary;
	stips: GunnrStip[];
	document_decisions: DocumentDecision[];
	recommendations: string[];
	key_figures: Record<string, unknown>;
}

/**
 * PendingHints - Look-ahead hints for skeleton loading.
 *
 * Provided by backend in snapshots to tell frontend what's coming next,
 * enabling consistent skeleton rendering without guessing or state jitter.
 */
export interface PendingHints {
	/** Current processing phase */
	phase: "opening" | "loading" | "classifying" | "extracting" | "validating" | "summary";
	/** Next phase to transition to */
	next_phase: string;
	/** Expected number of documents per file (for skeleton placeholders) */
	expected_documents_per_file: number;
	/** Total pages discovered (populated after load phase) */
	total_pages?: number;
}

/**
 * GunnrOutputDTO - Complete extraction result with three-tier structure.
 *
 * This is the new canonical structure stored in GCS:
 * - artifacts: Physical inputs (files, pages)
 * - extractions: What was extracted (documents, facts, parties)
 * - interpretations: Derived insights (summary, stips, recommendations)
 */
export interface GunnrOutput {
	case_id: string;
	artifacts: GunnrArtifacts;
	extractions: GunnrExtractions;
	interpretations: GunnrInterpretations;
}

/**
 * CaseResult - Union type supporting both new and legacy structures.
 *
 * Use isNewStructure() helper to detect which format is in use.
 */
export interface CaseResult {
	case_id: string;

	// New structure (GunnrOutputDTO)
	artifacts?: GunnrArtifacts;
	extractions?: GunnrExtractions;
	interpretations?: GunnrInterpretations;

	// Look-ahead hints for skeleton loading (from pending field in snapshots)
	pending?: PendingHints;

	// Legacy structure (flat)
	total_pages?: number;
	total_facts?: number;
	total_time_ms?: number;
	validation_issues?: number;
	pages?: PageResult[];
	parties?: Party[];
	overall_status?: "complete" | "needs_review" | "incomplete";
	executive_summary?: string;
	tier4?: Record<string, unknown>;
	cross_document_issues?: CrossDocumentIssue[];
}

/**
 * Helper to detect if result uses new GunnrOutputDTO structure.
 */
export function isNewStructure(result: CaseResult): result is GunnrOutput {
	return "artifacts" in result && "extractions" in result && "interpretations" in result;
}

/**
 * Helper to get total pages from either structure.
 */
export function getTotalPages(result: CaseResult): number {
	if (isNewStructure(result)) {
		return result.artifacts.total_pages;
	}
	return result.total_pages ?? result.pages?.length ?? 0;
}

/**
 * Helper to get total facts from either structure.
 */
export function getTotalFacts(result: CaseResult): number {
	if (isNewStructure(result)) {
		return result.extractions.total_facts;
	}
	return result.total_facts ?? 0;
}

/**
 * Helper to get executive summary from either structure.
 */
export function getExecutiveSummary(result: CaseResult): string {
	if (isNewStructure(result)) {
		return result.interpretations.summary.executive_summary;
	}
	return result.executive_summary ?? "";
}

/**
 * Helper to get files from either structure.
 */
export function getFiles(result: CaseResult): FileArtifact[] {
	if (isNewStructure(result)) {
		return result.artifacts.files;
	}
	// Legacy structure doesn't have files at top level
	return [];
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface UploadResponse {
	case_id: string;
	file_count: number;
}

export interface VersionInfo {
	version: number;
	created_at: string;
	snapshot_type: string;
}

// =============================================================================
// APP STATE
// =============================================================================

export type StreamStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

export interface AppState {
	sidebarCollapsed: boolean;
	currentCaseId: string | null;
	streamStatus: StreamStatus;
	pendingEdits: Record<string, Fact[]>; // pageKey -> edited facts
}

// =============================================================================
// LOADED FILES (from SSE events during upload)
// =============================================================================

export interface LoadedFile {
	file_id: string;
	filename: string;
	page_count: number;
	status: "loading" | "classifying" | "extracting" | "complete";
}
