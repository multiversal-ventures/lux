/**
 * AUE (Autonomous Extraction Units) API hooks
 *
 * Separate API endpoints for AUE workflow that stores results in Memgraph.
 * Uses /api/aue/... endpoints instead of legacy /api/v1/...
 */

import { apiRequest } from "../lib/api";
import type { CaseResult } from "../types";

const AUE_BASE_URL = "/api/aue";

/**
 * Generic fetch wrapper for AUE endpoints.
 */
async function aueFetch<T>(url: string, options?: RequestInit): Promise<T> {
	return apiRequest<T>(`${AUE_BASE_URL}${url}`, options);
}

// =============================================================================
// Types
// =============================================================================

export interface StartAueRequest {
	tenant_id?: string;
	loan_product_id?: string;
	rules_version?: string;
}

export interface StartAueResponse {
	case_id: string;
	workflow_id: string;
	status: string;
	message: string;
	stream_url: string;
}

export interface AueStatusResponse {
	case_id: string;
	workflow_id: string;
	status: string;
	message: string;
	result?: {
		case_id: string;
		status: string;
		identities: Array<Record<string, unknown>>;
		confidence: number;
		lineage_hash: string;
		income_result?: any; // Structured income verification result
	};
}

export interface AueParty {
	id: string;
	name: string;
	role: string;
	party_type: string;
	identifiers: Record<string, string>;
	source_refs: Array<{
		file_id: string;
		document_type: string;
		page_number: number;
		field_name: string;
	}>;
	name_aliases?: string[];
	merged_from?: Array<{
		party_id: string;
		name: string;
	}>;
}

export interface AuePartiesResponse {
	parties: AueParty[];
	count: number;
}

export interface MergeAuePartiesRequest {
	source_party_id: string;
	target_party_id: string;
	new_name?: string;
}

export interface MergeAuePartiesResponse {
	status: string;
	target_party: AueParty;
	message: string;
}

export interface BorrowerSelection {
	party_id: string;
	role: "primary" | "co_borrower" | "ignore";
}

export interface SaveBorrowerSelectionRequest {
	selections: BorrowerSelection[];
	user_filing_status?: string;
}

export interface SaveBorrowerSelectionResponse {
	status: string;
	case_id: string;
	selection_count: number;
	message: string;
}

// =============================================================================
// AUE Workflow APIs
// =============================================================================

/**
 * Start AUE extraction workflow for a case.
 * Returns immediately with workflow ID - monitor progress via SSE.
 */
export async function startAueWorkflow(
	caseId: string,
	request: StartAueRequest = {},
): Promise<StartAueResponse> {
	return aueFetch<StartAueResponse>(`/cases/${caseId}/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Get AUE workflow status.
 */
export async function getAueStatus(caseId: string): Promise<AueStatusResponse> {
	return aueFetch<AueStatusResponse>(`/cases/${caseId}/status`);
}

/**
 * Get full case result from Memgraph in UI-compatible format.
 * This is the AUE equivalent of getCaseResult().
 */
export async function getAueCaseResult(caseId: string): Promise<CaseResult> {
	return aueFetch<CaseResult>(`/cases/${caseId}/result`);
}

// =============================================================================
// Party/Identity Management APIs
// =============================================================================

/**
 * Get all parties (identities) for a case from Memgraph.
 */
export async function getAueParties(caseId: string): Promise<AuePartiesResponse> {
	return aueFetch<AuePartiesResponse>(`/cases/${caseId}/parties`);
}

/**
 * Merge two parties in Memgraph.
 * Source party is absorbed into target party.
 */
export async function mergeAueParties(
	caseId: string,
	request: MergeAuePartiesRequest,
): Promise<MergeAuePartiesResponse> {
	return aueFetch<MergeAuePartiesResponse>(`/cases/${caseId}/parties/merge`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

/**
 * Save borrower role selections.
 * Assigns roles (primary, co_borrower, ignore) to identities.
 */
export async function saveAueBorrowerSelection(
	caseId: string,
	request: SaveBorrowerSelectionRequest,
): Promise<SaveBorrowerSelectionResponse> {
	return aueFetch<SaveBorrowerSelectionResponse>(`/cases/${caseId}/borrower-selection`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(request),
	});
}

// =============================================================================
// React Hook
// =============================================================================

import { useCallback, useState } from "react";

export interface UseAueApiState {
	loading: boolean;
	error: Error | null;
}

/**
 * Hook for AUE API operations with loading/error state.
 */
export function useAueApi() {
	const [state, setState] = useState<UseAueApiState>({
		loading: false,
		error: null,
	});

	const execute = useCallback(async <T>(operation: () => Promise<T>): Promise<T | null> => {
		setState({ loading: true, error: null });
		try {
			const result = await operation();
			setState({ loading: false, error: null });
			return result;
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			setState({ loading: false, error });
			return null;
		}
	}, []);

	return {
		...state,
		execute,
		// Convenience methods
		startWorkflow: useCallback(
			(caseId: string, request?: StartAueRequest) =>
				execute(() => startAueWorkflow(caseId, request)),
			[execute],
		),
		getStatus: useCallback((caseId: string) => execute(() => getAueStatus(caseId)), [execute]),
		getCaseResult: useCallback(
			(caseId: string) => execute(() => getAueCaseResult(caseId)),
			[execute],
		),
		getParties: useCallback((caseId: string) => execute(() => getAueParties(caseId)), [execute]),
		mergeParties: useCallback(
			(caseId: string, request: MergeAuePartiesRequest) =>
				execute(() => mergeAueParties(caseId, request)),
			[execute],
		),
		saveBorrowerSelection: useCallback(
			(caseId: string, request: SaveBorrowerSelectionRequest) =>
				execute(() => saveAueBorrowerSelection(caseId, request)),
			[execute],
		),
	};
}
