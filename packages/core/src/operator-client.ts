/**
 * Operator client — bearer-token authenticated access to Veritas.
 *
 * Covers the full case lifecycle: spec generation, case creation,
 * file upload, event streaming, audit retrieval. All paths include
 * the /api prefix used by the Veritas API router.
 *
 * Implementation is split by domain:
 *   operator-types.ts  — shared type definitions
 *   operator-spec.ts   — spec management + AI generation
 *   operator-cases.ts  — case lifecycle, events, docs, banking
 */

export type {
	CaseResponse,
	SpecAuditResponse,
	CalculationStepResponse,
	SpecResponse,
	DocumentResponse,
	ExtractionResponse,
	ExtractionSourceResponse,
	BboxResponse,
	BankingAccount,
	BankingBorrowerRollup,
	BankingResponse,
	TransactionRow,
	TransactionRegion,
	TransactionsResponse,
	CaseEvent,
	CaseEventType,
	GenerateSpecResult,
	OperatorClientConfig,
	OperatorClientError,
	Result,
} from "./operator-types.js";
import type { OperatorClientConfig, Result } from "./operator-types.js";

import { createSpecMethods } from "./operator-spec.js";
import { createCaseMethods } from "./operator-cases.js";

export function createOperatorClient(config: OperatorClientConfig) {
	const base = config.baseUrl ?? "";
	const token = config.bearerToken;

	function authHeaders(extra?: Record<string, string>): Record<string, string> {
		return { Authorization: `Bearer ${token}`, ...extra };
	}

	async function request<T>(res: Response): Promise<Result<T>> {
		if (!res.ok) {
			const message = await res.text().catch(() => res.statusText);
			return { data: null, error: { status: res.status, message } };
		}
		const data = (await res.json()) as T;
		return { data, error: null };
	}

	return {
		...createSpecMethods(base, authHeaders, request),
		...createCaseMethods(base, authHeaders, request),
	};
}

export type OperatorClient = ReturnType<typeof createOperatorClient>;
