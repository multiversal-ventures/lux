import type { AuthProvider } from "./auth.js";
import type { StructuredExtractionsResponse } from "./extractions.js";
import type { components } from "./generated.js";
import {
	type NormalizedRefinement,
	normalizeRefinement,
	normalizeVeritasStatus,
} from "./normalize.js";

// ─────────────────────────────────────────────────────────────────────────────
// VeritasClient — typed HTTP client for Veritas / dashboard-style apps
// (Bearer tokens, optional Veritas-Version header, error hooks).
// ─────────────────────────────────────────────────────────────────────────────

export interface MeResponse {
	user_id: string;
	email: string | null;
	display_name: string | null;
	caller_type: string;
	tenant_id: string | null;
	has_tenant: boolean;
	role: string | null;
	permissions: string[];
}

export interface CreateTenantResponse {
	tenant_id: string;
	tenant_name: string;
	role: string;
	has_tenant: boolean;
}

export interface VeritasCaseFile {
	file_id: string;
	original_filename: string | null;
	uploaded_at: string | null;
	total_pages: number;
}

export interface VeritasCaseDocument {
	doc_id: string;
	doc_type: string | null;
	original_filename: string | null;
	file_id: string;
	page_numbers: number[] | null;
	effective_period_start: string | null;
	effective_period_end: string | null;
	tax_year: number | null;
}

/**
 * Relationship between two identity clusters.
 * Manually typed — Veritas OpenAPI doesn't yet export RelationshipInfo.
 */
export interface RelationshipInfo {
	relationship_id: string;
	source: { id: string; kind: "person" | "entity" };
	target: { id: string; kind: "person" | "entity" };
	type: string;
	ownership_pct: number | null;
	effective_period: string | null;
	is_primary: boolean;
}

/** Entity group returned by GET /api/cases/{case_id}/entities */
export interface VeritasEntityGroup {
	entity_group_id: string;
	case_id: string;
	entity_type: string;
	identifier_type: string;
	identifier_value: string;
	label: string;
	resolution_method: string;
	status: string;
	doc_ids: string[];
	parent_entity_group_id: string | null;
	borrower_identity_id: string | null;
}

export interface VeritasCaseEvent {
	event_id: number;
	event_type: string;
	event_data: Record<string, unknown>;
	created_at: string | null;
}

export interface VeritasCaseDetail {
	case_id: string;
	tenant_id: string;
	spec_id: string | null;
	state: string;
	pool_version: number;
	created_at: string | null;
	file_count?: number;
	primary_borrower?: string | null;
}

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
	state: string;
	file_count: number;
	sample_id: string;
}

/**
 * A published, product-scoped borrower intake link (`GET/POST /api/pos-portals`).
 *
 * Wire shape, unmapped: this client passes the server's field names through
 * exactly as `MeResponse` and `VeritasCaseFile` do. `url` is whatever the
 * server composed — absolute when the deployment sets a public base URL,
 * site-relative (`/apply/<slug>`) when it does not, so never assume an origin.
 *
 * `expires_at` and `created_at` are optional AND nullable on the server, not
 * merely nullable: read them with `?? null`, never assume the key is present.
 */
export type PosPortal = components["schemas"]["PosPortalResponse"];

/** Body for `POST /api/pos-portals`. The slug is minted server-side. */
export type CreatePosPortalRequest = components["schemas"]["CreatePosPortalRequest"];

/**
 * One application started from a published link
 * (`GET /api/pos-portals/{id}/cases`).
 *
 * `name` is null and `parties[].display_name` is null for an applicant who has
 * only typed an email into a public form — which is every borrower who has not
 * yet entered their access code. The email is therefore the row's identity;
 * there is nothing else to render.
 *
 * `state` is the raw case state (`awaiting_verification`, `awaiting_documents`,
 * …), passed through unmapped. These rows are deliberately NOT in the operator
 * queue (`GET /api/cases` hides `awaiting_verification`), which is the whole
 * reason this sub-resource exists.
 */
export type PosPortalCase = components["schemas"]["PosPortalCaseResponse"];

/** One person on a POS application. Carries the `party_id`
 * {@link VeritasClient.resendAccessCode} is addressed by. Never a code. */
export type PosPortalCaseParty = components["schemas"]["PosPortalPartyResponse"];

/** `{ok, detail}` from a successful resend. Carries neither the access code nor
 * the address — see the route's docstring. */
export type ResendCodeResult = components["schemas"]["ResendCodeResponse"];

/** One loan on the borrower's own dashboard: the case's borrower-facing status
 * and summary, flattened and keyed by case, plus a portal token that drives
 * into that loan's portal. There is no decision block — the card links INTO the
 * decision rather than summarising it — and `action_count` rides on `status`.
 * `created_at` / `updated_at` are nullable because the case columns are. */
export type BorrowerLoanRow = components["schemas"]["BorrowerLoanRow"];

/** What `linkBorrowerAccount` bound, and for whom. `account_kind: "operator"`
 * means nothing was linked because the signed-in user is staff. */
export type LinkAccountResponse = components["schemas"]["LinkAccountResponse"];

/** Prefill for the officer's decision form. `basis` null = no analysis yet;
 * `current_status` null = the case has no portal party. */
export type DecisionDraftResponse = components["schemas"]["DecisionDraftResponse"];

/** The officer's submitted decision. `result_id` names the calculation the
 * terms are snapshotted from — the officer types no numbers. */
export type PublishDecisionRequest = components["schemas"]["PublishDecisionRequest"];

/** One published decision, as the borrower was told it. */
export type DecisionResponse = components["schemas"]["DecisionResponse"];

/** Every decision on a case, newest first, plus the current borrower status
 * (which is null for a case with no portal party). */
export type DecisionHistoryResponse = components["schemas"]["DecisionHistoryResponse"];

/** The two lists a borrower's session already carries, re-resolved against a
 * draft of unsaved answers. Same models, so existing components render it
 * unchanged. Both lists are empty for a case not scoped to one product. */
export type FormPreviewResponse = components["schemas"]["FormPreviewResponse"];

/** What the borrower is told about their loan right now. Every string —
 * `label`, `tone`, `description` — is DATA from `borrower_statuses.yaml`; a
 * client renders them and re-labels nothing. */
export type LoanStatusInfo = components["schemas"]["LoanStatusInfo"];

/** Which loan this is, in the product's own words. `property_label` is the
 * case's primary SUBJECT — a person's name for a person-primary product, and
 * null until something has been extracted — which is why `product_label` is
 * carried alongside it rather than behind it. */
export type LoanSummaryInfo = components["schemas"]["LoanSummaryInfo"];

/** One labelled line of a loan summary, or of a decision's terms. */
export type LoanSummaryField = components["schemas"]["LoanSummaryField"];

/** A published decision as the borrower sees it on their session. `terms` and
 * `conditions` are read from the stored snapshot, never recomputed.
 * `conditions_state` is "outstanding", "received", or null when this party was
 * never sent the decision. */
export type LoanDecisionInfo = components["schemas"]["LoanDecisionInfo"];

export type ClientHooks = {
	onApiError?: (info: {
		error_type: string;
		error_message: string;
		error_code: string;
		page_url?: string;
		user_id?: string;
	}) => void;
};

export type VeritasClientConfig = {
	/** Optional API origin (no trailing slash). Empty = same-origin relative paths. */
	baseUrl: string;
	auth: AuthProvider;
	/** Sent as `Veritas-Version` when set. */
	veritasVersion?: string;
	hooks?: ClientHooks;
};

export class APIError extends Error {
	status: number;
	data?: unknown;

	constructor(message: string, status: number, data?: unknown) {
		super(message);
		this.name = "APIError";
		this.status = status;
		this.data = data;
	}
}

export function resolveApiPath(baseUrl: string, path: string): string {
	const trimmed = baseUrl.trim().replace(/\/$/, "");
	const p = path.startsWith("/") ? path : `/${path}`;
	if (!trimmed) return p;
	return `${trimmed}${p}`;
}

/**
 * Typed HTTP client for Veritas / Gunnr APIs (Bearer + optional Veritas-Version).
 */
export class VeritasClient {
	constructor(private readonly cfg: VeritasClientConfig) {}

	get baseUrl(): string {
		return this.cfg.baseUrl;
	}

	resolvePath(path: string): string {
		return resolveApiPath(this.cfg.baseUrl, path);
	}

	async requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const method = (options.method || "GET").toUpperCase();
		const url = this.resolvePath(path);
		const t0 = typeof performance !== "undefined" ? performance.now() : 0;
		const response = await fetch(url, { ...options, headers });
		const elapsed = typeof performance !== "undefined" ? Math.round(performance.now() - t0) : 0;

		if (!response.ok) {
			console.warn(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		} else {
			console.debug(`[VeritasClient] ${method} ${url} → ${response.status} (${elapsed}ms)`);
		}

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			let errorMessage: string;
			const detail = ed?.detail;
			if (typeof detail === "object" && detail !== null && "message" in detail) {
				errorMessage = String((detail as { message?: unknown }).message ?? "Error");
			} else if (typeof detail === "string") {
				errorMessage = detail;
			} else if (typeof ed?.message === "string") {
				errorMessage = ed.message;
			} else {
				errorMessage = `API Error: ${response.status}`;
			}
			const structured = typeof detail === "object" && detail !== null ? detail : errorData;
			const error = new APIError(errorMessage, response.status, structured);
			this.cfg.hooks?.onApiError?.({
				error_type: "server",
				error_message: error.message,
				error_code: String(response.status),
				page_url:
					typeof globalThis !== "undefined" && "location" in globalThis
						? globalThis.location.href
						: undefined,
			});
			throw error;
		}

		const contentType = response.headers.get("content-type");
		if (contentType?.includes("application/json")) {
			return (await response.json()) as T;
		}
		return (await response.text()) as T;
	}

	async uploadMultipart<T>(
		path: string,
		formData: FormData,
		options: RequestInit = {},
	): Promise<T> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {
			...(options.headers as Record<string, string>),
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const v = this.cfg.veritasVersion;
		if (v) headers["Veritas-Version"] = v;

		const url = this.resolvePath(path);
		const response = await fetch(url, {
			...options,
			method: "POST",
			headers,
			body: formData,
		});

		if (!response.ok) {
			const text = await response.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			throw new APIError(
				String(ed?.detail ?? `Upload failed: ${response.status}`),
				response.status,
				errorData,
			);
		}
		return (await response.json()) as T;
	}

	async getMe(): Promise<MeResponse> {
		return this.requestJson<MeResponse>("/api/auth/me");
	}

	async createTenant(name: string): Promise<CreateTenantResponse> {
		return this.requestJson<CreateTenantResponse>("/api/auth/create-tenant", {
			method: "POST",
			body: JSON.stringify({ name }),
		});
	}

	async createCase(body?: {
		spec_id?: string | null;
		name?: string | null;
		spec_filter?: string[];
		initial_context?: Record<string, Record<string, unknown>> | null;
	}): Promise<{ case_id: string; spec_id: string | null }> {
		const payload: Record<string, unknown> = {};
		if (body?.spec_id) payload.spec_id = body.spec_id;
		if (body?.name) payload.name = body.name;
		if (body?.spec_filter && body.spec_filter.length > 0) payload.spec_filter = body.spec_filter;
		if (body?.initial_context) payload.initial_context = body.initial_context;
		return this.requestJson(`/api/cases`, { method: "POST", body: JSON.stringify(payload) });
	}

	/** Issue a one-time, 48h borrower portal token for a case (operator-only),
	 * with an optional document/follow-up request the borrower portal renders.
	 * Returns the token + expiry; the caller builds the shareable URL. */
	async createPortalLink(
		caseId: string,
		body?: components["schemas"]["PortalLinkRequest"],
	): Promise<components["schemas"]["PortalLinkResponse"]> {
		return this.requestJson<components["schemas"]["PortalLinkResponse"]>(
			`/api/cases/${caseId}/portal`,
			{ method: "POST", body: body ? JSON.stringify(body) : undefined },
		);
	}

	/** Operator status of the case's borrower portal link (none/waiting/submitted),
	 * for rendering the Portal Link button state. */
	async getPortalLinkStatus(
		caseId: string,
	): Promise<components["schemas"]["PortalLinkStatusResponse"]> {
		return this.requestJson<components["schemas"]["PortalLinkStatusResponse"]>(
			`/api/cases/${caseId}/portal/status`,
		);
	}

	/** Suggested follow-up / document items for the portal request modal
	 * (derived from the case's findings; operator picks which to request).
	 *
	 * When ``partyId`` is given the suggestions are party-aware — shaped by that
	 * party's role (Primary vs Co-borrower) and the documents they appear on, so
	 * two parties on the same case get different asks. Omit it for the
	 * case-scoped (back-compat) view. */
	async getPortalSuggestions(
		caseId: string,
		partyId?: string,
	): Promise<components["schemas"]["PortalRequestItem"][]> {
		const qs = partyId ? `?party_id=${encodeURIComponent(partyId)}` : "";
		return this.requestJson<components["schemas"]["PortalRequestItem"][]>(
			`/api/cases/${caseId}/portal/suggestions${qs}`,
		);
	}

	/** On-demand fresh suggestions that honor the operator's typed note and skip
	 * already-shown titles ('generate more'). Never reads/writes the prepared cache. */
	async regeneratePortalSuggestions(
		caseId: string,
		body: components["schemas"]["RegenerateSuggestionsBody"],
	): Promise<components["schemas"]["PortalRequestItem"][]> {
		return this.requestJson<components["schemas"]["PortalRequestItem"][]>(
			`/api/cases/${caseId}/portal/suggestions/regenerate`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	// -- Party Hub (operator) --------------------------------------------------

	/** Operator typing signal — broadcast to the borrower's portal stream. */
	async sendOperatorTyping(caseId: string): Promise<void> {
		try {
			await this.requestJson<unknown>(`/api/cases/${caseId}/portal/typing`, { method: "POST" });
		} catch {
			/* typing is best-effort */
		}
	}

	/** Cases the signed-in borrower (magic-link account) can access, each with a
	 * fresh portal token. Authed by the borrower's Firebase JWT. */
	async getMyCases(): Promise<components["schemas"]["MyCaseLink"][]> {
		return this.requestJson<components["schemas"]["MyCaseLink"][]>(`/api/portal/my-cases`);
	}

	/** The signed-in borrower's loans for their own dashboard, newest-updated
	 * first. Authed by the borrower's Firebase JWT.
	 *
	 * Throws an {@link APIError} with `status === 403` both for an operator uid
	 * and for a uid with no borrower record — which is also how "no
	 * applications yet" arrives. The pair to read is
	 * {@link linkBorrowerAccount} first: `{linked: 0, account_kind:
	 * "borrower"}` followed by a 403 here means the borrower simply has no
	 * loans, NOT an error; `account_kind: "operator"` means the signed-in user
	 * is staff. The client deliberately does not fold either case into `[]` —
	 * the two are different things to say to a user. */
	async listMyLoans(): Promise<BorrowerLoanRow[]> {
		return this.requestJson<BorrowerLoanRow[]>("/api/portal/my-loans");
	}

	/** Bind every portal party that matches this account's verified email to the
	 * signed-in uid, so the borrower's loans show up on their dashboard.
	 *
	 * Must be called on EVERY sign-in: a POS borrower's parties are created
	 * without a uid and are never linked otherwise. `linked` is the number of
	 * parties newly bound, so a repeat call answering 0 is success, not a
	 * failure. The route takes the Firebase id token in the BODY (it has no
	 * portal token and no Bearer gate of its own). */
	async linkBorrowerAccount(firebaseIdToken: string): Promise<LinkAccountResponse> {
		return this.requestJson<LinkAccountResponse>("/api/portal/account/link", {
			method: "POST",
			body: JSON.stringify({ firebase_id_token: firebaseIdToken }),
		});
	}

	// -- Decisions (operator) ---------------------------------------------------

	/** What to prefill the officer's decision form with: the outcome kinds they
	 * may publish, the terms snapshotted off the latest calculation, suggested
	 * conditions, and the status the borrower currently sees.
	 *
	 * `current_status` is null for a case with no portal party, and `basis` is
	 * null when no analysis has run — the form stays usable in both. */
	async getDecisionDraft(caseId: string): Promise<DecisionDraftResponse> {
		return this.requestJson<DecisionDraftResponse>(
			`/api/cases/${encodeURIComponent(caseId)}/decision/draft`,
		);
	}

	/** Publish the officer's decision — the only thing that puts an outcome in
	 * front of a borrower. `result_id` names the calculation the terms are
	 * snapshotted from, which is why the officer types no numbers. */
	async publishDecision(caseId: string, body: PublishDecisionRequest): Promise<DecisionResponse> {
		return this.requestJson<DecisionResponse>(`/api/cases/${encodeURIComponent(caseId)}/decision`, {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	/** Every decision published on the case, newest first, plus the current
	 * borrower-facing status (null when the case has no portal party). */
	async listDecisions(caseId: string): Promise<DecisionHistoryResponse> {
		return this.requestJson<DecisionHistoryResponse>(
			`/api/cases/${encodeURIComponent(caseId)}/decisions`,
		);
	}

	/** Full operator overview of a case's portal: parties, threads, verification,
	 * shared uploaded documents. Drives the Party Hub page. */
	async getPortalOverview(caseId: string): Promise<components["schemas"]["PortalOverview"]> {
		return this.requestJson<components["schemas"]["PortalOverview"]>(`/api/cases/${caseId}/portal`);
	}

	/** Operator "what we know about this party" profile: identity, masked
	 * identifiers (tail only — never the full SSN/EIN), contact/address facts,
	 * where the party is mentioned, and lifecycle status. */
	async getPartyProfile(
		caseId: string,
		partyId: string,
	): Promise<components["schemas"]["PartyProfile"]> {
		return this.requestJson<components["schemas"]["PartyProfile"]>(
			`/api/cases/${caseId}/portal/parties/${partyId}/profile`,
		);
	}

	/** Page one party's composed thread (request/reply/upload bubbles). */
	async getPartyMessages(
		caseId: string,
		partyId: string,
		opts: { before?: string; limit?: number } = {},
	): Promise<components["schemas"]["ThreadPage"]> {
		const qs = new URLSearchParams();
		if (opts.before) qs.set("before", opts.before);
		if (opts.limit) qs.set("limit", String(opts.limit));
		const suffix = qs.toString() ? `?${qs.toString()}` : "";
		return this.requestJson<components["schemas"]["ThreadPage"]>(
			`/api/cases/${caseId}/portal/parties/${partyId}/messages${suffix}`,
		);
	}

	/** Resolved case identities not yet engaged as a portal party ("add party"). */
	async getPortalCandidates(caseId: string): Promise<components["schemas"]["PartyCandidate"][]> {
		return this.requestJson<components["schemas"]["PartyCandidate"][]>(
			`/api/cases/${caseId}/portal/candidates`,
		);
	}

	/** Append a request to a party's thread (reuses the party's persistent link). */
	async sendPortalRequest(
		caseId: string,
		body: components["schemas"]["SendRequestBody"],
	): Promise<components["schemas"]["SendRequestResponse"]> {
		return this.requestJson<components["schemas"]["SendRequestResponse"]>(
			`/api/cases/${caseId}/portal/requests`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	/** AI-draft borrower-friendly request text (draft only — operator edits + sends). */
	async draftPortalRequest(
		caseId: string,
		body: components["schemas"]["DraftRequestBody"],
	): Promise<components["schemas"]["DraftResponse"]> {
		return this.requestJson<components["schemas"]["DraftResponse"]>(
			`/api/cases/${caseId}/portal/requests/draft`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	/** Create a portal party (individual or entity) for a case. */
	async addParty(
		caseId: string,
		body: components["schemas"]["AddPartyBody"],
	): Promise<components["schemas"]["PartyCreatedResponse"]> {
		return this.requestJson<components["schemas"]["PartyCreatedResponse"]>(
			`/api/cases/${caseId}/portal/parties`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	/** Set a party's role on a case document (spec-style entity↔document relation). */
	async attachPartyDocument(
		caseId: string,
		partyId: string,
		body: components["schemas"]["AttachDocBody"],
	): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}/documents`, {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	/** Remove a party (and its thread) from a case's portal. */
	async deleteParty(caseId: string, partyId: string): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}`, {
			method: "DELETE",
		});
	}

	/** Clear a party's conversation thread (keeps the party + link) so the
	 * operator can start over / resend; also resets the captured email. */
	async clearPartyThread(caseId: string, partyId: string): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}/messages`, {
			method: "DELETE",
		});
	}

	/** Soft-delete a single message from a party's thread (operator side). Own-only:
	 * the operator may delete only operator-authored messages (the server 403s on a
	 * borrower message); upload bubbles are not deletable (the server 404s). The row
	 * is kept so the thread renders a deleted tombstone. */
	async deletePartyMessage(caseId: string, partyId: string, messageId: string): Promise<void> {
		await this.requestJson<unknown>(
			`/api/cases/${caseId}/portal/parties/${partyId}/messages/${encodeURIComponent(messageId)}`,
			{ method: "DELETE" },
		);
	}

	/** Edit the body of one of the operator's OWN messages on a party's thread.
	 * Own-only: the server 403s on a borrower message, 404s a deleted one, and 422s
	 * an empty body. The bubble gets an "· edited" indicator. */
	async editPartyMessage(
		caseId: string,
		partyId: string,
		messageId: string,
		body: string,
	): Promise<void> {
		await this.requestJson<unknown>(
			`/api/cases/${caseId}/portal/parties/${partyId}/messages/${encodeURIComponent(messageId)}`,
			{ method: "PATCH", body: JSON.stringify({ body }) },
		);
	}

	/** Reissue a party's portal link — resets the access code and attempt counter. */
	async reissueLink(caseId: string, partyId: string): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}/reissue`, {
			method: "POST",
		});
	}

	/** Operator marks a party's borrower messages as read → flips the borrower's
	 * receipt from ✓ (sent) to ✓✓ (read). Best-effort: a read receipt failing
	 * must never break the operator view. */
	async markThreadRead(caseId: string, partyId: string): Promise<void> {
		try {
			await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}/read`, {
				method: "POST",
			});
		} catch {
			/* read receipt is best-effort */
		}
	}

	/** Link a party to a resolved case identity. */
	async linkParty(
		caseId: string,
		partyId: string,
		body: components["schemas"]["LinkPartyBody"],
	): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}/portal/parties/${partyId}/link`, {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	// -- Officer settings (chat avatar) ----------------------------------------

	/** The firm's loan-officer profile (name + avatar data URL) shown on the
	 * operator's own chat bubbles and on every borrower's portal. */
	async getOfficerSettings(): Promise<components["schemas"]["OfficerProfile"]> {
		return this.requestJson<components["schemas"]["OfficerProfile"]>(`/api/settings/officer`);
	}

	/** Set the loan-officer avatar (data URL), or clear it with `null`. */
	async setOfficerAvatar(avatar: string | null): Promise<components["schemas"]["OfficerProfile"]> {
		return this.requestJson<components["schemas"]["OfficerProfile"]>(`/api/settings/officer`, {
			method: "PUT",
			body: JSON.stringify({ avatar }),
		});
	}

	// -- POS portals (published borrower intake links) --------------------------

	/** Publish a reusable, product-scoped intake link for this tenant.
	 *
	 * The slug is minted server-side — it is not a client input. `product_id` is
	 * validated against the products this tenant has enabled; an unknown one
	 * comes back as a 400 whose `detail` string becomes the `APIError` message. */
	async createPosPortal(body: CreatePosPortalRequest): Promise<PosPortal> {
		return this.requestJson<PosPortal>("/api/pos-portals", {
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	/** This tenant's intake links, newest first. Deactivated ones are included. */
	async listPosPortals(): Promise<PosPortal[]> {
		return this.requestJson<PosPortal[]>("/api/pos-portals");
	}

	/** Soft-disable a link: the row survives, so a bookmarked `/apply/<slug>`
	 * fails softly and the cases the link already created keep their provenance.
	 * The route is a general `PATCH {active}` and re-enabling works too; only the
	 * disable direction is exposed here, because that is all any caller needs. */
	async deactivatePosPortal(posPortalId: string): Promise<PosPortal> {
		return this.requestJson<PosPortal>(`/api/pos-portals/${encodeURIComponent(posPortalId)}`, {
			method: "PATCH",
			body: JSON.stringify({ active: false }),
		});
	}

	/** The applications one published link produced, newest first.
	 *
	 * The only way a client can reach a POS case: they are born
	 * `awaiting_verification`, which the operator queue (`listTenantCases`)
	 * excludes, so this is where the `case_id`/`party_id` pair that
	 * {@link resendAccessCode} needs comes from. Another tenant's portal id is a
	 * 404, not a 403 — ids must not be probeable. */
	async listPosPortalCases(posPortalId: string): Promise<PosPortalCase[]> {
		return this.requestJson<PosPortalCase[]>(
			`/api/pos-portals/${encodeURIComponent(posPortalId)}/cases`,
		);
	}

	/** Re-send a borrower's EXISTING access code to the address on file.
	 *
	 * **Resend, never reveal, never redirect.** There is deliberately no request
	 * body — the destination is `portal_parties.email` and nothing a caller can
	 * name — and the response carries neither the code nor the address. Do not
	 * add a body here; a caller-named recipient is the impersonation path the
	 * server's `_recipient_was_substituted` rule exists to close.
	 *
	 * Refusals are distinct on purpose and each has its own remedy, which the
	 * server writes: 404 the case was reaped, 409 the link is missing/expired/
	 * consumed/locked-out or the address was substituted, 429 the borrower's
	 * inbox is over its bound, 502 delivery failed. `requestJson` lifts the
	 * server's `detail` into `APIError.message`, so a caller should render THAT
	 * sentence and branch only on `APIError.status` — restating the wording
	 * client-side is a second copy that drifts. */
	async resendAccessCode(caseId: string, partyId: string): Promise<ResendCodeResult> {
		return this.requestJson<ResendCodeResult>(
			`/api/cases/${encodeURIComponent(caseId)}/portal/parties/${encodeURIComponent(partyId)}/resend-code`,
			{ method: "POST" },
		);
	}

	async getCase(caseId: string): Promise<VeritasCaseDetail> {
		return this.requestJson<VeritasCaseDetail>(`/api/cases/${caseId}`);
	}

	async listTenantCases(limit = 20): Promise<components["schemas"]["CaseResponse"][]> {
		return this.requestJson<components["schemas"]["CaseResponse"][]>(`/api/cases?limit=${limit}`);
	}

	async deleteCase(caseId: string): Promise<void> {
		await this.requestJson<unknown>(`/api/cases/${caseId}`, { method: "DELETE" });
	}

	async listTenantProducts(options?: { includeDisabled?: boolean }): Promise<
		components["schemas"]["ProductResponse"][]
	> {
		const qs = options?.includeDisabled ? "?include_disabled=true" : "";
		return this.requestJson<components["schemas"]["ProductResponse"][]>(`/api/products${qs}`);
	}

	async getSuggestedProducts(
		caseId: string,
	): Promise<components["schemas"]["SuggestedProductsResponse"]> {
		return this.requestJson<components["schemas"]["SuggestedProductsResponse"]>(
			`/api/cases/${caseId}/suggested_products`,
		);
	}

	async getCaseFiles(caseId: string): Promise<VeritasCaseFile[]> {
		return this.requestJson<VeritasCaseFile[]>(`/api/cases/${caseId}/files`);
	}

	async getCaseDocuments(caseId: string): Promise<VeritasCaseDocument[]> {
		return this.requestJson<VeritasCaseDocument[]>(`/api/cases/${caseId}/documents`);
	}

	/**
	 * Unified identity list: persons, entities, and financial institutions.
	 * Replaces getCaseEntities which only returned entity groups.
	 *
	 * Pass ``opts.scenarioId`` to project the response through the
	 * scenario's active product borrower assembly (see veritas
	 * ``GET /cases/{id}/identities`` docstring). Omitting it returns
	 * the legacy flat list, byte-identical with the previous release.
	 */
	async getCaseIdentities(
		caseId: string,
		opts?: { scenarioId?: string | null },
	): Promise<components["schemas"]["IdentityInfo"][]> {
		const qs = opts?.scenarioId ? `?scenario_id=${encodeURIComponent(opts.scenarioId)}` : "";
		return this.requestJson<components["schemas"]["IdentityInfo"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/identities${qs}`,
		);
	}

	async getCaseRelationships(caseId: string): Promise<RelationshipInfo[]> {
		return this.requestJson<RelationshipInfo[]>(
			`/api/cases/${encodeURIComponent(caseId)}/relationships`,
		);
	}

	/** @deprecated Use getCaseIdentities instead. Kept one release for backward compat. */
	async getCaseEntities(caseId: string): Promise<VeritasEntityGroup[]> {
		const all = await this.getCaseIdentities(caseId);
		return all
			.filter((i) => (i as { kind?: string }).kind === "entity")
			.map((i) => ({
				entity_group_id: i.id,
				case_id: caseId,
				entity_type: i.entity_type ?? "unknown",
				identifier_type: "",
				identifier_value: "",
				label: i.name ?? "",
				resolution_method: "auto",
				status: i.status,
				doc_ids: [],
				parent_entity_group_id: null,
				borrower_identity_id: null,
			}));
	}

	async getCaseExtractions(
		caseId: string,
		docId?: string,
	): Promise<components["schemas"]["ExtractionResponse"][]> {
		const qs = docId ? `?doc_id=${encodeURIComponent(docId)}` : "";
		return this.requestJson<components["schemas"]["ExtractionResponse"][]>(
			`/api/cases/${caseId}/extractions${qs}`,
		);
	}

	async getCaseExtractionsByDocType(
		caseId: string,
		docType: string,
		taxYear?: number | null,
	): Promise<components["schemas"]["ExtractionResponse"][]> {
		const params = new URLSearchParams({ doc_type: docType });
		if (taxYear != null) params.set("tax_year", String(taxYear));
		return this.requestJson<components["schemas"]["ExtractionResponse"][]>(
			`/api/cases/${caseId}/extractions?${params.toString()}`,
		);
	}

	async getStructuredExtractions(
		caseId: string,
		docType: string,
		docId?: string,
	): Promise<StructuredExtractionsResponse> {
		const params = new URLSearchParams({ doc_type: docType });
		if (docId) params.set("doc_id", docId);
		return this.requestJson<StructuredExtractionsResponse>(
			`/api/cases/${caseId}/extractions/structured?${params.toString()}`,
		);
	}

	async uploadCasePdfs(
		caseId: string,
		files: File[] | FileList,
	): Promise<{ case_id: string; workflow_id: string; files_queued: number; status: string }> {
		const form = new FormData();
		for (const f of Array.from(files)) {
			form.append("files", f, f.name);
		}
		return this.uploadMultipart(`/api/cases/${caseId}/files`, form);
	}

	async reprocessCase(
		caseId: string,
	): Promise<{ case_id: string; workflow_id: string; page_count: number; status: string }> {
		return this.requestJson(`/api/cases/${caseId}/reprocess`, { method: "POST" });
	}

	async getCaseBanking(caseId: string): Promise<import("./operator-types.js").BankingResponse> {
		return this.requestJson(`/api/cases/${caseId}/banking`);
	}

	async getCaseBankingTransactions(
		caseId: string,
	): Promise<import("./operator-types.js").ClassifiedTransactionsResponse> {
		return this.requestJson(`/api/cases/${caseId}/banking/transactions`);
	}

	async getDocumentRegions(
		caseId: string,
		docId: string,
	): Promise<import("./operator-types.js").TransactionsResponse> {
		return this.requestJson(`/api/cases/${caseId}/documents/${docId}/transactions`);
	}

	pagePngPath(caseId: string, fileId: string, pageNumber: number): string {
		return this.resolvePath(`/api/cases/${caseId}/files/${fileId}/pages/${pageNumber}.png`);
	}

	async fetchBlob(path: string): Promise<Blob> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const url = this.resolvePath(path);
		const res = await fetch(url, { headers });
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return res.blob();
	}

	/** Authenticated GET returning a Blob plus filename from Content-Disposition. */
	async fetchAuthorizedBinary(path: string): Promise<{ blob: Blob; filename: string }> {
		const token = await this.cfg.auth.getToken();
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		const url = this.resolvePath(path);
		const res = await fetch(url, { headers });

		if (!res.ok) {
			const text = await res.text();
			let errorData: unknown;
			try {
				errorData = text ? JSON.parse(text) : {};
			} catch {
				errorData = text || {};
			}
			const ed = errorData as Record<string, unknown>;
			const detail = ed?.detail;
			let errorMessage: string;
			if (typeof detail === "object" && detail !== null && "message" in detail) {
				errorMessage = String((detail as { message?: unknown }).message ?? "Error");
			} else if (typeof detail === "string") {
				errorMessage = detail;
			} else if (typeof ed?.message === "string") {
				errorMessage = ed.message;
			} else {
				errorMessage = `API Error: ${res.status}`;
			}
			const structured = typeof detail === "object" && detail !== null ? detail : errorData;
			const error = new APIError(errorMessage, res.status, structured);
			this.cfg.hooks?.onApiError?.({
				error_type: "server",
				error_message: error.message,
				error_code: String(res.status),
				page_url:
					typeof globalThis !== "undefined" && "location" in globalThis
						? globalThis.location.href
						: undefined,
			});
			throw error;
		}

		const cd = res.headers.get("Content-Disposition");
		let filename = "export.xlsx";
		if (cd) {
			const utf8Star = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
			const quoted = cd.match(/filename="([^"]+)"/i);
			const bare = cd.match(/filename=([^;\s]+)/i);
			if (utf8Star?.[1]) {
				try {
					filename = decodeURIComponent(utf8Star[1].trim());
				} catch {
					filename = utf8Star[1].trim();
				}
			} else if (quoted?.[1]) {
				filename = quoted[1].trim();
			} else if (bare?.[1]) {
				filename = bare[1].replace(/^"+|"+$/g, "").trim();
			}
		}

		const blob = await res.blob();
		return { blob, filename };
	}

	async getCaseEvents(caseId: string): Promise<VeritasCaseEvent[]> {
		return this.requestJson<VeritasCaseEvent[]>(`/api/cases/${caseId}/events`);
	}

	/**
	 * Open an SSE stream for case events using fetch (supports Authorization header).
	 * Returns an abort function. The stream closes automatically when the case reaches
	 * a terminal state or the caller invokes abort.
	 */
	streamCaseEvents(
		caseId: string,
		onEvent: (event: VeritasCaseEvent) => void,
		onError?: (err: Error) => void,
		options?: { cursor?: number },
	): () => void {
		const controller = new AbortController();
		// Resume cursor — advanced as events arrive so a reconnect backfills only
		// what was missed (server replays events after this id, then goes live).
		let lastEventId = options?.cursor ?? 0;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let attempts = 0;

		// The server stream is bounded (max-lifetime ~10 min) and also drops on an
		// api restart. Without reconnect the operator's live updates silently die
		// until a page reload. Reconnect with backoff + the resume cursor.
		const scheduleReconnect = () => {
			if (controller.signal.aborted) return;
			attempts += 1;
			const backoff = Math.min(1000 * 2 ** Math.min(attempts, 4), 15_000);
			reconnectTimer = setTimeout(() => {
				if (!controller.signal.aborted) void run();
			}, backoff);
		};

		const run = async () => {
			let token: string | null = null;
			try {
				token = await this.cfg.auth.getToken();
			} catch {
				// no token — proceed unauthenticated (will 401 server-side)
			}
			const headers: Record<string, string> = {};
			if (token) headers.Authorization = `Bearer ${token}`;

			// Pass cursor so the server starts from after the last known event_id.
			// This prevents historical case.system.completed from immediately
			// closing the stream on reconnect after a case has completed extraction.
			const streamUrl =
				lastEventId > 0
					? this.resolvePath(`/api/cases/${caseId}/events/stream?cursor=${lastEventId}`)
					: this.resolvePath(`/api/cases/${caseId}/events/stream`);

			let res: Response;
			try {
				res = await fetch(streamUrl, {
					headers,
					signal: controller.signal,
				});
			} catch {
				if (!controller.signal.aborted) {
					onError?.(new Error("Failed to connect to event stream"));
					scheduleReconnect();
				}
				return;
			}

			// Invalid upstream (502/500/HTML error page): never read the body as
			// a stream — that holds a socket open against the browser's 6-conn
			// per-host limit until the dev server appears to hang. Bail early
			// (but still reconnect — the api may be mid-restart).
			if (!res.ok) {
				onError?.(new Error(`Event stream HTTP ${res.status}`));
				scheduleReconnect();
				return;
			}

			if (!res.body) {
				onError?.(new Error("No response body from event stream"));
				scheduleReconnect();
				return;
			}
			// Connected — reset backoff so the next drop reconnects promptly.
			attempts = 0;

			// Idle watchdog: a half-open/invalid upstream can accept the socket
			// then send nothing — reader.read() awaits forever, leaking a
			// connection slot. Abort if no bytes (incl. heartbeats) arrive in
			// IDLE_TIMEOUT_MS so the socket is released and onError fires.
			const IDLE_TIMEOUT_MS = 45_000;
			let idleTimer: ReturnType<typeof setTimeout> | null = null;
			const resetIdle = () => {
				if (idleTimer != null) clearTimeout(idleTimer);
				idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
			};

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			try {
				resetIdle();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					resetIdle();
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";
					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const raw = line.slice(6).trim();
						if (!raw || raw === "[DONE]") continue;
						try {
							const event = JSON.parse(raw) as VeritasCaseEvent;
							// Advance the resume cursor past real (persisted) events so a
							// reconnect backfills only what was missed. Transient pings
							// (typing/read) carry event_id 0 — don't move the cursor.
							const eid = (event as { event_id?: number }).event_id ?? 0;
							if (eid > lastEventId) lastEventId = eid;
							onEvent(event);
						} catch {
							/* malformed — skip */
						}
					}
				}
				// Stream ended cleanly (server max-lifetime close) — reconnect to
				// keep live updates flowing.
				scheduleReconnect();
			} catch {
				if (!controller.signal.aborted) {
					onError?.(new Error("Event stream disconnected"));
					scheduleReconnect();
				}
			} finally {
				if (idleTimer != null) clearTimeout(idleTimer);
			}
		};

		void run();
		return () => {
			controller.abort();
			if (reconnectTimer != null) clearTimeout(reconnectTimer);
		};
	}

	async listSamples(): Promise<SampleListResponse> {
		return this.requestJson<SampleListResponse>("/api/samples");
	}

	async createSampleCase(sampleId: string): Promise<CreateSampleCaseResponse> {
		return this.requestJson<CreateSampleCaseResponse>("/api/samples/create", {
			method: "POST",
			body: JSON.stringify({ sample_id: sampleId }),
		});
	}

	// ─── Scenarios ─────────────────────────────────────────────────────────────

	async getCaseScenarios(
		caseId: string,
	): Promise<components["schemas"]["ScenarioComparisonResponse"][]> {
		const rows = await this.requestJson<components["schemas"]["ScenarioComparisonResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios`,
		);
		return (rows ?? []).map((s) => ({ ...s, status: normalizeVeritasStatus(s.status) }));
	}

	// ─── Reports (generated .xlsx) ─────────────────────────────────────────────

	/** GET /api/cases/{case_id}/reports — optional scenario_id scopes last_* metadata. */
	async listReports(
		caseId: string,
		opts?: { scenarioId?: string },
	): Promise<components["schemas"]["ReportListItem"][]> {
		const qs =
			opts?.scenarioId != null && opts.scenarioId !== ""
				? `?scenario_id=${encodeURIComponent(opts.scenarioId)}`
				: "";
		return this.requestJson<components["schemas"]["ReportListItem"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/reports${qs}`,
		);
	}

	/** POST /api/cases/{case_id}/reports/{report_name} — 201 with metadata; body optional. */
	async generateReport(
		caseId: string,
		reportName: string,
		body?: components["schemas"]["ReportGenerateRequest"] | null,
	): Promise<components["schemas"]["ReportGenerateResponse"]> {
		const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}`;
		return this.requestJson<components["schemas"]["ReportGenerateResponse"]>(path, {
			method: "POST",
			body: JSON.stringify(body ?? {}),
		});
	}

	/** GET /api/cases/{case_id}/reports/{report_name}/latest — requires scenario_id. */
	async getLatestReport(
		caseId: string,
		reportName: string,
		opts: { scenarioId: string; tenantSlug?: string | null },
	): Promise<components["schemas"]["ReportGenerateResponse"]> {
		const params = new URLSearchParams({ scenario_id: opts.scenarioId });
		if (opts.tenantSlug) params.set("tenant_slug", opts.tenantSlug);
		return this.requestJson<components["schemas"]["ReportGenerateResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/latest?${params.toString()}`,
		);
	}

	/** GET binary .xlsx for a persisted report row (report_id from generate or latest). */
	async downloadReport(
		caseId: string,
		reportName: string,
		reportId: string,
	): Promise<{ blob: Blob; filename: string }> {
		const path = `/api/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportName)}/download?report_id=${encodeURIComponent(reportId)}`;
		return this.fetchAuthorizedBinary(path);
	}

	/** GET /api/cases/{case_id}/audit — full calculation audit (specs, steps, function_calls). */
	async getCaseAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit`,
		);
	}

	async getCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["ScenarioDetailResponse"]> {
		const raw = await this.requestJson<components["schemas"]["ScenarioDetailResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`,
		);
		return { ...raw, status: normalizeVeritasStatus(raw.status) };
	}

	async getCaseScenarioSummary(
		caseId: string,
		scenarioId: string,
		opts: { refresh?: boolean } = {},
	): Promise<components["schemas"]["ScenarioSummaryResponse"]> {
		const qs = opts.refresh ? "?refresh=true" : "";
		return this.requestJson<components["schemas"]["ScenarioSummaryResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/summary${qs}`,
		);
	}

	async getCaseScenarioRefinementSummary(
		caseId: string,
		scenarioId: string,
		refinementId: string,
		opts: { refresh?: boolean } = {},
	): Promise<components["schemas"]["ScenarioSummaryResponse"]> {
		const qs = opts.refresh ? "?refresh=true" : "";
		return this.requestJson<components["schemas"]["ScenarioSummaryResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/summary${qs}`,
		);
	}

	async createCaseScenario(
		caseId: string,
		body: components["schemas"]["CreateScenarioRequest"],
	): Promise<components["schemas"]["CreateScenarioResponse"]> {
		return this.requestJson<components["schemas"]["CreateScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	async startCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["StartScenarioResponse"]> {
		return this.requestJson<components["schemas"]["StartScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/start`,
			{ method: "POST" },
		);
	}

	async deleteCaseScenario(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["DeleteScenarioResponse"]> {
		return this.requestJson<components["schemas"]["DeleteScenarioResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}`,
			{ method: "DELETE" },
		);
	}

	// ─── Products ────────────────────────────────────────────────────────────────

	async getProducts(includeDisabled = false): Promise<components["schemas"]["ProductResponse"][]> {
		const qs = includeDisabled ? "?include_disabled=true" : "";
		return this.requestJson<components["schemas"]["ProductResponse"][]>(`/api/products${qs}`);
	}

	// ─── Refinements ────────────────────────────────────────────────────────────

	async getCaseScenarioRefinements(
		caseId: string,
		scenarioId: string,
	): Promise<NormalizedRefinement[]> {
		const rows = await this.requestJson<components["schemas"]["RefinementResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`,
		);
		return (rows ?? []).map(normalizeRefinement);
	}

	async getCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		refinementId: string,
	): Promise<NormalizedRefinement> {
		const raw = await this.requestJson<components["schemas"]["RefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}`,
		);
		return normalizeRefinement(raw);
	}

	async createCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		body: components["schemas"]["CreateRefinementRequest"],
	): Promise<components["schemas"]["CreateRefinementResponse"]> {
		return this.requestJson<components["schemas"]["CreateRefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements`,
			{ method: "POST", body: JSON.stringify(body) },
		);
	}

	async startCaseScenarioRefinement(
		caseId: string,
		scenarioId: string,
		refinementId: string,
	): Promise<components["schemas"]["StartRefinementResponse"]> {
		return this.requestJson<components["schemas"]["StartRefinementResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/refinements/${encodeURIComponent(refinementId)}/start`,
			{ method: "POST" },
		);
	}

	// ─── Audit ──────────────────────────────────────────────────────────────────

	async getAudit(caseId: string): Promise<components["schemas"]["SpecAuditResponse"][]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"][]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit`,
		);
	}

	async getSpecAudit(
		caseId: string,
		specName: string,
	): Promise<components["schemas"]["SpecAuditResponse"]> {
		return this.requestJson<components["schemas"]["SpecAuditResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/audit/specs/${encodeURIComponent(specName)}`,
		);
	}

	async getCaseScenarioAdvice(
		caseId: string,
		scenarioId: string,
	): Promise<components["schemas"]["ScenarioAdviceResponse"]> {
		return this.requestJson<components["schemas"]["ScenarioAdviceResponse"]>(
			`/api/cases/${encodeURIComponent(caseId)}/scenarios/${encodeURIComponent(scenarioId)}/advice`,
		);
	}

	/**
	 * Build absolute URL for `EventSource` when `baseUrl` is empty (browser resolves against `location.origin`).
	 */
	toAbsoluteUrl(path: string): string {
		const resolved = this.resolvePath(path);
		if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
			return resolved;
		}
		const origin =
			typeof globalThis !== "undefined" && "location" in globalThis
				? (globalThis as unknown as { location: { origin: string } }).location.origin
				: "http://localhost";
		return new URL(resolved, origin).toString();
	}
}

export function createVeritasClient(cfg: VeritasClientConfig): VeritasClient {
	return new VeritasClient(cfg);
}

// ─────────────────────────────────────────────────────────────────────────────
// PortalClient — minimal session client for the borrower portal
// (X-Portal-Token header, /portal/session + /portal/session/:id/intents).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portal session response — `GET /api/portal/session`, and embedded as
 * `.session` in the intents response.
 *
 * A bare lookup: the spec refresh landed `inbound_email_address` and
 * `pending_inputs`, so the hand-spliced intersection this used to carry is gone.
 *
 * `inbound_email_address` is optional AND nullable, deliberately: absent on any
 * server older than veritas `64284d99`, and `null` wherever the receiving mail
 * domain is unconfigured — which is every deployment today, so `null` is the
 * ordinary case, not an error. Never construct a fallback address from it and
 * never cache one: rotating `VERITAS_SECRET` invalidates every address already
 * minted.
 */
export type PortalSession = components["schemas"]["PortalSessionResponse"];
type Intent = components["schemas"]["Intent"];

/**
 * Per-intent outcome from `POST /portal/session/:id/intents`.
 *
 * The endpoint answers **200 with `status: "error"`** for a rejected intent —
 * a validation refusal is a renderable answer, not a transport failure — so a
 * caller that only inspects `res.ok` sees a success and silently drops the
 * reason. `detail` is the server's own message (several are joined with
 * `"; "`), each line prefixed with the input name it concerns.
 */
export type IntentResult = components["schemas"]["IntentResult"];

/** HTTP header name used to authenticate portal API requests. */
const PORTAL_AUTH_HEADER = "X-Portal-Token" as const;
/** Ephemeral verify-proof header. The access code is a per-browser-session gate;
 * after the borrower enters it the server returns a short-lived, token-bound proof
 * the client holds IN MEMORY (never persisted) and presents here. A refresh wipes
 * it → no header → if there's no claimed account the borrower re-enters the code. */
const PORTAL_VERIFY_HEADER = "X-Portal-Verify" as const;

/** Build the portal request headers, attaching the verify-proof only when held. */
function portalHeaders(token: string, verifyProof?: string | null, extra?: Record<string, string>): Record<string, string> {
	const headers: Record<string, string> = { [PORTAL_AUTH_HEADER]: token, ...(extra ?? {}) };
	if (verifyProof) headers[PORTAL_VERIFY_HEADER] = verifyProof;
	return headers;
}

export interface PortalClientConfig {
	/** Base URL of the Veritas API (e.g. "" for same-origin, "https://api.example.com" for external). */
	baseUrl?: string;
}

export interface PortalClientError {
	code: "expired" | "no_token" | "network" | "server" | "not_ready";
	message: string;
	status?: number;
}

/** Discriminated union: exactly one of session or error is set. */
export type FetchSessionResult =
	| { session: PortalSession; error: null }
	| { session: null; error: PortalClientError };

/**
 * Discriminated union: exactly one of session or error is set.
 *
 * `results` carries the per-intent outcomes. It is NOT redundant with `error`:
 * a refused intent comes back 200 (`error: null`) with `results[i].status ===
 * "error"`, and on a refusal the server leaves the case untouched — so the
 * session is byte-identical to the one already held and `results` is the only
 * evidence anything went wrong. Always an array; `[]` on transport failure and
 * against a server that omits the key.
 */
export type SubmitIntentsResult =
	| { session: PortalSession; results: IntentResult[]; error: null }
	| { session: null; results: IntentResult[]; error: PortalClientError };

/** Discriminated union: exactly one of preview or error is set. A refused
 * preview (verify gate, answer cap, vanished case) must never take the form
 * down with it, so this follows the house pattern and throws nothing. */
export type PreviewPortalFormResult =
	| { preview: FormPreviewResponse; error: null }
	| { preview: null; error: PortalClientError };

/**
 * Minimal portal session client.
 *
 * Wraps the two portal endpoints (/portal/session and /portal/session/{id}/intents)
 * with typed results so app code doesn't need to hand-roll fetch logic.
 */
export function createPortalClient(config: PortalClientConfig = {}) {
	const base = config.baseUrl ?? "";

	async function fetchSession(token: string, verifyProof?: string | null): Promise<FetchSessionResult> {
		try {
			// Token in X-Portal-Token header only — never in URL query param.
			// URL query params appear in server access logs and browser history;
			// the header path keeps the token out of both. The in-memory verify-proof
			// (when held) rides along so an in-session refetch stays verified.
			const res = await fetch(`${base}/api/portal/session`, {
				headers: portalHeaders(token, verifyProof),
			});
			if (!res.ok) {
				if (res.status === 401) {
					return {
						session: null,
						error: {
							code: "expired",
							message: "Session has expired. Please request a new link.",
							status: 401,
						},
					};
				}
				return {
					session: null,
					error: {
						code: "server",
						message: `Failed to load session (${res.status})`,
						status: res.status,
					},
				};
			}
			const session: PortalSession = await res.json();
			return { session, error: null };
		} catch {
			return {
				session: null,
				error: { code: "network", message: "Failed to connect to server" },
			};
		}
	}

	async function submitIntents(
		sessionId: string,
		token: string,
		intents: Intent[],
		verifyProof?: string | null,
	): Promise<SubmitIntentsResult> {
		try {
			const res = await fetch(`${base}/api/portal/session/${sessionId}/intents`, {
				method: "POST",
				headers: portalHeaders(token, verifyProof, { "Content-Type": "application/json" }),
				body: JSON.stringify({ intents }),
			});
			if (!res.ok) {
				return {
					session: null,
					results: [],
					error: {
						code: "server",
						message: `Failed to submit (${res.status})`,
						status: res.status,
					},
				};
			}
			const data: { session: PortalSession; results?: IntentResult[] } = await res.json();
			return { session: data.session, results: data.results ?? [], error: null };
		} catch {
			return { session: null, results: [], error: { code: "network", message: "Failed to submit" } };
		}
	}

	/** Ask the server what the form would look like if `inputs` were the
	 * borrower's answers.
	 *
	 * This exists so a client NEVER evaluates `required_when` itself: lux's own
	 * evaluator compares with `===` and fails open on the list `equals` form
	 * that DSCR relies on, so only the server can resolve the two lists
	 * correctly. The response carries the same `PortalInputField` /
	 * `PortalDocumentRequirement` models the session already does, so the
	 * components rendering the form render the preview unchanged.
	 *
	 * The server never echoes draft values back and `default` stays null — the
	 * caller owns its own form state. Values are not validated here; `set_inputs`
	 * enforces bounds on submit. `sessionId` only shapes the URL: the portal
	 * token is the authority. */
	async function previewPortalForm(
		sessionId: string,
		token: string,
		inputs: Record<string, unknown>,
		verifyProof?: string | null,
	): Promise<PreviewPortalFormResult> {
		try {
			const res = await fetch(`${base}/api/portal/session/${sessionId}/form-preview`, {
				method: "POST",
				headers: portalHeaders(token, verifyProof, { "Content-Type": "application/json" }),
				body: JSON.stringify({ inputs }),
			});
			if (!res.ok) {
				return {
					preview: null,
					error: {
						code: res.status === 401 ? "expired" : "server",
						message: `Failed to preview the form (${res.status})`,
						status: res.status,
					},
				};
			}
			const preview: FormPreviewResponse = await res.json();
			return { preview, error: null };
		} catch {
			return {
				preview: null,
				error: { code: "network", message: "Failed to connect to server" },
			};
		}
	}

	async function fetchMessages(
		sessionId: string,
		token: string,
		opts: { before?: string; limit?: number; verifyProof?: string | null } = {},
	): Promise<
		| { page: components["schemas"]["ThreadPage"]; error: null }
		| { page: null; error: PortalClientError }
	> {
		try {
			const qs = new URLSearchParams();
			if (opts.before) qs.set("before", opts.before);
			if (opts.limit) qs.set("limit", String(opts.limit));
			const suffix = qs.toString() ? `?${qs.toString()}` : "";
			const res = await fetch(`${base}/api/portal/session/${sessionId}/messages${suffix}`, {
				headers: portalHeaders(token, opts.verifyProof),
			});
			if (!res.ok) {
				return {
					page: null,
					error: {
						code: res.status === 401 ? "expired" : "server",
						message: `Failed to load messages (${res.status})`,
						status: res.status,
					},
				};
			}
			return { page: (await res.json()) as components["schemas"]["ThreadPage"], error: null };
		} catch {
			return { page: null, error: { code: "network", message: "Failed to load messages" } };
		}
	}

	/** Upload documents to the borrower's own case using portal-token auth.
	 * The files endpoint accepts X-Portal-Token for the token's authorized case.
	 *
	 * ``opts.operatorTokenFallback`` handles the mixed-session case: when the page
	 * is open in a browser that's ALSO signed in as an operator/tenant, the portal
	 * token can be the wrong credential for this case (stale, or for a sibling
	 * case) and the upload 401/403s. If a fallback yields the signed-in user's
	 * Bearer token, we retry with it — the backend still enforces tenant ownership
	 * (verify_case_access), so this only succeeds when that user legitimately owns
	 * the case, and is a no-op for real borrowers (no operator session → no
	 * fallback token). */
	async function uploadDocuments(
		caseId: string,
		token: string,
		files: File[],
		opts?: { operatorTokenFallback?: () => Promise<string | null> },
	): Promise<{ ok: boolean; error: PortalClientError | null }> {
		const doUpload = async (bearer: string) => {
			const form = new FormData();
			for (const f of files) form.append("files", f);
			// The files endpoint authenticates via resolve_caller, whose portal
			// path is the 32-char-hex Bearer token (entity caller, single-case
			// scope, no tenant context). The X-Portal-Token header path needs a
			// tenant credential first, so it 401s for the public borrower.
			return fetch(`${base}/api/cases/${caseId}/files`, {
				method: "POST",
				headers: { Authorization: `Bearer ${bearer}` },
				body: form,
			});
		};
		try {
			let res = await doUpload(token);
			// Wrong-credential retry: the portal token was rejected but a signed-in
			// operator/tenant session may authorize this case.
			if ((res.status === 401 || res.status === 403) && opts?.operatorTokenFallback) {
				const operatorToken = await opts.operatorTokenFallback().catch(() => null);
				if (operatorToken) res = await doUpload(operatorToken);
			}
			if (!res.ok) {
				// Prefer the backend's descriptive detail (e.g. "Unsupported file
				// type: …") over a bare status code.
				let message = `Upload failed (${res.status})`;
				try {
					const body = await res.json();
					if (typeof body?.detail === "string" && body.detail) message = body.detail;
				} catch {
					/* non-JSON body — keep the status fallback */
				}
				return {
					ok: false,
					error: { code: "server", message, status: res.status },
				};
			}
			return { ok: true, error: null };
		} catch {
			return { ok: false, error: { code: "network", message: "Upload failed" } };
		}
	}

	/** Attach a Firebase account to this borrower's portal (token-gated). The
	 * Firebase id token (from a magic-link sign-in) is verified server-side only
	 * to capture a trusted uid; auth is the portal token. */
	async function claimAccount(
		token: string,
		firebaseIdToken: string,
	): Promise<{ ok: boolean; accountUserId?: string; error: PortalClientError | null }> {
		try {
			const res = await fetch(`${base}/api/portal/claim-account`, {
				method: "POST",
				headers: { "Content-Type": "application/json", [PORTAL_AUTH_HEADER]: token },
				body: JSON.stringify({ firebase_id_token: firebaseIdToken }),
			});
			if (!res.ok) {
				return {
					ok: false,
					error: {
						code: "server",
						message: `Couldn't create account (${res.status})`,
						status: res.status,
					},
				};
			}
			const data = (await res.json()) as { account_user_id?: string };
			return { ok: true, accountUserId: data.account_user_id, error: null };
		} catch {
			return { ok: false, error: { code: "network", message: "Couldn't create account" } };
		}
	}

	/** Borrower typing signal — broadcast to the operator. Best-effort. */
	async function sendTyping(token: string): Promise<void> {
		try {
			await fetch(`${base}/api/portal/typing`, {
				method: "POST",
				headers: { [PORTAL_AUTH_HEADER]: token },
			});
		} catch {
			/* best-effort */
		}
	}

	/** Subscribe to the borrower's real-time portal stream. Emits MINIMAL pings
	 * ({type, actor?}) — no content — so the caller refetches the gated session.
	 * Returns an unsubscribe function. */
	function streamPortalEvents(
		token: string,
		onPing: (ping: { type: string; actor?: string }) => void,
		verifyProof?: string | null,
	): () => void {
		const controller = new AbortController();
		(async () => {
			let res: Response;
			try {
				res = await fetch(`${base}/api/portal/stream`, {
					headers: portalHeaders(token, verifyProof),
					signal: controller.signal,
				});
			} catch {
				return;
			}
			if (!res.ok || !res.body) return;
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const chunks = buffer.split("\n\n");
					buffer = chunks.pop() ?? "";
					for (const chunk of chunks) {
						const line = chunk.split("\n").find((l) => l.startsWith("data:"));
						if (!line) continue;
						try {
							onPing(JSON.parse(line.slice(5).trim()));
						} catch {
							/* ignore malformed */
						}
					}
				}
			} catch {
				/* aborted or network drop */
			}
		})();
		return () => controller.abort();
	}

	return {
		fetchSession,
		fetchMessages,
		submitIntents,
		previewPortalForm,
		uploadDocuments,
		claimAccount,
		sendTyping,
		streamPortalEvents,
	};
}
