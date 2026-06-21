import { useState } from "react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import {
	useAttachDocument,
	useDeleteParty,
	type CaseDocument,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { RequestComposer } from "./RequestComposer.js";

type ThreadItem = PartyView["thread"][number];

/** Center pane: a chat-first view of the selected party — conversation up front,
 * link behind an icon, documents/roles tucked into a collapsible panel. */
export function PartyDetail({
	caseId,
	party,
	uploadedFiles,
	caseDocuments,
	onRemoved,
}: {
	caseId: string;
	party: PartyView;
	uploadedFiles: string[];
	caseDocuments: CaseDocument[];
	onRemoved?: () => void;
}) {
	const [composing, setComposing] = useState(false);
	const [copied, setCopied] = useState(false);
	const del = useDeleteParty(caseId);

	const linked = !!party.linked_identity_id;
	const portalUrl = party.portal_token
		? `${typeof window !== "undefined" ? window.location.origin : ""}/portal?token=${party.portal_token}`
		: null;

	async function copyLink() {
		if (!portalUrl) return;
		try {
			await navigator.clipboard.writeText(portalUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}

	function remove() {
		if (window.confirm(`Remove ${party.display_name || "this party"} from the portal?`)) {
			del.mutate(party.party_id, { onSuccess: () => onRemoved?.() });
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Compact header */}
			<header className="border-b border-slate-200 px-5 py-3 flex items-center gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-semibold text-slate-900 truncate">{party.display_name || roleLabel(party.role)}</h2>
					<p className="text-xs text-slate-500 truncate">
						{[roleLabel(party.role), partyTypeLabel(party.party_type)].filter(Boolean).join(" · ")}
						{party.verified && <span className="text-green-600"> · ✓ Verified</span>}
						{party.signed && <span className="text-green-600"> · ✓ Signed</span>}
						{!party.has_account && <span className="text-slate-400"> · No account</span>}
					</p>
				</div>
				{portalUrl && (
					<button
						type="button"
						onClick={copyLink}
						title={copied ? "Copied!" : "Copy portal link"}
						aria-label="Copy portal link"
						className="shrink-0 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-base"
					>
						{copied ? "✓" : "🔗"}
					</button>
				)}
				<button type="button" onClick={remove} disabled={del.isPending} title="Remove" aria-label="Remove" className="shrink-0 h-9 w-9 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-50">
					✕
				</button>
			</header>

			{/* Conversation — the main area */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
				{party.thread.length === 0 ? (
					<p className="text-center text-sm text-slate-400 mt-6">No messages yet. Send a request to start.</p>
				) : (
					party.thread.map((m) => <OpBubble key={m.message_id} m={m} />)
				)}
			</div>

			{/* Collapsible documents & roles */}
			<details className="border-t border-slate-200 px-5 py-2 group">
				<summary className="text-sm font-medium text-slate-600 cursor-pointer flex items-center justify-between">
					<span>Documents &amp; roles</span>
					<span className="text-xs text-slate-400">{party.documents.length + uploadedFiles.length}</span>
				</summary>
				<div className="mt-3 space-y-3">
					<DocRoles party={party} caseDocuments={caseDocuments} caseId={caseId} />
					{uploadedFiles.length > 0 && (
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Shared documents</p>
							<ul className="space-y-0.5">
								{uploadedFiles.map((f, i) => (
									<li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="text-green-600" aria-hidden>✓</span>{f}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</details>

			{/* Composer */}
			<div className="border-t border-slate-200 px-5 py-3">
				{composing ? (
					<RequestComposer caseId={caseId} party={party} onSent={() => setComposing(false)} onCancel={() => setComposing(false)} />
				) : (
					<button
						type="button"
						onClick={() => setComposing(true)}
						disabled={!linked}
						title={linked ? undefined : "Link this party to a case identity first"}
						className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium py-2.5"
					>
						+ Send request
					</button>
				)}
			</div>
		</div>
	);
}

/** Operator-perspective chat bubble — "You" (operator) right, borrower left. */
function OpBubble({ m }: { m: ThreadItem }) {
	const mine = m.author_kind === "operator";
	const items = (m.items ?? []) as Array<{ title?: string }>;
	const align = mine ? "justify-end" : "justify-start";
	if (m.kind === "upload") {
		return (
			<div className={`flex ${align}`}>
				<div className={`flex items-center gap-2 max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
					<span aria-hidden>📄</span>{m.body}
				</div>
			</div>
		);
	}
	return (
		<div className={`flex ${align}`}>
			<div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
				<p className="text-[10px] opacity-70 mb-0.5">{mine ? "You" : "Borrower"}</p>
				{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
				{items.length > 0 && (
					<ul className={`mt-1 ml-4 list-disc ${mine ? "text-indigo-100" : "text-slate-600"}`}>
						{items.map((it, i) => <li key={i}>{it.title}</li>)}
					</ul>
				)}
			</div>
		</div>
	);
}

/** Role-on-documents — existing relations + a compact assign control. */
function DocRoles({ party, caseDocuments, caseId }: { party: PartyView; caseDocuments: CaseDocument[]; caseId: string }) {
	const attach = useAttachDocument(caseId);
	const [docId, setDocId] = useState("");
	const [docRole, setDocRole] = useState(party.role || "borrower");

	return (
		<div>
			<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Role on documents</p>
			{party.documents.length > 0 ? (
				<ul className="space-y-0.5 mb-2">
					{party.documents.map((d) => (
						<li key={d.doc_id} className="text-sm text-slate-700"><span className="font-medium">{roleLabel(d.role)}</span> on {d.label}</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-slate-400 mb-2">Not assigned to any document.</p>
			)}
			{caseDocuments.length > 0 && (
				<div className="flex flex-wrap gap-2 items-center">
					<select value={docId} onChange={(e) => setDocId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
						<option value="">Choose a document…</option>
						{caseDocuments.map((d) => <option key={d.doc_id} value={d.doc_id}>{d.label}</option>)}
					</select>
					<input value={docRole} onChange={(e) => setDocRole(e.target.value)} placeholder="role" className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button type="button" onClick={() => docId && docRole.trim() && attach.mutate({ partyId: party.party_id, docId, role: docRole.trim() })} disabled={!docId || !docRole.trim() || attach.isPending} className="rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm px-3 py-1.5">Assign</button>
				</div>
			)}
		</div>
	);
}
