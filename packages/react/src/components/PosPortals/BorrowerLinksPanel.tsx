import type { PosPortal, PosPortalCase } from "@multiversal-ventures/lux-core";
import { Check, ChevronDown, ChevronRight, Copy, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { type ResendOutcome, usePosPortalCases } from "./usePosPortalCases.js";
import { usePosPortals } from "./usePosPortals.js";

/** How long a Copy button reads "Copied" before returning to its resting label.
 * Exported so a test waits on the real window instead of restating the number. */
export const LINK_COPIED_RESET_MS = 1500;

export interface BorrowerLinksPanelProps {
	/** Extra classes for the scroll container, e.g. a host-chosen max height. */
	className?: string;
}

/**
 * Manage published borrower links — and reach the applications they produced.
 *
 * ## Body only: the host owns the dialog
 *
 * This renders the list and nothing around it — no dialog box, no title, no
 * close control. The host wraps it in whatever modal its app already uses, the
 * way gunnr's `BorrowerLinksDialog` wraps it in the same Radix `Dialog` every
 * other modal in that app uses. A second dialog implementation shipped from
 * here would mean two backdrops, two focus traps and two close affordances in
 * one product — which is exactly what this package's `BorrowerPortalLink`
 * already avoids by being a card its host puts in a dialog.
 *
 * ## Why there is no `open` prop
 *
 * This component's existence IS its openness. It calls `usePosPortals()`, whose
 * query has no `enabled` gate, so an `open={false}` render that returned `null`
 * would still fire `GET /api/pos-portals` — React hooks cannot be skipped.
 * Making mounting the only way to open it puts the fetch gate somewhere a
 * caller cannot get wrong. Hosts render `{open && <BorrowerLinksPanel … />}`,
 * inside a dialog that is itself only mounted while open.
 *
 * The same reasoning one level down: a link's applications are fetched only for
 * the row the operator expands ({@link LinkApplications} is mounted per
 * expansion, and `usePosPortalCases(null)` fetches nothing), so opening this
 * surface costs exactly one request no matter how many links a tenant has.
 */
export function BorrowerLinksPanel({ className }: BorrowerLinksPanelProps) {
	const { portals, loading, error, deactivate } = usePosPortals();
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	async function disable(portal: PosPortal) {
		setBusyId(portal.pos_portal_id);
		setActionError(null);
		try {
			await deactivate(portal.pos_portal_id);
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Could not disable the link.");
		} finally {
			setBusyId(null);
		}
	}

	return (
		<div className={className ? `overflow-y-auto ${className}` : "overflow-y-auto"}>
			{actionError ? (
				<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
					{actionError}
				</p>
			) : null}
			{error ? (
				<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
					{error.message}
				</p>
			) : null}

			{loading ? (
				<p className="py-6 text-center text-sm text-slate-500">Loading your links…</p>
			) : portals.length === 0 ? (
				<p className="py-6 text-center text-sm text-slate-500">
					You have not published any borrower links yet.
				</p>
			) : (
				<ul className="divide-y divide-slate-100">
					{portals.map((portal) => (
						<LinkRow
							key={portal.pos_portal_id}
							portal={portal}
							expanded={expandedId === portal.pos_portal_id}
							onToggle={() =>
								setExpandedId((cur) => (cur === portal.pos_portal_id ? null : portal.pos_portal_id))
							}
							busy={busyId === portal.pos_portal_id}
							onDisable={() => void disable(portal)}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

function LinkRow({
	portal,
	expanded,
	onToggle,
	busy,
	onDisable,
}: {
	portal: PosPortal;
	expanded: boolean;
	onToggle: () => void;
	busy: boolean;
	onDisable: () => void;
}) {
	const [copied, setCopied] = useState(false);

	// `expires_at` is the second of the three conditions `pos_repo.is_usable`
	// gates a link on, and the server already sends it — reading `active` alone
	// would badge an expired link "Active" and let an operator hand out a URL
	// that refuses every applicant. The THIRD condition (the product still
	// being enabled for this tenant) is deliberately NOT mirrored here: the
	// client is never told it, and guessing would be worse than a badge that
	// answers only what this row can actually see.
	const expired =
		portal.expires_at != null ? new Date(portal.expires_at).getTime() <= Date.now() : false;
	const openForBusiness = portal.active && !expired;

	// "Copied" is transient feedback, not a mode. Self-cleaning so an unmount
	// mid-window clears the timer.
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), LINK_COPIED_RESET_MS);
		return () => clearTimeout(timer);
	}, [copied]);

	return (
		<li className="py-3">
			<div className="flex items-start gap-3">
				<button
					type="button"
					onClick={onToggle}
					aria-expanded={expanded}
					className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label={`${expanded ? "Hide" : "Show"} applications for ${portal.label}`}
				>
					{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				</button>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						{/* The whole point of Task 1: the name the operator typed, read
						    back to them. Until this rendered, `pos_portals.label` had no
						    reader in any UI. */}
						<span className="truncate text-sm font-medium text-slate-900">{portal.label}</span>
						<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
							{portal.product_id}
						</span>
						<span
							className={
								openForBusiness
									? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700"
									: "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
							}
						>
							{portal.active ? (expired ? "Expired" : "Active") : "Disabled"}
						</span>
					</div>
					<div className="mt-1.5 flex items-center gap-2">
						<input
							readOnly
							value={portal.url}
							aria-label={`Application link for ${portal.label}`}
							className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
						/>
						<button
							type="button"
							onClick={() =>
								void navigator.clipboard
									?.writeText(portal.url)
									.then(() => setCopied(true))
									.catch(() => setCopied(false))
							}
							className="inline-flex flex-none items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
						>
							{copied ? <Check size={13} /> : <Copy size={13} />}
							{copied ? "Copied" : "Copy link"}
						</button>
					</div>
					<p className="mt-1 text-xs text-slate-500">
						{portal.slug}
						{portal.created_at ? ` · created ${formatDate(portal.created_at)}` : ""}
					</p>
				</div>
				{portal.active ? (
					<button
						type="button"
						onClick={onDisable}
						disabled={busy}
						className="flex-none rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
					>
						{busy ? "Disabling…" : "Disable"}
					</button>
				) : null}
			</div>

			{/* Mounted only while expanded — that mount IS the fetch gate for this
			    link's applications. */}
			{expanded ? <LinkApplications posPortalId={portal.pos_portal_id} /> : null}
		</li>
	);
}

function LinkApplications({ posPortalId }: { posPortalId: string }) {
	const { cases, loading, error, resend } = usePosPortalCases(posPortalId);

	if (loading) {
		return <p className="mt-3 pl-9 text-xs text-slate-500">Loading applications…</p>;
	}
	if (error) {
		return (
			<p role="alert" className="mt-3 pl-9 text-xs text-red-700">
				{error.message}
			</p>
		);
	}
	if (cases.length === 0) {
		return (
			<p className="mt-3 pl-9 text-xs text-slate-500">
				Nobody has started an application from this link yet.
			</p>
		);
	}
	return (
		<ul className="mt-3 space-y-2 pl-9">
			{cases.map((c) => (
				<ApplicationRow key={c.case_id} application={c} resend={resend} />
			))}
		</ul>
	);
}

/**
 * How each case state reads to an operator on THIS surface.
 *
 * Scoped to the states a POS application can be in before it becomes ordinary
 * queue work; anything else falls through to the raw state with its underscores
 * removed, so a state introduced by a workflow tomorrow renders legibly instead
 * of blank. Deliberately not a shared label map: `awaiting_verification` means
 * "we mailed them a code and they have not entered it", which is only worth
 * saying where a resend button sits beside it.
 */
const STATE_LABELS: Record<string, string> = {
	awaiting_verification: "Code not entered yet",
	awaiting_documents: "Verified — awaiting documents",
};

function stateLabel(state: string): string {
	return STATE_LABELS[state] ?? state.replace(/_/g, " ");
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function ApplicationRow({
	application,
	resend,
}: {
	application: PosPortalCase;
	resend: (caseId: string, partyId: string) => Promise<ResendOutcome>;
}) {
	const [outcome, setOutcome] = useState<ResendOutcome | null>(null);
	const [busyPartyId, setBusyPartyId] = useState<string | null>(null);
	// Which party the notice below belongs to, kept separately from `busyPartyId`
	// because that one is cleared the moment the request settles — and "Try
	// again" is only offered AFTER it settles. Retrying off `busyPartyId` would
	// therefore always resend to the first party in the list, which on a
	// multi-party case is the wrong borrower's inbox.
	const [lastPartyId, setLastPartyId] = useState<string | null>(null);

	async function send(partyId: string) {
		setBusyPartyId(partyId);
		setLastPartyId(partyId);
		setOutcome(null);
		setOutcome(await resend(application.case_id, partyId));
		setBusyPartyId(null);
	}

	// An unverified applicant has typed an email into a public form and nothing
	// else: no name, no property, and `cases.name` stays null until the case
	// reaches scenario naming. So the address is the row's identity — rendering
	// "Untitled Case" here would name every row identically.
	const parties = application.parties ?? [];
	const heading = application.name ?? parties[0]?.email ?? "Application";

	return (
		<li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
			<div className="flex flex-wrap items-center gap-2">
				<span className="truncate text-xs font-medium text-slate-800">{heading}</span>
				<span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600">
					{stateLabel(application.state)}
				</span>
				{application.created_at ? (
					<span className="text-[11px] text-slate-500">
						started {formatDate(application.created_at)}
					</span>
				) : null}
			</div>

			{parties.length === 0 ? (
				<p className="mt-1 text-[11px] text-slate-500">
					No contact on file — nothing to re-send to.
				</p>
			) : (
				<ul className="mt-1.5 space-y-1">
					{parties.map((p) => (
						<li key={p.party_id} className="flex items-center justify-between gap-2">
							<span className="truncate text-xs text-slate-600">
								{p.display_name ?? p.email ?? "Unnamed applicant"}
							</span>
							<button
								type="button"
								disabled={busyPartyId === p.party_id || !p.email}
								onClick={() => void send(p.party_id)}
								title={
									p.email
										? `Re-send the access code to ${p.email}`
										: "No email address on file for this applicant"
								}
								className="inline-flex flex-none items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 disabled:opacity-50"
							>
								<Mail size={12} />
								{busyPartyId === p.party_id ? "Sending…" : "Resend code"}
							</button>
						</li>
					))}
				</ul>
			)}

			{outcome && lastPartyId ? (
				<ResendNotice outcome={outcome} onRetry={() => void send(lastPartyId)} />
			) : null}
		</li>
	);
}

/**
 * The result of a resend, with the behaviour its status calls for.
 *
 * The SENTENCE is always the server's — it composes an operator-actionable
 * remedy per refusal, and restating those here would put the same prose in two
 * repositories. What this adds is the difference between them: whether the
 * operator should retry, wait, act on the remedy, or accept that the row is
 * gone. Collapsing all four into "something went wrong" is exactly what the
 * distinct statuses exist to prevent.
 */
function ResendNotice({
	outcome,
	onRetry,
}: {
	outcome: ResendOutcome;
	onRetry: () => void;
}) {
	if (outcome.kind === "sent") {
		// `<output>` carries an implicit `status` role — same accessible
		// announcement as the `role="status"` it replaces, native rather than
		// bolted on. `block` restores the box behaviour the surrounding
		// rounded/padded classes assume; `output` is inline by default.
		return (
			<output className="mt-2 block rounded bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800">
				{outcome.message}
			</output>
		);
	}
	// The follow-up line differs per kind, and it is the part the status code
	// carries that the sentence does not.
	const followUp =
		outcome.kind === "gone"
			? "This application no longer exists — the list has been refreshed."
			: outcome.kind === "refused"
				? "Nothing was sent. Follow the step above, then try again."
				: outcome.kind === "throttled"
					? "Nothing was sent. This will work again shortly."
					: "It may not have been sent. Retrying now is safe.";
	return (
		<div role="alert" className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
			<p>{outcome.message}</p>
			<p className="mt-0.5 text-amber-800">{followUp}</p>
			{outcome.kind === "undelivered" || outcome.kind === "throttled" ? (
				<button
					type="button"
					onClick={onRetry}
					className="mt-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200 hover:bg-amber-100"
				>
					Try again
				</button>
			) : null}
		</div>
	);
}
